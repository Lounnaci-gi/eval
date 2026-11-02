import unittest
from unittest.mock import patch

from backend import main


class DataLoadDiagnosticsTests(unittest.TestCase):
    def test_partial_status_lists_missing_and_failed_datasets(self):
        diagnostics = {
            "ABONNE.DBF": {
                "file": "ABONNE.DBF",
                "status": "loaded",
                "record_count": 12,
                "source": "cache",
            },
            "FACTURES.DBF": {
                "file": "FACTURES.DBF",
                "status": "error",
                "record_count": 0,
                "error": "DBF illisible",
            },
            "RUE.DBF": {
                "file": "RUE.DBF",
                "status": "missing",
                "record_count": 0,
                "error": "Fichier DBF introuvable",
            },
        }

        with patch.object(main, "_data_load_diagnostics", diagnostics):
            payload = main._data_load_diagnostics_payload()

        self.assertEqual(payload["status"], "partial")
        self.assertEqual(payload["loaded_tables"], 1)
        self.assertEqual(payload["issue_count"], 2)
        self.assertEqual(
            [issue["file"] for issue in payload["issues"]],
            ["FACTURES.DBF", "RUE.DBF"],
        )

    def test_complete_status_when_all_recorded_datasets_loaded(self):
        diagnostics = {
            "ABONNE.DBF": {
                "file": "ABONNE.DBF",
                "status": "loaded",
                "record_count": 12,
            },
        }

        with patch.object(main, "_data_load_diagnostics", diagnostics):
            payload = main._data_load_diagnostics_payload()

        self.assertEqual(payload["status"], "complete")
        self.assertEqual(payload["issue_count"], 0)

    def test_missing_dbf_is_recorded_as_a_diagnostic(self):
        with (
            patch.object(main, "_record_data_load_result") as record_result,
            patch.object(main, "resolve_dbf_path", return_value=r"C:\missing\ABONNE.DBF"),
            patch.object(main.os.path, "isfile", return_value=False),
        ):
            result = main.load_table_cached("ABONNE.DBF")

        self.assertEqual(result, [])
        record_result.assert_called_once_with(
            "ABONNE.DBF",
            "missing",
            error="Fichier DBF introuvable",
        )

    def test_stats_exposes_partial_data_quality_after_core_load(self):
        diagnostics = {
            "ABONNE.DBF": {
                "file": "ABONNE.DBF",
                "status": "loaded",
                "record_count": 12,
            },
            "FACTURES.DBF": {
                "file": "FACTURES.DBF",
                "status": "error",
                "record_count": 0,
                "error": "DBF illisible",
            },
        }

        with (
            patch.object(main, "_data_load_diagnostics", diagnostics),
            patch.object(main, "is_db_ready", True),
            patch.object(main, "MEM_ABONNES", [{"NUMAB": "123"}]),
            patch.object(main, "cached_dashboard_stats", {"total_subscribers": 12}),
            patch.object(main, "DATA_DIR", r"C:\epeor"),
        ):
            payload = main.get_stats(_user={"is_admin": True})

        self.assertTrue(payload["ready"])
        self.assertEqual(payload["data_quality"]["status"], "partial")
        self.assertEqual(payload["data_quality"]["issues"][0]["file"], "FACTURES.DBF")


if __name__ == "__main__":
    unittest.main()
