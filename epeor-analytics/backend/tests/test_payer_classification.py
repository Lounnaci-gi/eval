from datetime import date
import unittest

from backend.main import _classify_payment_history, _parse_payment_date


class PayerClassificationTests(unittest.TestCase):
    def test_no_payment_is_classified_as_non_payer(self):
        result = _classify_payment_history([], date(2026, 10, 22))

        self.assertEqual(result["level"], 5)
        self.assertEqual(result["classification"], "Non payeur")
        self.assertIsNone(result["days_since_last_payment"])
        self.assertIsNone(result["average_gap_days"])
        self.assertIsNone(result["maximum_gap_days"])

    def test_single_payment_uses_elapsed_days_and_has_no_gap(self):
        result = _classify_payment_history([date(2026, 9, 7)], date(2026, 10, 22))

        self.assertEqual(result["level"], 1)
        self.assertEqual(result["days_since_last_payment"], 45)
        self.assertEqual(result["average_gap_days"], 0)
        self.assertEqual(result["maximum_gap_days"], 0)
        self.assertEqual(result["payment_count"], 1)

    def test_classification_uses_average_gap_and_deduplicates_same_day_payments(self):
        result = _classify_payment_history(
            [date(2026, 8, 23), date(2026, 10, 22), date(2026, 10, 22)],
            date(2026, 10, 22),
        )

        self.assertEqual(result["level"], 2)
        self.assertEqual(result["average_gap_days"], 60)
        self.assertEqual(result["maximum_gap_days"], 60)
        self.assertEqual(result["payment_count"], 2)

    def test_classification_thresholds_are_inclusive_and_non_payer_is_over_240_days(self):
        as_of_date = date(2026, 10, 22)
        expected_levels = [
            (45, 1),
            (75, 2),
            (120, 3),
            (240, 4),
            (241, 5),
        ]

        for elapsed_days, expected_level in expected_levels:
            with self.subTest(elapsed_days=elapsed_days):
                result = _classify_payment_history(
                    [date.fromordinal(as_of_date.toordinal() - elapsed_days)],
                    as_of_date,
                )
                self.assertEqual(result["level"], expected_level)

    def test_payment_date_parser_accepts_dbf_date_formats_and_ignores_empty_values(self):
        self.assertEqual(_parse_payment_date("20261022"), date(2026, 10, 22))
        self.assertEqual(_parse_payment_date("2026-10-22"), date(2026, 10, 22))
        self.assertIsNone(_parse_payment_date(None))
        self.assertIsNone(_parse_payment_date("00000000"))
        self.assertIsNone(_parse_payment_date("invalid"))


if __name__ == "__main__":
    unittest.main()
