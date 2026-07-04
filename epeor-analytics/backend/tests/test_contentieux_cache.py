import unittest
from unittest.mock import patch

import backend.main as main


class ContentieuxCacheTests(unittest.TestCase):
    def test_reuses_cached_creances_payload_for_same_request(self):
        main._invalidate_runtime_caches()
        sample_payload = {"subscribers": [], "tournees": []}

        with patch.object(main, "_compute_creances_abonnes_payload", return_value=sample_payload) as compute:
            first = main.get_creances_abonnes({"is_admin": True}, None)
            second = main.get_creances_abonnes({"is_admin": True}, None)

        self.assertEqual(first, sample_payload)
        self.assertEqual(second, sample_payload)
        self.assertEqual(compute.call_count, 1)


if __name__ == "__main__":
    unittest.main()
