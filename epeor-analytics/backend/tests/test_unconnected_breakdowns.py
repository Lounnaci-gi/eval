from backend import main


def test_build_unconnected_breakdowns_groups_only_etat_41_in_allowed_sectors(monkeypatch):
    monkeypatch.setattr(
        main,
        "quartier_to_commune",
        {"01": "10", "02": "20", "03": "10"},
    )
    subscribers = [
        {"NUMAB": "010001", "SECTEUR": "01", "TYPABON": "10"},
        {"NUMAB": "020001", "SECTEUR": "02", "TYPABON": "20"},
        {"NUMAB": "030001", "SECTEUR": "01", "TYPABON": "20"},
        {"NUMAB": "030002", "SECTEUR": "01", "TYPABON": ""},
    ]
    abonment_states = {
        "010001": "41",
        "020001": "41",
        "030001": "30",
        "030002": "41",
    }

    total, communes, types = main._build_unconnected_breakdowns(
        subscribers,
        abonment_states,
        {"10": "Commune A", "20": "Commune B"},
        {"10": "Ménages"},
        {"01"},
    )

    assert total == 2
    assert communes == [
        {"id": "10", "name": "Commune A", "value": 2, "percentage": 100.0},
        {"id": "20", "name": "Commune B", "value": 0, "percentage": 0},
    ]
    assert types == [
        {"code": "", "name": "Inconnu", "value": 1, "percentage": 50.0},
        {"code": "10", "name": "Ménages", "value": 1, "percentage": 50.0},
        {"code": "20", "name": "Autre (20)", "value": 0, "percentage": 0},
    ]
