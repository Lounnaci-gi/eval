import os
import tempfile
import unittest
from unittest.mock import patch

from backend import main


class DataLoadCacheTests(unittest.TestCase):
    def test_dbf_is_iterated_instead_of_loaded_all_at_once(self):
        with tempfile.TemporaryDirectory() as cache_dir:
            dbf_path = os.path.join(cache_dir, "ABONNE.DBF")
            with open(dbf_path, "wb"):
                pass

            records = [{"NUMAB": "123"}]
            with (
                patch.object(main, "CACHE_DIR", cache_dir),
                patch.object(main, "resolve_dbf_path", return_value=dbf_path),
                patch.object(main, "DBF", return_value=iter(records)) as dbf_reader,
            ):
                loaded_records = main.load_table_cached("ABONNE.DBF")

            self.assertEqual(loaded_records, records)
            dbf_reader.assert_called_once_with(
                dbf_path,
                load=False,
                encoding="cp1256",
                char_decode_errors="ignore",
            )

    def test_cache_write_replaces_file_only_after_pickle_is_complete(self):
        with tempfile.TemporaryDirectory() as cache_dir:
            cache_path = os.path.join(cache_dir, "factures.pkl")
            with open(cache_path, "wb") as cache_file:
                cache_file.write(b"previous cache")

            records = [{"NUMAB": "123"}]
            with patch.object(main.pickle, "dump", side_effect=OSError("disk full")):
                with self.assertRaisesRegex(OSError, "disk full"):
                    main._write_pickle_cache(cache_path, records)

            with open(cache_path, "rb") as cache_file:
                self.assertEqual(cache_file.read(), b"previous cache")
            self.assertEqual(os.listdir(cache_dir), ["factures.pkl"])

    def test_cache_write_replaces_old_file_with_versioned_data(self):
        with tempfile.TemporaryDirectory() as cache_dir:
            cache_path = os.path.join(cache_dir, "factures.pkl")
            with open(cache_path, "wb") as cache_file:
                cache_file.write(b"previous cache")

            records = [{"NUMAB": str(index)} for index in range(5)]
            with patch.object(main, "_CACHE_CHUNK_SIZE", 2):
                main._write_pickle_cache(cache_path, records)

            with open(cache_path, "rb") as cache_file:
                cached_version, cached_records = main._read_pickle_cache(cache_file)
            self.assertEqual(cached_version, main._CACHE_VERSION)
            self.assertEqual(cached_records, records)
            self.assertEqual(os.listdir(cache_dir), ["factures.pkl"])


if __name__ == "__main__":
    unittest.main()
