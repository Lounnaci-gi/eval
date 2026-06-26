import re

ALLOWED_USER_UPDATE_COLUMNS = {
    "username",
    "display_name",
    "salt",
    "password",
    "allowed_sectors",
}

_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,32}$")
_PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$")


def build_safe_user_update_assignments(values: dict[str, object]) -> list[tuple[str, object]]:
    """Construit des assignments SQL sûrs pour les mises à jour utilisateur.

    Seuls les champs explicitement autorisés sont acceptés. Toute tentative de
    fournir un nom de colonne non listé lève une exception.
    """
    assignments: list[tuple[str, object]] = []
    for column, value in values.items():
        if column not in ALLOWED_USER_UPDATE_COLUMNS:
            raise ValueError(f"Colonne non autorisée pour mise à jour utilisateur: {column}")
        assignments.append((column, value))
    return assignments


def validate_username(username: str) -> str:
    """Valide et normalise un nom d'utilisateur."""
    normalized = (username or "").strip().lower()
    if not normalized:
        raise ValueError("Nom d'utilisateur requis")
    if not _USERNAME_RE.fullmatch(normalized):
        raise ValueError("Le nom d'utilisateur ne doit contenir que lettres, chiffres, underscore et faire 3 à 32 caractères")
    return normalized


def validate_password(password: str) -> str:
    """Valide un mot de passe selon une politique minimale simple."""
    if not password or len(password) < 8:
        raise ValueError("Le mot de passe doit faire au moins 8 caractères")
    if not _PASSWORD_RE.fullmatch(password):
        raise ValueError("Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre")
    return password
