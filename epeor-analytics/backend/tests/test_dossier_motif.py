import os
import tempfile
import unittest

from backend import main as main_module


class DossierMotifPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp_dir.cleanup)
        self.original_auth_db_path = main_module.AUTH_DB_PATH
        main_module.AUTH_DB_PATH = os.path.join(self.tmp_dir.name, "users.db")
        main_module._init_auth_db()

    def tearDown(self):
        main_module.AUTH_DB_PATH = self.original_auth_db_path

    def test_dossier_motif_is_persisted_and_retrieved(self):
        payload = main_module.DossierJuridiqueUpdate(
            statut_abonne="Suspendu",
            etape_recouvrement="Amiable",
            motif="Paiement non effectué",
        )

        result = main_module.update_dossier_juridique(
            "12345",
            payload,
            _user={"username": "test"},
        )

        self.assertEqual(result["success"], True)

        saved = main_module.get_dossier_juridique(
            "12345",
            _user={"username": "test"},
        )
        self.assertEqual(saved["motif"], "Paiement non effectué")


if __name__ == "__main__":
    unittest.main()
