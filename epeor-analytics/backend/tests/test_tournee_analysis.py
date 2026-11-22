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
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "003", "DATFACT": "20260331", "DATEPREVUE": "20261101", "DATERELEVE": "20261116", "DEB_SAISIE": "20261117"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "004", "DATFACT": "00000000", "DATEPREVUE": "20200101"},
        ]

        result = _analyze_tournee_records(records, "20261118", ["02"])

        self.assertEqual(result["active_datfact"], "20260331")
        self.assertEqual(result["total_tournees"], 4)
        self.assertEqual(result["tournees_periode_active"], 1)
        self.assertEqual(result["counts"], {1: 0, 2: 0, 3: 1, 4: 0, 5: 0})
        self.assertEqual([tour["TOURNEE"] for tour in result["tournees"]], ["003"])

    def test_selects_requested_datfact_and_returns_available_periods(self):
        records = [
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20251231", "DATEPREVUE": "20251101", "DEB_SAISIE": "20251201"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "002", "DATFACT": "20260331", "DATEPREVUE": "20260201", "DEB_SAISIE": "20260301"},
        ]

        result = _analyze_tournee_records(records, "20261118", selected_datfact="20251231")

        self.assertEqual(result["active_datfact"], "20251231")
        self.assertEqual(result["available_datfacts"], ["20260331", "20251231"])
        self.assertEqual(result["tournees_periode_active"], 1)
        self.assertEqual([tour["TOURNEE"] for tour in result["tournees"]], ["001"])

    def test_selects_multiple_datfacts_for_year_or_quarter_ranges(self):
        records = [
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20260131", "DATEPREVUE": "20251201", "DEB_SAISIE": "20260101"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20260331", "DATEPREVUE": "20260201", "EDITCTL": "20260301"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20260430", "DATEPREVUE": "20260301", "EDITCTL": "20260401"},
        ]

        result = _analyze_tournee_records(
            records, "20261118", selected_datfact=["20260131", "20260331"]
        )

        self.assertEqual(result["selected_datfacts"], ["20260331", "20260131"])
        self.assertEqual(result["tournees_periode_active"], 2)
        self.assertEqual({tour["DATFACT"] for tour in result["tournees"]}, {"20260131", "20260331"})

    def test_includes_each_category_with_default_delay_thresholds(self):
        today = "20261117"
        records = [
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20261231", "DATEPREVUE": "20261112"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "002", "DATFACT": "20261231", "DATEPREVUE": "20261113"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "003", "DATFACT": "20261231", "DATEPREVUE": "20261116", "DATERELEVE": "20261116"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "004", "DATFACT": "20261231", "DATEPREVUE": "20261116", "DATERELEVE": "20261115"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "005", "DATFACT": "20261231", "DATEPREVUE": "20261001", "DATERELEVE": "20261016", "DEB_SAISIE": "20261017"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "010", "DATFACT": "20261231", "DATEPREVUE": "20261101", "DATERELEVE": "20261101", "DEB_SAISIE": "20261117"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "006", "DATFACT": "20261231", "DATEPREVUE": "20261101", "DATERELEVE": "20261101", "DEB_SAISIE": "20261101", "EDITCTL": "20261115"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "007", "DATFACT": "20261231", "DATEPREVUE": "20261101", "DATERELEVE": "20261101", "DEB_SAISIE": "20261101", "EDITCTL": "20261114"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "008", "DATFACT": "20261231", "DATEPREVUE": "20261101", "DATERELEVE": "20261101", "DEB_SAISIE": "20261101", "EDITCTL": "20261101", "EDITFAC": "20261117"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "009", "DATFACT": "20261231", "DATEPREVUE": "20261101", "DATERELEVE": "20261101", "DEB_SAISIE": "20261101", "EDITCTL": "20261101", "EDITFAC": "20261116"},
        ]
        abonne_records = [
            {"UNITE": "26", "SECTEUR": "02", "TOURNEE": "008", "NUMAB": "A008"},
            {"UNITE": "26", "SECTEUR": "02", "TOURNEE": "009", "NUMAB": "A009"},
        ]

        result = _analyze_tournee_records(
            records,
            today,
            abonne_records=abonne_records,
            facture_records=[],
        )

        self.assertEqual(result["counts"], {1: 1, 2: 1, 3: 1, 4: 1, 5: 1})
        self.assertEqual(
            [(tour["TOURNEE"], tour["code"], tour["jours_retard"]) for tour in result["tournees"]],
            [("001", 1, 5), ("004", 2, 2), ("005", 3, 31), ("007", 4, 3), ("009", 5, 1)],
        )

    def test_ignores_future_stage_dates_and_excludes_missing_dateprevue(self):
        records = [
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20261231", "DATEPREVUE": "20261110", "DATERELEVE": "20261116", "DEB_SAISIE": "20261118"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "002", "DATFACT": "20261231", "DATEPREVUE": "20261110", "DATERELEVE": "20261118"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "003", "DATFACT": "20261231", "DEB_SAISIE": "20261101"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "004", "DATFACT": "20261231", "DATEPREVUE": "20261110", "DATERELEVE": "20261110", "DEB_SAISIE": "20261110", "EDITCTL": "20261114", "EDITFAC": "20261118"},
        ]
        abonne_records = [
            {"UNITE": "26", "SECTEUR": "02", "TOURNEE": "004", "NUMAB": "A004"},
        ]

        result = _analyze_tournee_records(
            records,
            "20261117",
            abonne_records=abonne_records,
            facture_records=[],
            minimum_delay_days={2: 1},
        )

        self.assertEqual(result["counts"], {1: 1, 2: 1, 3: 0, 4: 1, 5: 0})
        self.assertEqual(
            [(tour["TOURNEE"], tour["code"]) for tour in result["tournees"]],
            [("001", 2), ("002", 1), ("004", 4)],
        )
        self.assertNotIn("003", [tour["TOURNEE"] for tour in result["tournees"]])

    def test_category_five_uses_invoice_payment_status_for_tour_datfact(self):
        records = [
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "001", "DATFACT": "20261231", "DATEPREVUE": "20261101", "DATERELEVE": "20261101", "DEB_SAISIE": "20261101", "EDITCTL": "20261101", "EDITFAC": "20261116", "RELEVEUR": "A001"},
            {"UNITE": "26", "CENTRE": "02", "TOURNEE": "002", "DATFACT": "20261231", "DATEPREVUE": "20261101", "DATERELEVE": "20261101", "DEB_SAISIE": "20261101", "EDITCTL": "20261101", "EDITFAC": "20261116"},
        ]
        abonne_records = [
            {"UNITE": "26", "SECTEUR": "02", "TOURNEE": "001", "NUMAB": "A001"},
            {"UNITE": "26", "SECTEUR": "02", "TOURNEE": "002", "NUMAB": "A002"},
        ]
        facture_records = [
            {"NUMAB": "A001", "DATFACT": "20261231", "PAIEMENT": "T"},
            {"NUMAB": "A002", "DATFACT": "20261231", "PAIEMENT": "C"},
            {"NUMAB": "A001", "DATFACT": "20260930", "PAIEMENT": "C"},
        ]

        result = _analyze_tournee_records(
            records,
            "20261117",
            abonne_records=abonne_records,
            facture_records=facture_records,
        )

        self.assertEqual(result["counts"], {1: 0, 2: 0, 3: 0, 4: 0, 5: 1})
        self.assertEqual(result["tournees"][0]["TOURNEE"], "001")
        self.assertEqual(
            result["bilan_tournees"],
            "Centre 02 : BERROUAGHIA\n"
            "  5️⃣ 5. EN ATTENTE DE PAIEMENT !\n"
            "     🚶 Tournees : 001(A001)/1J (1)",
        )


if __name__ == "__main__":
    unittest.main()