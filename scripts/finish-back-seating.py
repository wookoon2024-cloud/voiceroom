"""Extract, inspect and install completed rear seating rows without custom slicing."""
from pathlib import Path
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CLI = 'C:/Users/user/.codex/skills/sprite-gen/.venv/Scripts/sprite-gen.exe'
pack = 'diagonal-seating-v1' if '--diagonal' in sys.argv else 'back-seating-v1'
states = ['diagonal_front_sit', 'diagonal_back_sit'] if '--diagonal' in sys.argv else ['up_sit', 'up_floor_sit']
for folder in sorted((ROOT / f'sprites_run/{pack}').iterdir()):
    run = folder / 'run'
    if not all((run / 'raw' / f'{state}.png').exists() for state in states):
        continue
    dest = ROOT / f'public/plaza/{pack}' / folder.name
    if (dest / 'manifest.json').exists():
        continue
    with (folder / 'finish.log').open('w', encoding='utf-8') as log:
        for command in [['extract'], ['compose-atlas'], ['compose-gif', '--out-dir', str(run / 'previews')], ['inspect']]:
            result = subprocess.run([CLI, *command, '--run-dir', str(run)], capture_output=True, text=True, encoding='utf-8')
            log.write(result.stdout + result.stderr)
            if result.returncode:
                raise RuntimeError(f'{folder.name} {command[0]} failed; see {log.name}')
    manifest = json.loads((run / 'manifest.json').read_text(encoding='utf-8'))
    assert set(manifest['animation']['rows']) == set(states)
    dest.mkdir(parents=True, exist_ok=True)
    for name in ['manifest.json', 'sprite-sheet-alpha.png']:
        shutil.copy2(run / name, dest / name)
    print(f'INSTALLED {folder.name}', flush=True)
