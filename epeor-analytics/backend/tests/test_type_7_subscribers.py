import unittest
from unittest.mock import patch

import backend.main as main


class Type7SubscriberTests(unittest.TestCase):
    def test_collects_unique_type_7_subscribers_by_commune_and_subscriber_type(self):
        records = [
            {"NUMAB": "01001", "TYPE": "7", "PERIODE": "5", "DATFACT": "20240110", "MONTTC": 1200, "TYPABON": "10"},
            {"NUMAB": "01001", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20240111", "MONTTC": 800, "TYPABON": "10"},
            {"NUMAB": "01002", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20240115", "TYPABON": "20"},
            {"NUMAB": "02001", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20240120", "TYPABON": "10"},
            {"NUMAB": "01003", "TYPE": "7", "PERIODE": "0004", "DATFACT": "20240115", "TYPABON": "10"},
            {"NUMAB": "01004", "TYPE": "E", "PERIODE": "0005", "DATSAISIE": "20240115", "TYPABON": "10"},
            {"NUMAB": "01006", "TYPE": "7", "PERIODE": "0004", "DATFACT": "20240115", "TYPABON": "10"},
            {"NUMAB": "01005", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20240201", "TYPABON": "10"},
        ]
        commune_by_numab = {
            "01001": "01",
            "01002": "01",
            "02001": "02",
            "01003": "01",
            "01004": "01",
            "01005": "01",
            "01006": "01",
        }

        with (
            patch.object(main, "_abonne_codcom", side_effect=lambda numab: commune_by_numab[numab]),
            patch.object(main, "resolve_rue_adresse", return_value="Rue du Test"),
        ):
            subscribers = main._collect_type_7_subscribers(
                records,
                {"01001": {"NOM": "Abonné 1", "BLOC": "B12", "NDOM": "45"}},
                {"01001", "01002", "02001", "01003", "01004", "01005", "01006"},
                "20240101",
                "20240131",
            )

        self.assertEqual(len(subscribers[("01", ("EAU", 1, "E", "MENAGES"))]), 1)
        household = subscribers[("01", ("EAU", 1, "E", "MENAGES"))]["01001"]
        self.assertEqual(household["name"], "Abonné 1")
        self.assertEqual(household["address"], "Rue du Test")
        self.assertEqual(household["bloc"], "B12")
        self.assertEqual(household["ndom"], "45")
        self.assertEqual(household["invoices"], [
            {"datfact": "20240110", "monttc": 1200.0, "type": "7"},
            {"datfact": "20240111", "monttc": 800.0, "type": "7"},
        ])
        self.assertEqual(len(subscribers[("01", ("EAU", 2, "E", "ADMINISTRATIONS"))]), 1)
        self.assertEqual(len(subscribers[("02", ("EAU", 1, "E", "MENAGES"))]), 1)
        self.assertEqual(sum(len(group) for group in subscribers.values()), 3)

    def test_uses_subscriber_type_and_name_from_subscriber_record(self):
        with patch.object(main, "_abonne_codcom", return_value="03"):
            subscribers = main._collect_type_7_subscribers(
                [
                    {"NUMAB": "03001", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20240110"},
                ],
                {"03001": {"TYPABON": "30", "RAISOC": "Société test"}},
                None,
                None,
                None,
            )

        group = subscribers[("03", ("EAU", 3, "E", "SERVICES"))]
        self.assertEqual(len(group), 1)
        self.assertEqual(group["03001"]["name"], "Société test")

    def test_includes_a0009_cut_penalty_class_for_january_2023(self):
        record = {
            "NUMAB": "01001",
            "TYPE": "A",
            "PERIODE": "9",
            "DATFACT": "20230115",
            "MONTTC": 1000,
            "TYPABON": "10",
        }
        with (
            patch.dict(main.classe_map, {("A", "0009"): "F.COUPURE/RETARD DE PAIEMENT"}),
            patch.object(main, "_abonne_codcom", return_value="01"),
            patch.object(main, "resolve_rue_adresse", return_value="Rue du Test"),
        ):
            subscribers = main._collect_type_7_subscribers(
                [record],
                {"01001": {"NOM": "Abonné test"}},
                {"01001"},
                "20230101",
                "20230131",
            )

        group = subscribers[("01", ("EAU", 1, "E", "MENAGES"))]
        self.assertEqual(group["01001"]["invoices"], [
            {"datfact": "20230115", "monttc": 1000.0, "type": "A"},
        ])

    def test_recognizes_a0009_penalty_when_class_lookup_is_unavailable(self):
        with patch.dict(main.classe_map, {}, clear=True):
            self.assertTrue(main._is_cut_penalty_invoice(
                {"TYPE": "A", "PERIODE": "9", "DATFACT": "20230115"},
                "20230101",
                "20230131",
            ))

    def test_recognizes_legacy_a0005_penalty_without_class_lookup(self):
        record = {
            "NUMAB": "B12582",
            "TYPE": "A",
            "PERIODE": "0005",
            "DATFACT": "20191031",
            "MONTTC": 1000,
            "DATREG": "20191016",
            "PAIEMENT": "C",
        }
        with patch.dict(main.classe_map, {}, clear=True):
            self.assertTrue(main._is_cut_penalty_invoice(
                record,
                "20191001",
                "20191031",
            ))

    def test_current_unpaid_balance_excludes_cut_fees_in_selected_period(self):
        balances = main._collect_current_creances_by_numab(
            [
                {
                    "NUMAB": "B10518",
                    "TYPE": "E",
                    "PERIODE": "0001",
                    "DATFACT": "20260930",
                    "DATSAISIE": "20260930",
                    "DATREG": "20261026",
                    "MONTTC": 2861.69,
                },
                {
                    "NUMAB": "B10518",
                    "TYPE": "E",
                    "PERIODE": "0001",
                    "DATFACT": "20261015",
                    "DATSAISIE": "20261015",
                    "DATREG": "",
                    "MONTTC": 3265.13,
                },
                {
                    "NUMAB": "B10518",
                    "DATFACT": "20261031",
                    "DATSAISIE": "20261031",
                    "DATREG": "",
                    "MONTTC": 1200,
                    "TYPE": "7",
                    "PERIODE": "0005",
                },
                {
                    "NUMAB": "B10518",
                    "DATFACT": "20261101",
                    "DATSAISIE": "20261101",
                    "DATREG": "",
                    "MONTTC": 100,
                    "TYPE": "7",
                    "PERIODE": "0005",
                },
                {
                    "NUMAB": "OTHER",
                    "TYPE": "E",
                    "PERIODE": "0001",
                    "DATFACT": "20261015",
                    "DATSAISIE": "20261015",
                    "DATREG": "",
                    "MONTTC": 500,
                },
            ],
            [],
            {"B10518"},
            "20261109",
            "20261001",
            "20261031",
        )

        self.assertEqual(balances, {"B10518": 6226.82})

    def test_includes_invoices_paid_in_period_end_month_or_following_month(self):
        balances = main._collect_current_creances_by_numab(
            [
                {
                    "NUMAB": "B35677",
                    "TYPE": "E",
                    "DATFACT": "20260930",
                    "DATSAISIE": "20260930",
                    "DATREG": "20261104",
                    "MONTTC": 2631.14,
                },
                {
                    "NUMAB": "B35677",
                    "TYPE": "E",
                    "DATFACT": "20261231",
                    "DATSAISIE": "20261231",
                    "DATREG": "20261104",
                    "MONTTC": 1461.96,
                },
                {
                    "NUMAB": "B35677",
                    "TYPE": "7",
                    "PERIODE": "0005",
                    "DATFACT": "20261031",
                    "DATSAISIE": "20261031",
                    "DATREG": "20261104",
                    "MONTTC": 1200,
                },
                {
                    "NUMAB": "B35677",
                    "TYPE": "E",
                    "DATFACT": "20260831",
                    "DATSAISIE": "20260831",
                    "DATREG": "20261030",
                    "MONTTC": 50,
                },
                {
                    "NUMAB": "B35677",
                    "TYPE": "E",
                    "DATFACT": "20261130",
                    "DATSAISIE": "20261130",
                    "DATREG": "20261201",
                    "MONTTC": 75,
                },
            ],
            [],
            {"B35677"},
            "20261109",
            "20261001",
            "20261031",
        )

        self.assertEqual(balances, {"B35677": 4143.1})

    def test_includes_b12582_invoices_paid_same_month_as_cut_fee(self):
        balances = main._collect_current_creances_by_numab(
            [
                {"NUMAB": "B12582", "DATFACT": "20241231", "DATSAISIE": "20241231", "DATREG": "20261021", "MONTTC": 624.45, "TYPE": "E"},
                {"NUMAB": "B12582", "DATFACT": "20250331", "DATSAISIE": "20250331", "DATREG": "20261021", "MONTTC": 611.50, "TYPE": "E"},
                {"NUMAB": "B12582", "DATFACT": "20250630", "DATSAISIE": "20250630", "DATREG": "20261021", "MONTTC": 598.58, "TYPE": "E"},
                {"NUMAB": "B12582", "DATFACT": "20250930", "DATSAISIE": "20250930", "DATREG": "20261021", "MONTTC": 932.63, "TYPE": "E"},
                {"NUMAB": "B12582", "DATFACT": "20251231", "DATSAISIE": "20251231", "DATREG": "20261021", "MONTTC": 650.32, "TYPE": "E"},
                {"NUMAB": "B12582", "DATFACT": "20260331", "DATSAISIE": "20260331", "DATREG": "20261021", "MONTTC": 559.80, "TYPE": "E"},
                {"NUMAB": "B12582", "DATFACT": "20260630", "DATSAISIE": "20260630", "DATREG": "20261021", "MONTTC": 585.65, "TYPE": "E"},
                {"NUMAB": "B12582", "DATFACT": "20260930", "DATSAISIE": "20260930", "DATREG": "20261021", "MONTTC": 967.92, "TYPE": "E"},
                {"NUMAB": "B12582", "DATFACT": "20261031", "DATSAISIE": "20261031", "DATREG": "20261021", "MONTTC": 1200, "TYPE": "7", "PERIODE": "0005"},
            ],
            [],
            {"B12582"},
            "20261109",
            "20261001",
            "20261031",
        )

        self.assertEqual(balances, {"B12582": 5530.85})

    def test_excludes_cut_penalty_created_during_period_even_if_invoice_date_is_outside(self):
        balances = main._collect_current_creances_by_numab(
            [
                {
                    "NUMAB": "B12582",
                    "TYPE": "7",
                    "PERIODE": "0005",
                    "DATFACT": "20261130",
                    "DATSAISIE": "20261031",
                    "DATREG": "20261104",
                    "MONTTC": 1200,
                },
                {
                    "NUMAB": "B12582",
                    "TYPE": "E",
                    "DATFACT": "20260930",
                    "DATSAISIE": "20260930",
                    "DATREG": "20261104",
                    "MONTTC": 500,
                },
            ],
            [],
            {"B12582"},
            "20261109",
            "20261001",
            "20261031",
        )

        self.assertEqual(balances, {"B12582": 500})

    def test_counts_paid_subscribers_with_cut_penalty_created_in_period(self):
        paid_with_cut = main._collect_paid_subscribers_with_cut_created(
            [
                {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 500},
                {
                    "NUMAB": "B12582",
                    "TYPE": "7",
                    "PERIODE": "0005",
                    "DATFACT": "20261031",
                    "DATSAISIE": "20261031",
                    "DATREG": "20261021",
                    "MONTTC": 1200,
                },
                {"NUMAB": "B35677", "TYPE": "E", "DATREG": "20261021", "MONTTC": 100},
                {
                    "NUMAB": "B35677",
                    "TYPE": "7",
                    "PERIODE": "0005",
                    "DATFACT": "20261031",
                    "DATSAISIE": "20260930",
                    "DATREG": "20261021",
                    "MONTTC": 1200,
                },
                {
                    "NUMAB": "B77889",
                    "TYPE": "E",
                    "DATREG": "20261101",
                    "MONTTC": 100,
                },
                {
                    "NUMAB": "B77889",
                    "TYPE": "7",
                    "PERIODE": "0005",
                    "DATFACT": "20261031",
                    "DATSAISIE": "20261031",
                    "DATREG": "20261101",
                    "MONTTC": 1200,
                },
            ],
            {"B12582", "B35677", "B77889"},
            "20261001",
            "20261031",
        )

        self.assertEqual(paid_with_cut, {
            "B12582": 500,
            "B35677": 100,
        })

    def test_sums_paid_amounts_for_b12582_with_cut_created_in_period(self):
        records = [
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 624.45},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 611.50},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 598.58},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 932.63},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 650.32},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 559.80},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 585.65},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 967.92},
            {
                "NUMAB": "B12582",
                "TYPE": "7",
                "PERIODE": "0005",
                "DATFACT": "20261031",
                "DATSAISIE": "20261031",
                "DATREG": "20261021",
                "MONTTC": 1200,
            },
        ]

        paid_amounts = main._collect_paid_subscribers_with_cut_created(
            records,
            {"B12582"},
            "20261001",
            "20261031",
        )

        self.assertEqual(paid_amounts, {"B12582": 5530.85})

    def test_collects_latest_payment_date_for_subscriber_with_cut_created_in_period(self):
        records = [
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261001", "MONTTC": 300},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261021", "MONTTC": 500},
            {"NUMAB": "B12582", "TYPE": "E", "DATREG": "20261104", "MONTTC": 200},
            {
                "NUMAB": "B12582",
                "TYPE": "7",
                "PERIODE": "0005",
                "DATFACT": "20261031",
                "DATSAISIE": "20261031",
                "DATREG": "20261021",
                "MONTTC": 1200,
            },
        ]

        payment_dates = main._collect_paid_dates_with_cut_created(
            records,
            {"B12582"},
            "20261001",
            "20261031",
        )

        self.assertEqual(payment_dates, {"B12582": "2026-11-04"})

    def test_includes_payments_after_selected_period_for_b36477(self):
        records = [
            {"NUMAB": "B36477", "TYPE": "E", "DATFACT": "20260630", "MONTTC": 826.78, "DATREG": "20261031", "PAIEMENT": "C"},
            {"NUMAB": "B36477", "TYPE": "E", "DATFACT": "20260930", "MONTTC": 1497.26, "DATREG": "20261031", "PAIEMENT": "C"},
            {"NUMAB": "B36477", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20260930", "MONTTC": 1200, "DATREG": "20261031", "PAIEMENT": "C"},
            {"NUMAB": "B36477", "TYPE": "E", "DATFACT": "20261231", "MONTTC": 1144.36, "DATREG": "20261031", "PAIEMENT": "C"},
        ]

        paid_amounts = main._collect_paid_subscribers_with_cut_created(
            records,
            {"B36477"},
            "20260901",
            "20260930",
        )
        detail_amounts = main._collect_paid_amounts_after_cut_created(
            records,
            {"B36477"},
            "20260901",
            "20260930",
        )
        payment_dates = main._collect_paid_dates_with_cut_created(
            records,
            {"B36477"},
            "20260901",
            "20260930",
        )

        self.assertEqual(paid_amounts, {})
        self.assertEqual(detail_amounts, {"B36477": 2324.04})
        self.assertEqual(payment_dates, {"B36477": "2026-10-31"})

    def test_excludes_future_invoice_from_september_paid_amount_for_b36783(self):
        records = [
            {"NUMAB": "B36783", "TYPE": "E", "DATFACT": "20260630", "MONTTC": 1144.36, "DATREG": "20261105", "PAIEMENT": "C"},
            {"NUMAB": "B36783", "TYPE": "E", "DATFACT": "20260930", "MONTTC": 2285.35, "DATREG": "20261105", "PAIEMENT": "C"},
            {"NUMAB": "B36783", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20260930", "MONTTC": 1200, "DATREG": "20261105", "PAIEMENT": "C"},
            {"NUMAB": "B36783", "TYPE": "E", "DATFACT": "20261231", "MONTTC": 1824.27, "DATREG": "20261105", "PAIEMENT": "C"},
        ]

        paid_amounts = main._collect_paid_subscribers_with_cut_created(
            records,
            {"B36783"},
            "20260901",
            "20260930",
        )
        detail_amounts = main._collect_paid_amounts_after_cut_created(
            records,
            {"B36783"},
            "20260901",
            "20260930",
        )
        payment_dates = main._collect_paid_dates_with_cut_created(
            records,
            {"B36783"},
            "20260901",
            "20260930",
        )

        self.assertEqual(paid_amounts, {})
        self.assertEqual(detail_amounts, {"B36783": 3429.71})
        self.assertEqual(payment_dates, {"B36783": "2026-11-05"})

    def test_includes_november_payments_for_b37483_but_excludes_november_cut_fee(self):
        records = [
            {"NUMAB": "B37483", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20260627", "MONTTC": 1200, "DATREG": "20261104", "PAIEMENT": "C"},
            {"NUMAB": "B37483", "TYPE": "E", "DATFACT": "20260930", "MONTTC": 327, "DATREG": "20261104", "PAIEMENT": "C"},
            {"NUMAB": "B37483", "TYPE": "E", "DATFACT": "20261231", "MONTTC": 2227.71, "DATREG": "20261104", "PAIEMENT": "C"},
            {"NUMAB": "B37483", "TYPE": "7", "PERIODE": "0005", "DATFACT": "20261130", "MONTTC": 1200, "DATREG": "20261104", "PAIEMENT": "C"},
        ]

        paid_amounts = main._collect_paid_subscribers_with_cut_created(
            records,
            {"B37483"},
            "20261101",
            "20261130",
        )
        detail_amounts = main._collect_paid_amounts_after_cut_created(
            records,
            {"B37483"},
            "20261101",
            "20261130",
        )

        self.assertEqual(paid_amounts, {"B37483": 3754.71})
        self.assertEqual(detail_amounts, {"B37483": 3754.71})

    def test_paid_total_excludes_cut_penalty_created_in_period(self):
        records = [
            {"NUMAB": "131591", "TYPE": "E", "DATREG": "20261014", "MONTTC": 856.46},
            {"NUMAB": "131591", "TYPE": "E", "DATREG": "20261014", "MONTTC": 1355.60},
            {"NUMAB": "131591", "TYPE": "E", "DATREG": "20261014", "MONTTC": 1480.38},
            {"NUMAB": "131591", "TYPE": "E", "DATREG": "20261014", "MONTTC": 981.26},
            {"NUMAB": "131591", "TYPE": "E", "DATREG": "20261014", "MONTTC": 1106.04},
            {"NUMAB": "131591", "TYPE": "E", "DATREG": "20261014", "MONTTC": 2229.10},
            {
                "NUMAB": "131591",
                "TYPE": "7",
                "PERIODE": "0005",
                "DATFACT": "20261031",
                "DATSAISIE": "20261031",
                "DATREG": "20261014",
                "MONTTC": 2000,
            },
        ]

        paid_amounts = main._collect_paid_subscribers_with_cut_created(
            records,
            {"131591"},
            "20261001",
            "20261031",
        )

        self.assertEqual(paid_amounts, {"131591": 8008.84})

    def test_collects_prior_cut_as_settled_when_first_payment_is_in_selected_period(self):
        records = [
            {
                "NUMAB": "01001",
                "TYPE": "7",
                "PERIODE": "0005",
                "DATFACT": "20260630",
                "DATSAISIE": "20260630",
                "MONTTC": 1200,
            },
            {"NUMAB": "01001", "TYPE": "E", "DATFACT": "20260531", "DATREG": "20261014", "MONTTC": 500},
            {
                "NUMAB": "01002",
                "TYPE": "A",
                "PERIODE": "0009",
                "DATFACT": "20260228",
                "DATSAISIE": "20260228",
                "MONTTC": 1200,
            },
            {"NUMAB": "01002", "TYPE": "E", "DATFACT": "20260531", "DATREG": "20260914", "MONTTC": 300},
            {"NUMAB": "01002", "TYPE": "E", "DATFACT": "20260930", "DATREG": "20261014", "MONTTC": 200},
            {
                "NUMAB": "01004",
                "TYPE": "7",
                "PERIODE": "0005",
                "DATFACT": "20260630",
                "DATSAISIE": "20260630",
                "DATREG": "20260715",
                "MONTTC": 1200,
            },
            {"NUMAB": "01004", "TYPE": "E", "DATFACT": "20260930", "DATREG": "20261014", "MONTTC": 100},
            {
                "NUMAB": "01003",
                "TYPE": "7",
                "PERIODE": "0005",
                "DATFACT": "20261015",
                "DATSAISIE": "20261015",
                "MONTTC": 1200,
            },
            {"NUMAB": "01003", "TYPE": "E", "DATFACT": "20260930", "DATREG": "20261014", "MONTTC": 400},
        ]

        with patch.object(main, "resolve_rue_adresse", return_value="Rue du Test"):
            settlements = main._collect_settled_previous_cuts(
                records,
                {
                    "01001": {"NOM": "Abonné 1", "TYPABON": "10"},
                    "01002": {"NOM": "Abonné 2", "TYPABON": "20"},
                    "01003": {"NOM": "Abonné 3", "TYPABON": "10"},
                    "01004": {"NOM": "Abonné 4", "TYPABON": "10"},
                },
                {"01001", "01002", "01003", "01004"},
                {"01003"},
                "20261001",
                "20261031",
            )

        self.assertEqual(len(settlements), 1)
        self.assertEqual(settlements[0]["numab"], "01001")
        self.assertEqual(settlements[0]["name"], "Abonné 1")
        self.assertEqual(settlements[0]["cut_date"], "20260630")
        self.assertEqual(settlements[0]["creance"], 0.0)
        self.assertEqual(settlements[0]["paid_amount"], 500)
        self.assertEqual(settlements[0]["paid_date"], "2026-10-14")
        self.assertTrue(settlements[0]["settled_previous_cut"])


if __name__ == "__main__":
    unittest.main()
