import unittest

from backend.security import (
    build_safe_user_update_assignments,
    validate_password,
    validate_username,
)
from backend.main import _get_login_status, _record_failed_login, _clear_login_attempts, _get_audit_log, _log_audit


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

    def test_accepts_strong_password(self):
        self.assertEqual(validate_password("StrongPass1"), "StrongPass1")

    def test_rejects_weak_password(self):
        with self.assertRaises(ValueError):
            validate_password("weak")

    def test_login_rate_limit_blocks_after_repeated_failures(self):
        ip = "203.0.113.10"
        _clear_login_attempts(ip)
        for _ in range(3):
            _record_failed_login(ip)
        status = _get_login_status(ip)
        self.assertTrue(status["blocked"])
        _clear_login_attempts(ip)

    def test_audit_log_records_sensitive_actions(self):
        before = len(_get_audit_log())
        _log_audit("test_action", 42, {"reason": "unit-test"})
        after = _get_audit_log()
        self.assertEqual(len(after), before + 1)
        self.assertEqual(after[-1]["action"], "test_action")


if __name__ == "__main__":
    unittest.main()
