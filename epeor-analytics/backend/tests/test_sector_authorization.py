import os
import tempfile
import unittest

from fastapi import HTTPException

from backend import main as main_module


class SectorAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp_dir.cleanup)
        self.original_auth_db_path = main_module.AUTH_DB_PATH
        self.original_abonnes_by_numab = main_module.abonnes_by_numab
        main_module.AUTH_DB_PATH = os.path.join(self.tmp_dir.name, "users.db")
        main_module.abonnes_by_numab = {
            "IN-SECTOR": {"NUMAB": "IN-SECTOR", "SECTEUR": "01"},
            "OUT-OF-SECTOR": {"NUMAB": "OUT-OF-SECTOR", "SECTEUR": "02"},
        }
        main_module._init_auth_db()
        self.user = {"username": "limited", "is_admin": False, "allowed_sectors": ["01"]}

    def tearDown(self):
        main_module.AUTH_DB_PATH = self.original_auth_db_path
        main_module.abonnes_by_numab = self.original_abonnes_by_numab

    def test_individual_dossier_routes_reject_out_of_sector_and_unknown_subscribers(self):
        requests = (
            lambda numab: main_module.get_dossier_juridique(numab, _user=self.user),
            lambda numab: main_module.update_dossier_juridique(
                numab,
                main_module.DossierJuridiqueUpdate(
                    statut_abonne="Actif",
                    etape_recouvrement="Amiable",
                ),
                _user=self.user,
            ),
            lambda numab: main_module.update_legal_status(
                numab,
                main_module.LegalStatusUpdate(is_contentieux=True),
                _user=self.user,
            ),
            lambda numab: main_module.generate_pdf_declaration_creance(
                numab, _user=self.user
            ),
            lambda numab: main_module.generate_pdf_mise_en_demeure(
                numab, _user=self.user
            ),
        )

        for numab in ("OUT-OF-SECTOR", "UNKNOWN"):
            for request in requests:
                with self.subTest(numab=numab, request=request):
                    with self.assertRaises(HTTPException) as raised:
                        request(numab)
                    self.assertEqual(raised.exception.status_code, 403)

        with main_module._get_auth_conn() as conn:
            self.assertEqual(
                conn.execute("SELECT COUNT(*) FROM legal_status").fetchone()[0],
                0,
            )
            self.assertEqual(
                conn.execute("SELECT COUNT(*) FROM dossiers_juridiques").fetchone()[0],
                0,
            )

    def test_dossier_list_filters_out_of_sector_and_unverifiable_rows(self):
        with main_module._get_auth_conn() as conn:
            conn.executemany(
                "INSERT INTO legal_status (numab, is_contentieux) VALUES (?, 1)",
                [("IN-SECTOR",), ("OUT-OF-SECTOR",), ("UNKNOWN",)],
            )
            conn.commit()

        result = main_module.get_all_dossiers(_user=self.user)

        self.assertEqual(
            [dossier["numab"] for dossier in result["dossiers"]],
            ["IN-SECTOR"],
        )

    def test_user_can_access_subscriber_in_allowed_sector(self):
        dossier = main_module.get_dossier_juridique("IN-SECTOR", _user=self.user)
        self.assertEqual(dossier["numab"], "IN-SECTOR")

        result = main_module.update_dossier_juridique(
            "IN-SECTOR",
            main_module.DossierJuridiqueUpdate(
                statut_abonne="Actif",
                etape_recouvrement="Amiable",
            ),
            _user=self.user,
        )
        self.assertTrue(result["success"])


if __name__ == "__main__":
    unittest.main()
