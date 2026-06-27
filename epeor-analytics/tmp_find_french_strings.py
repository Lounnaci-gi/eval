import pathlib
import re
import ast
from collections import defaultdict

root = pathlib.Path('src/app')
pattern = re.compile(r'[éèêëàâîïôöûùçœæÉÈÊÀÔÛÇŒ]')
results = []
for path in root.rglob('*.tsx'):
    text = path.read_text(encoding='utf-8')
    try:
        tree = ast.parse(text)
    except SyntaxError:
        continue
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            val = node.value.strip()
            if pattern.search(val) and val:
                results.append((path, val))
        elif isinstance(node, ast.Str):
            val = node.s.strip()
            if pattern.search(val) and val:
                results.append((path, val))

by_file = defaultdict(set)
for f, val in results:
    by_file[str(f.relative_to(root))].add(val)

for f, vals in sorted(by_file.items(), key=lambda x: len(x[1]), reverse=True)[:30]:
    print(f, len(vals))
    for v in sorted(vals)[:20]:
        print('  ', v)
    print()
