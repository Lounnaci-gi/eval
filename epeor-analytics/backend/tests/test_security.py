import unittest
import os
import sqlite3
import tempfile
from contextlib import redirect_stdout
from concurrent.futures import ThreadPoolExecutor
from io import StringIO
from unittest.mock import patch

from fastapi import HTTPException, Request, Response
from backend.security import (
    build_safe_user_update_assignments,
    validate_password,
    validate_username,
)
from backend.main import (
    _clear_login_attempts,
    _delete_session_cookie,
    _get_audit_log,
    _get_login_status,
    _init_auth_db,
    _require_auth_enabled,
    LoginRequest,
    _log_audit,
    _record_failed_login,
    _set_session_cookie,
    auth_me,
    auth_login,
    get_current_user,
)


class SecurityTests(unittest.TestCase):
    def test_accepts_only_whitelisted_columns(self):
        assignments = build_safe_user_update_assignments(
            {
                "username": "alice",
                "display_name": "Alice",
                "salt": "abc",
                "password": "secret",
                "allowed_sectors": ["A", "B"],
            }
        )

        self.assertEqual(
            [column for column, _ in assignments],
            ["username", "display_name", "salt", "password", "allowed_sectors"],
        )

    def test_rejects_unsafe_columns(self):
        with self.assertRaises(ValueError):
            build_safe_user_update_assignments({"display_name": "Alice", "drop_table": "x"})

    def test_accepts_safe_username(self):
        self.assertEqual(validate_username("Alice_2024"), "alice_2024")

    def test_rejects_unsafe_username(self):
        with self.assertRaises(ValueError):
            validate_username("bad user")

    def test_accepts_username_hash_column(self):
        assignments = build_safe_user_update_assignments({"username_hash": "abc123"})
        self.assertEqual(assignments, [("username_hash", "abc123")])

    def test_hash_username_is_deterministic(self):
        from backend.main import _hash_username

        self.assertEqual(_hash_username("Alice"), _hash_username("alice"))
        self.assertIsInstance(_hash_username("Alice"), str)

    def test_accepts_strong_password(self):
        self.assertEqual(validate_password("StrongPass1"), "StrongPass1")

    def test_rejects_weak_password(self):
        with self.assertRaises(ValueError):
            validate_password("weak")

    def test_initial_admin_password_is_not_written_to_logs(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output = StringIO()
            with patch(
                "backend.main.AUTH_DB_PATH",
                os.path.join(temp_dir, "users.db"),
            ), patch("backend.main.secrets.token_urlsafe", return_value="secret-sentinel"):
                with redirect_stdout(output):
                    _init_auth_db()
                conn = sqlite3.connect(os.path.join(temp_dir, "users.db"))
                try:
                    admin = conn.execute(
                        "SELECT username, is_admin FROM users"
                    ).fetchone()
                finally:
                    conn.close()

        self.assertEqual(admin, ("admin", 1))
        self.assertNotIn("secret-sentinel", output.getvalue())
        self.assertIn("create_user.py", output.getvalue())

    def test_login_rate_limit_blocks_after_repeated_failures(self):
        ip = "203.0.113.10"
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, "users.db")
            with patch("backend.main.AUTH_DB_PATH", db_path):
                _clear_login_attempts(ip)
                for _ in range(3):
                    _record_failed_login(ip)
                status = _get_login_status(ip)
                self.assertTrue(status["blocked"])

                conn = sqlite3.connect(db_path)
                try:
                    stored_ip_key = conn.execute(
                        "SELECT ip_key FROM login_rate_limits"
                    ).fetchone()[0]
                finally:
                    conn.close()
                self.assertNotEqual(stored_ip_key, ip)
                self.assertEqual(len(stored_ip_key), 64)

                _clear_login_attempts(ip)
                self.assertFalse(_get_login_status(ip)["blocked"])

    def test_login_rate_limit_expires_after_ten_minutes(self):
        ip = "203.0.113.11"
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch(
                "backend.main.AUTH_DB_PATH",
                os.path.join(temp_dir, "users.db"),
            ), patch("backend.main.time.time", return_value=1000):
                _record_failed_login(ip)
                _record_failed_login(ip)
                self.assertTrue(_record_failed_login(ip)["blocked"])

            with patch(
                "backend.main.AUTH_DB_PATH",
                os.path.join(temp_dir, "users.db"),
            ), patch("backend.main.time.time", return_value=1601):
                self.assertFalse(_get_login_status(ip)["blocked"])

    def test_concurrent_failed_logins_share_the_block(self):
        ip = "203.0.113.12"
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch(
                "backend.main.AUTH_DB_PATH",
                os.path.join(temp_dir, "users.db"),
            ):
                with ThreadPoolExecutor(max_workers=6) as executor:
                    list(executor.map(_record_failed_login, [ip] * 6))
                self.assertTrue(_get_login_status(ip)["blocked"])

    def test_audit_log_records_sensitive_actions(self):
        before = len(_get_audit_log())
        _log_audit("test_action", 42, {"reason": "unit-test"})
        after = _get_audit_log()
        self.assertEqual(len(after), before + 1)
        self.assertEqual(after[-1]["action"], "test_action")

    def test_session_cookie_is_secure_by_default_and_on_logout(self):
        response = Response()
        with patch.dict(os.environ):
            os.environ.pop("EPEOR_SECURE_COOKIE", None)
            _set_session_cookie(response, "session-token")
            self.assertIn("HttpOnly", response.headers["set-cookie"])
            self.assertIn("SameSite=lax", response.headers["set-cookie"])
            self.assertIn("; Secure", response.headers["set-cookie"])

            response = Response()
            _delete_session_cookie(response)
            self.assertIn("HttpOnly", response.headers["set-cookie"])
            self.assertIn("; Secure", response.headers["set-cookie"])

    def test_session_cookie_can_be_insecure_for_local_http(self):
        response = Response()
        with patch.dict(os.environ, {"EPEOR_SECURE_COOKIE": "0"}):
            _set_session_cookie(response, "session-token")
        self.assertNotIn("; Secure", response.headers["set-cookie"])

    def test_disabled_authentication_fails_closed(self):
        with patch("backend.main._AUTH_ENABLED", False):
            with self.assertRaises(HTTPException) as raised:
                _require_auth_enabled()
            self.assertEqual(raised.exception.status_code, 503)

            with self.assertRaises(HTTPException) as raised:
                get_current_user()
            self.assertEqual(raised.exception.status_code, 503)

            with self.assertRaises(HTTPException) as raised:
                auth_me()
            self.assertEqual(raised.exception.status_code, 503)

            request = Request(
                {
                    "type": "http",
                    "method": "POST",
                    "path": "/api/auth/login",
                    "headers": [],
                    "client": ("127.0.0.1", 1234),
                    "server": ("localhost", 8000),
                    "scheme": "http",
                    "query_string": b"",
                }
            )
            with self.assertRaises(HTTPException) as raised:
                auth_login(LoginRequest(username="user", password="pass"), request, Response())
            self.assertEqual(raised.exception.status_code, 503)

if __name__ == "__main__":
    unittest.main()
