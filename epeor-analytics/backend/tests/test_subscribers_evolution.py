import unittest
from unittest.mock import patch

from backend import main


class SubscribersEvolutionTests(unittest.TestCase):
    def test_latest_evolution_total_includes_all_typed_subscribers(self):
        subscribers = [
            {"NUMAB": "001", "TYPABON": "10"},
            {"NUMAB": "002", "TYPABON": "99"},
        ]

        with (
            patch.object(main, "MEM_ABONNES", subscribers),
            patch.object(main, "_current_period_bounds", return_value=(2026, 11)),
            patch.object(main, "_abonne_in_centre", return_value=True),
            patch.object(main, "_resolve_subscriber_join_date", return_value="20200101"),
            patch.object(main, "_abonment_state_by_numab", {}),
            patch.object(main, "factures_by_numab", {}),
        ):
            result = main._compute_subscribers_evolution()

        self.assertEqual(result["total"], len(subscribers))
        self.assertEqual(result["evolution"][-1]["count"], len(subscribers))


if __name__ == "__main__":
    unittest.main()
