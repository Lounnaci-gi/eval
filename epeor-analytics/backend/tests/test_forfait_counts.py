from backend.main import _collect_forfait_records_from_abonments


def test_collect_forfait_records_from_abonments_uses_abonment_state():
    abonments = {
        "1": {"ETATCPT": "20", "TYPABON": "10", "CENTRE": "01"},
        "2": {"ETATCPT": "30", "TYPABON": "10", "CENTRE": "01"},
        "3": {"ETATCPT": "20", "TYPABON": "20", "CENTRE": "02"},
    }
    abonnes = {
        "1": {"SECTEUR": "01", "TYPABON": "10"},
        "3": {"SECTEUR": "02", "TYPABON": "20"},
    }

    records = _collect_forfait_records_from_abonments(abonments, abonnes, "01")

    assert records == [{"NUMAB": "1", "TYPABON": "10", "CENTRE": "01"}]
