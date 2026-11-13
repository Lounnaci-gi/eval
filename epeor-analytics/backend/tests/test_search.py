import unittest
from unittest.mock import patch

from backend import main


class SubscriberSearchTests(unittest.TestCase):
    def test_search_matches_comma_separated_criteria_across_fields(self):
        record = {
            "NUMAB": "B32621",
            "NOM": "AISSA AHMED",
            "CODRUE": "7",
            "SECTEUR": "01",
            "TOURNEE": "008",
        }

        with (
            patch.object(main, "rues_by_codrue", {"7": {"NOUVNOM": "Cité 400 logements"}}),
            patch.object(main, "abonments_by_numab", {"B32621": {"NUMSER": "020215814"}}),
            patch.object(main, "tabcodes_by_code", {}),
            patch.object(main, "search_index_list", [main._build_search_index_entry(record)]),
            patch.object(main, "factures_by_numab", {}),
        ):
            results = main.search_subscribers(
                _user={"is_admin": True},
                query="B32, Aissa, 020215814, cité 400, 008",
            )

        self.assertEqual([result["NUMAB"] for result in results], ["B32621"])

    def test_search_requires_every_comma_separated_criterion_to_match(self):
        record = {
            "NUMAB": "B32621",
            "NOM": "AISSA AHMED",
            "SECTEUR": "01",
        }

        with (
            patch.object(main, "rues_by_codrue", {}),
            patch.object(main, "abonments_by_numab", {"B32621": {"NUMSER": "020215814"}}),
            patch.object(main, "tabcodes_by_code", {}),
            patch.object(main, "search_index_list", [main._build_search_index_entry(record)]),
            patch.object(main, "factures_by_numab", {}),
        ):
            results = main.search_subscribers(
                _user={"is_admin": True},
                query="B32, introuvable",
            )

        self.assertEqual(results, [])

    def test_search_matches_multiple_partial_address_terms(self):
        record = {
            "NUMAB": "123",
            "NOM": "Abonné",
            "CODRUE": "7",
            "SECTEUR": "01",
        }

        with (
            patch.object(main, "rues_by_codrue", {"7": {"NOUVNOM": "Cité Ben Ali 483"}}),
            patch.object(main, "abonments_by_numab", {}),
            patch.object(main, "tabcodes_by_code", {}),
            patch.object(main, "search_index_list", [main._build_search_index_entry(record)]),
            patch.object(main, "factures_by_numab", {}),
        ):
            results = main.search_subscribers(
                _user={"is_admin": True},
                query="ben ali cite 483",
            )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["NUMAB"], "123")

    def test_search_matches_check_payment_reference_but_not_receipt_number(self):
        record = {"NUMAB": "123", "NOM": "Abonné", "SECTEUR": "01"}
        invoices = {
            "123": [
                {"NUMREC": "VERSEMENT-9021", "CHEQUE": "CHEQUE-4837"},
            ],
        }

        with (
            patch.object(main, "rues_by_codrue", {}),
            patch.object(main, "abonments_by_numab", {}),
            patch.object(main, "tabcodes_by_code", {}),
            patch.object(main, "factures_by_numab", invoices),
            patch.object(main, "search_index_list", [main._build_search_index_entry(record)]),
        ):
            check_results = main.search_subscribers(
                _user={"is_admin": True},
                query="4837",
            )
            receipt_results = main.search_subscribers(
                _user={"is_admin": True},
                query="9021",
            )

        self.assertEqual([result["NUMAB"] for result in check_results], ["123"])
        self.assertEqual(receipt_results, [])


if __name__ == "__main__":
    unittest.main()
