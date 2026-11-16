import os
import tempfile
import unittest
from datetime import datetime

from fastapi import HTTPException

from backend import main


class MiseEnDemeureHistoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp_dir.cleanup)
        self.original_auth_db_path = main.AUTH_DB_PATH
        self.original_abonnes_by_numab = main.abonnes_by_numab
        main.AUTH_DB_PATH = os.path.join(self.tmp_dir.name, "users.db")
        main.abonnes_by_numab = {
            "IN-SECTOR": {"NUMAB": "IN-SECTOR", "SECTEUR": "01"},
            "OUT-OF-SECTOR": {"NUMAB": "OUT-OF-SECTOR", "SECTEUR": "02"},
        }
        main._init_auth_db()
        self.user = {"username": "limited", "is_admin": False, "allowed_sectors": ["01"]}

    def tearDown(self):
        main.AUTH_DB_PATH = self.original_auth_db_path
        main.abonnes_by_numab = self.original_abonnes_by_numab

    def test_record_uses_today_and_multiple_sent_notices_are_kept(self):
        first = main.record_sent_mise_en_demeure("in-sector", _user=self.user)
        second = main.record_sent_mise_en_demeure("in-sector", _user=self.user)

        today = datetime.now().date().isoformat()
        self.assertEqual(first["entry"]["date_edition"], today)
        self.assertEqual(second["entry"]["date_edition"], today)

        result = main.get_mises_en_demeure_history("in-sector", _user=self.user)
        self.assertEqual(result["numab"], "IN-SECTOR")
        self.assertEqual(len(result["history"]), 2)
        self.assertEqual(
            [entry["id"] for entry in result["history"]],
            [second["entry"]["id"], first["entry"]["id"]],
        )

    def test_history_returns_existing_dates_newest_first(self):
        with main._get_auth_conn() as conn:
            conn.executemany(
                "INSERT INTO sent_notice_history (numab, date_edition) VALUES (?, ?)",
                [
                    ("IN-SECTOR", "2005-08-01"),
                    ("IN-SECTOR", "2007-06-15"),
                    ("IN-SECTOR", "2024-04-22"),
                ],
            )

        result = main.get_mises_en_demeure_history("IN-SECTOR", _user=self.user)
        self.assertEqual(
            [entry["date_edition"] for entry in result["history"]],
            ["2024-04-22", "2007-06-15", "2005-08-01"],
        )

    def test_history_and_recording_reject_subscribers_outside_user_sector(self):
        for request in (
            lambda: main.get_mises_en_demeure_history("OUT-OF-SECTOR", _user=self.user),
            lambda: main.record_sent_mise_en_demeure("OUT-OF-SECTOR", _user=self.user),
        ):
            with self.subTest(request=request), self.assertRaises(HTTPException) as raised:
                request()
            self.assertEqual(raised.exception.status_code, 403)

        with main._get_auth_conn() as conn:
            self.assertEqual(
                conn.execute("SELECT COUNT(*) FROM sent_notice_history").fetchone()[0],
                0,
            )

    def test_history_and_recording_reject_unknown_subscribers_for_administrators(self):
        admin = {"username": "admin", "is_admin": True}
        for request in (
            lambda: main.get_mises_en_demeure_history("UNKNOWN", _user=admin),
            lambda: main.record_sent_mise_en_demeure("UNKNOWN", _user=admin),
        ):
            with self.subTest(request=request), self.assertRaises(HTTPException) as raised:
                request()
            self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
