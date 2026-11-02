from datetime import date, datetime


_EMPTY_DATE_VALUES = frozenset({"", "        ", "19000101", "00000000", None})


def _parse_payment_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    raw = str(value or "").strip()
    if raw in _EMPTY_DATE_VALUES:
        return None
    for date_format in ("%Y%m%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, date_format).date()
        except ValueError:
            continue
    return None


def _classify_payment_history(payment_dates, as_of_date=None):
    unique_dates = sorted(set(payment_dates))
    if not unique_dates:
        return {
            "level": 5,
            "classification": "Non payeur",
            "last_payment": None,
            "days_since_last_payment": None,
            "average_gap_days": None,
            "maximum_gap_days": None,
            "payment_count": 0,
        }

    as_of_date = as_of_date or date.today()
    gaps = [(later - earlier).days for earlier, later in zip(unique_dates, unique_dates[1:])]
    average_gap = sum(gaps) / len(gaps) if gaps else 0
    days_since_last = max(0, (as_of_date - unique_dates[-1]).days)
    worst_gap = max(average_gap, days_since_last)

    if worst_gap <= 45:
        level, classification = 1, "Bon payeur"
    elif worst_gap <= 75:
        level, classification = 2, "Payeur régulier"
    elif worst_gap <= 120:
        level, classification = 3, "Retardataire"
    elif worst_gap <= 240:
        level, classification = 4, "Mauvais payeur"
    else:
        level, classification = 5, "Non payeur"

    return {
        "level": level,
        "classification": classification,
        "last_payment": unique_dates[-1].isoformat(),
        "days_since_last_payment": days_since_last,
        "average_gap_days": round(average_gap, 1),
        "maximum_gap_days": max(gaps) if gaps else 0,
        "payment_count": len(unique_dates),
    }
