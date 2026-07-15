import os
import tempfile
import unittest
from fastapi import HTTPException

from backend import main as main_module


class TransmissionValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp_dir.cleanup)
        self.original_auth_db_path = main_module.AUTH_DB_PATH
        main_module.AUTH_DB_PATH = os.path.join(self.tmp_dir.name, "users.db")
        main_module._init_auth_db()

    def tearDown(self):
        main_module.AUTH_DB_PATH = self.original_auth_db_path

    def test_cannot_remove_transmission_if_dossier_is_at_tribunal(self):
        # 1. Initialize a dossier with transmis_cours = 1 (Enregistrement au tribunal)
        dossier_payload = main_module.DossierJuridiqueUpdate(
            statut_abonne="Actif",
            etape_recouvrement="Judiciaire",
            transmis_cours=True,
        )
        main_module.update_dossier_juridique(
            "AB123",
            dossier_payload,
            _user={"username": "test"},
        )

        # 2. Try to retire transmission (is_contentieux = False) -> should raise 400 HTTPException
        status_payload = main_module.LegalStatusUpdate(is_contentieux=False)
        with self.assertRaises(HTTPException) as ctx:
            main_module.update_legal_status(
                "AB123",
                status_payload,
                _user={"username": "test"},
            )
        
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Enregistrement au tribunal", ctx.exception.detail)

    def test_can_remove_transmission_if_dossier_is_not_at_tribunal(self):
        # 1. Initialize a dossier with transmis_cours = 0
        dossier_payload = main_module.DossierJuridiqueUpdate(
            statut_abonne="Actif",
            etape_recouvrement="Amiable",
            transmis_cours=False,
        )
        main_module.update_dossier_juridique(
            "AB456",
            dossier_payload,
            _user={"username": "test"},
        )

        # 2. Try to retire transmission (is_contentieux = False) -> should succeed
        status_payload = main_module.LegalStatusUpdate(is_contentieux=False)
        result = main_module.update_legal_status(
            "AB456",
            status_payload,
            _user={"username": "test"},
        )
        
        self.assertEqual(result["success"], True)

    def test_can_set_transmission_even_if_dossier_is_at_tribunal(self):
        # 1. Initialize a dossier with transmis_cours = 1
        dossier_payload = main_module.DossierJuridiqueUpdate(
            statut_abonne="Actif",
            etape_recouvrement="Judiciaire",
            transmis_cours=True,
        )
        main_module.update_dossier_juridique(
            "AB789",
            dossier_payload,
            _user={"username": "test"},
        )

        # 2. Try to set transmission (is_contentieux = True) -> should succeed
        status_payload = main_module.LegalStatusUpdate(is_contentieux=True)
        result = main_module.update_legal_status(
            "AB789",
            status_payload,
            _user={"username": "test"},
        )
        
        self.assertEqual(result["success"], True)


if __name__ == "__main__":
    unittest.main()
