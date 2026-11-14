"""Extract, inspect and install completed rear seating rows without custom slicing."""
from pathlib import Path
import json
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CLI = 'C:/Users/user/.codex/skills/sprite-gen/.venv/Scripts/sprite-gen.exe'
for folder in sorted((ROOT / 'sprites_run/back-seating-v1').iterdir()):
    run = folder / 'run'
    if not all((run / 'raw' / f'{state}.png').exists() for state in ['up_sit', 'up_floor_sit']):
        continue
    dest = ROOT / 'public/plaza/back-seating-v1' / folder.name
    if (dest / 'manifest.json').exists():
        continue
    with (folder / 'finish.log').open('w', encoding='utf-8') as log:
        for command in [['extract'], ['compose-atlas'], ['compose-gif', '--out-dir', str(run / 'previews')], ['inspect']]:
            result = subprocess.run([CLI, *command, '--run-dir', str(run)], capture_output=True, text=True, encoding='utf-8')
            log.write(result.stdout + result.stderr)
            if result.returncode:
                raise RuntimeError(f'{folder.name} {command[0]} failed; see {log.name}')
    manifest = json.loads((run / 'manifest.json').read_text(encoding='utf-8'))
    assert set(manifest['animation']['rows']) == {'up_sit', 'up_floor_sit'}
    dest.mkdir(parents=True, exist_ok=True)
    for name in ['manifest.json', 'sprite-sheet-alpha.png']:
        shutil.copy2(run / name, dest / name)
    print(f'INSTALLED {folder.name}', flush=True)
