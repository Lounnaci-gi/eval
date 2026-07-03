from pathlib import Path
from collections import Counter

path = Path('src/app/components/ServiceContentieuxView.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
print('total lines', len(lines))
start = next((i for i, l in enumerate(lines) if 'export function ServiceContentieuxView' in l), None)
print('start line', start+1 if start is not None else None)
for i in range(930, 971):
    if i < len(lines):
        print(f'{i+1}: {lines[i]}')

def count_symbols(s, symbols):
    return {sym: s.count(sym) for sym in symbols}

for i in range(930, 971):
    if i < len(lines):
        row = lines[i]
        if any(sym in row for sym in '{}()<>'):
            print(f'{i+1} counts {count_symbols(row, ["{","}","(",")","<","> "])}')

# simple nesting counters from start of function
count = 0
for i, line in enumerate(lines[start:], start+1):
    for ch in line:
        if ch == '{': count += 1
        elif ch == '}': count -= 1
    if i >= 930 and i <= 970:
        print(f'line {i} depth {count}')
    if count == 0 and i > start:
        print('function closes at', i)
        break
