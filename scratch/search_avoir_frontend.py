import os

path = r"D:\eval\epeor-analytics\src\app\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
for idx, line in enumerate(lines):
    if "avoir" in line.lower():
        print(f"Line {idx+1}: {line.strip()[:100]}")
