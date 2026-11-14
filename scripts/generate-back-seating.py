"""Add rear seated poses through the existing sprite-gen row pipeline."""
from pathlib import Path
import concurrent.futures
import json
import subprocess
import threading
import sys

ROOT = Path(__file__).resolve().parents[1]
CLI = 'C:/Users/user/.codex/skills/sprite-gen/.venv/Scripts/sprite-gen.exe'
DIAGONAL = '--diagonal' in sys.argv
OUT = ROOT / ('sprites_run/diagonal-seating-v1' if DIAGONAL else 'sprites_run/back-seating-v1')
STOP = threading.Event()
HUMANS = ['cute_male_v2', 'strong_male_v2', 'blond_tan_male', 'soft_male', 'crossdress_male', 'pride_male', 'bear_male']
ANIMALS = ['shiba_dog', 'ginger_cat', 'red_squirrel', 'cream_rabbit']

def run(args, log):
    result = subprocess.run([CLI, *args], capture_output=True, text=True, encoding='utf-8')
    log.write(result.stdout + result.stderr)
    log.flush()
    if result.returncode:
        if result.returncode == 75 or 'codex-unavailable' in result.stderr or 'usage limit' in result.stderr.lower():
            STOP.set()
        raise RuntimeError(f'{args[0]} exit {result.returncode}; see {log.name}')

def prepare(character):
    animal = character in ANIMALS
    source = ROOT / (f'sprites_run/animals-v{20 if character in ANIMALS[2:] else 19}/{character}/rest-request.json' if animal else f'sprites_run/rest-v6/{character}/request.json')
    request = json.loads(source.read_text(encoding='utf-8-sig'))
    bench = ('Animal sitting on haunches on an invisible bench, front paws together on the seat, natural quadruped anatomy, tail visible. No human legs or hands.' if animal else 'Adult sitting on an invisible bench, torso upright, thighs horizontal, knees bent, lower legs hanging down. Rear of head, back of clothing and shoe heels visible. Hands rest on thighs.')
    floor = ('Animal sitting on haunches on invisible ground, front paws planted, natural quadruped anatomy, tail visible.' if animal else 'Adult sitting cross-legged on invisible ground. Buttocks on ground, knees spread, ankles crossed in front. Rear of head and back of clothing visible.')
    request['states'] = {
        key: {'fps': 3, 'frames': 4, 'loop': True, 'action': 'Strict REAR/BACK view, looking away from viewer toward screen top. Face is NOT visible. Already seated in every frame, no turning/standing transition. ' + action + ' Four subtle breathing poses, fixed head size and seated ground baseline. Preserve reference identity, hair, clothing, anatomy, proportions. Entire body including ears, tail and shoes visible. NO furniture, bench, scenery, shadow, text or extra characters.'}
        for key, action in [('up_sit', bench), ('up_floor_sit', floor)]
    }
    if DIAGONAL:
        posture = ('Natural small quadruped sitting on its haunches on an invisible bench, front paws together on the seat, entire tail and ears visible. No human hands, legs or upright human torso.' if animal else 'Fully clothed adult already seated on an invisible bench, pelvis supported by the seat, thighs horizontal, knees bent, lower legs hanging naturally, hands on thighs. Entire shoes and head visible.')
        request['states'] = {
            key: {'fps': 3, 'frames': 4, 'loop': True, 'action': direction + ' ' + posture + ' Four subtle breathing poses, same fixed hip contact and head size in every frame. Preserve exact reference identity, outfit, anatomy and scale. No stand-up or turning transition. No partner, bench, furniture, ground, shadow, text, effects or detached symbols. This is a calm seated rest loop.'}
            for key, direction in [
                ('diagonal_front_sit', 'Three-quarter FRONT-RIGHT view: character faces diagonally toward the BOTTOM RIGHT of the screen. Face/front and side are both visible. Legs/paws point bottom-right. Keep this exact diagonal direction throughout.'),
                ('diagonal_back_sit', 'Three-quarter REAR-RIGHT view: character faces diagonally toward the TOP RIGHT of the screen. Back of head and back/side of torso are visible, face is mostly hidden. Legs/paws point top-right. Keep this exact diagonal direction throughout.')
            ]
        }
    folder = OUT / character
    folder.mkdir(parents=True, exist_ok=True)
    if (folder / 'run/sprite-request.json').exists():
        return folder
    path = folder / 'request.json'
    path.write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')
    with (folder / 'prepare.log').open('w', encoding='utf-8') as log:
        run(['prepare', '--out-dir', str(folder / 'run'), '--character-id', character, '--base-image', request['character']['base_image'], '--request', str(path)], log)
    return folder

def generate(folder):
    if STOP.is_set():
        return False
    try:
        with (folder / 'generation.log').open('w', encoding='utf-8') as log:
            run(['gen-set', '--run-dir', str(folder / 'run'), '--provider', 'codex', '--model', 'gpt-5.6-sol', '--concurrency', '1'], log)
        print(f'GENERATED {folder.name}', flush=True)
        return True
    except RuntimeError as error:
        print(str(error), flush=True)
        return False

if __name__ == '__main__':
    folders = [prepare(character) for character in HUMANS + ANIMALS]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        success = list(pool.map(generate, folders))
    raise SystemExit(0 if all(success) else 1)
