from pathlib import Path
lines = Path('src/app/components/ServiceContentieuxView.tsx').read_text(encoding='utf-8').splitlines()
for i in range(880, 966):
    print(f'{i+1}: {lines[i]}')
