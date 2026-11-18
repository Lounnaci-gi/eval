import unittest

from backend.main import _analyze_tournee_records, _classify_tournee_status


class TourneeAnalysisTests(unittest.TestCase):
    def test_classifies_each_pending_step_and_empty_values(self):
        samples = [
            ({"DATEPREVUE": "20261117", "DATERELEVE": None}, 1),
            ({"DATEPREVUE": "20261117", "DATERELEVE": "20261117", "DEB_SAISIE": ""}, 2),
            ({"DEB_SAISIE": "20261117", "EDITCTL": None}, 3),
            ({"EDITCTL": "20261117", "EDITFAC": ""}, 4),
            ({"DATEPREVUE": "20261117", "DATERELEVE": "20261117", "DEB_SAISIE": "20261117", "EDITCTL": "20261117", "EDITFAC": "20261117"}, None),
        ]

        for record, expected in samples:
            with self.subTest(record=record):
                self.assertEqual(_classify_tournee_status(record, "20261118"), expected)

    def test_due_today_and_invalid_or_zero_dates_are_not_overdue(self):
        for dateprevue in ("20261118", "00000000", "20260230", ""):
            with self.subTest(dateprevue=dateprevue):
                self.assertIsNone(
                    _classify_tournee_status(
                        {"DATEPREVUE": dateprevue, "DATERELEVE": None}, "20261118"
                    )
                )

    def test_uses_latest_valid_datfact_and_limits_centers(self):
        records = [
            {"UNITE": "26", "CENTRE": "01", "TOURNEE": "001", "DATFACT": "20251231", "DATEPREVUE": "20200101"},
            {"UNITE": "26", "CENTRE": "01", "TOURNEE": "002", "DATFACT": "20260331", "DATEPREVUE": "20261117"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "003", "DATFACT": "20260331", "DEB_SAISIE": "20261117"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "004", "DATFACT": "00000000", "DATEPREVUE": "20200101"},
        ]

        result = _analyze_tournee_records(records, "20261118", ["02"])

        self.assertEqual(result["active_datfact"], "20260331")
        self.assertEqual(result["total_tournees"], 4)
        self.assertEqual(result["tournees_periode_active"], 1)
        self.assertEqual(result["counts"], {1: 0, 2: 0, 3: 1, 4: 0})
        self.assertEqual([tour["TOURNEE"] for tour in result["tournees"]], ["003"])

    def test_selects_requested_datfact_and_returns_available_periods(self):
        records = [
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20251231", "DEB_SAISIE": "20251201"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "002", "DATFACT": "20260331", "DEB_SAISIE": "20260301"},
        ]

        result = _analyze_tournee_records(records, "20261118", selected_datfact="20251231")

        self.assertEqual(result["active_datfact"], "20251231")
        self.assertEqual(result["available_datfacts"], ["20260331", "20251231"])
        self.assertEqual(result["tournees_periode_active"], 1)
        self.assertEqual([tour["TOURNEE"] for tour in result["tournees"]], ["001"])

    def test_selects_multiple_datfacts_for_year_or_quarter_ranges(self):
        records = [
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20260131", "DEB_SAISIE": "20260101"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20260331", "EDITCTL": "20260301"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20260430", "EDITCTL": "20260401"},
        ]

        result = _analyze_tournee_records(
            records, "20261118", selected_datfact=["20260131", "20260331"]
        )

        self.assertEqual(result["selected_datfacts"], ["20260331", "20260131"])
        self.assertEqual(result["tournees_periode_active"], 2)
        self.assertEqual({tour["DATFACT"] for tour in result["tournees"]}, {"20260131", "20260331"})


if __name__ == "__main__":
    unittest.main()