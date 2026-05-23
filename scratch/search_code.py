import os

target_dir = r"D:\eval\epeor-analytics"
query = "creance"

for root, dirs, files in os.walk(target_dir):
    # Skip large/unrelated folders
    if any(p in root for p in [".next", "node_modules", "venv", "__pycache__"]):
        continue
    for file in files:
        if file.endswith((".py", ".tsx", ".ts", ".js", ".jsx", ".json")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                if query.lower() in content.lower():
                    print(f"Found in {path}")
                    # Print lines containing the query
                    lines = content.splitlines()
                    for idx, line in enumerate(lines):
                        if query.lower() in line.lower():
                            print(f"  Line {idx+1}: {line.strip()[:100]}")
            except Exception as e:
                pass
