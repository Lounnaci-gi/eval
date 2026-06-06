"""Nettoyeur de projet — supprime caches et artefacts reconstruisibles.
Usage: python scripts/cleanup.py
"""
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGETS = [
    ROOT / "backend" / "cache",
    ROOT / "backend" / "__pycache__",
    ROOT / ".next",
    ROOT / "tsconfig.tsbuildinfo",
]

EXTRA_PATTERNS = ["*.pyc", "*.pkl", "__pycache__"]


def remove_path(p: Path):
    if not p.exists():
        return
    try:
        if p.is_dir():
            shutil.rmtree(p)
            print(f"Removed directory: {p}")
        else:
            p.unlink()
            print(f"Removed file: {p}")
    except Exception as e:
        print(f"Failed to remove {p}: {e}")


def main():
    print(f"Project root: {ROOT}")
    for t in TARGETS:
        remove_path(t)

    # Walk tree to remove patterns
    for dirpath, dirnames, filenames in os.walk(ROOT):
        pdir = Path(dirpath)
        # remove pyc/pkl files
        for fname in filenames:
            if fname.endswith('.pyc') or fname.endswith('.pkl'):
                fp = pdir / fname
                try:
                    fp.unlink()
                    print(f"Removed file: {fp}")
                except Exception as e:
                    print(f"Failed to remove {fp}: {e}")

        # remove any __pycache__ dirs encountered
        for d in list(dirnames):
            if d == '__pycache__':
                dp = pdir / d
                try:
                    shutil.rmtree(dp)
                    print(f"Removed directory: {dp}")
                except Exception as e:
                    print(f"Failed to remove {dp}: {e}")

if __name__ == '__main__':
    main()
