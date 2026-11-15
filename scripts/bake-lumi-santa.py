"""Use sprite-gen's tolerance palette bake; preserve every original motion rectangle."""
from pathlib import Path
import json, subprocess

ROOT=Path(__file__).resolve().parents[1]
CLI=Path('C:/Users/user/.codex/skills/sprite-gen/.venv/Scripts/sprite-gen.exe')
WORK=ROOT/'sprites_run/christmas-activities/palettes'
WORK.mkdir(parents=True,exist_ok=True)
PACKS={'base':'roster-v5','rest':'rest-v6','floor':'floor-rest-v6','back':'back-seating-v1','diagonal':'diagonal-seating-v1'}
for pack,folder in PACKS.items():
    source=ROOT/'public/plaza'/folder/'soft_male'
    manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
    palette=WORK/(pack+'.json')
    if not palette.exists():
        subprocess.run([str(CLI),'recolor-palette','--base',str(source/manifest['sprite_sheet_alpha']),'--out',str(palette)],check=True)
    colors=json.loads(palette.read_text(encoding='utf-8'))['colors']
    # Cluster neighbouring soft-edge shades before using the engine's tolerance bake.
    # This avoids tens of thousands of redundant full-sheet exact-color passes.
    mapping={}
    for color in colors:
        r,g,b=color['rgb']
        if b>r+8 and g>r+3 and b>g+2:
            r,g,b=(min(255,round(v/24)*24) for v in (r,g,b))
            mapping['#%02x%02x%02x'%(r,g,b)]='#%02x%02x%02x'%(min(255,round(b*.96)),round(g*.30),round(r*.36))
    spec=WORK/(pack+'-spec.json')
    spec.write_text(json.dumps({'version':1,'kind':'sprite-gen-recolor','match':'tolerance','tolerance':12,'variants':[{'name':'santa','map':mapping}]}),encoding='utf-8')
    output=ROOT/'public/plaza/lumi-santa-v1'/pack
    output.mkdir(parents=True,exist_ok=True)
    subprocess.run([str(CLI),'recolor','--base',str(source/manifest['sprite_sheet_alpha']),'--spec',str(spec),'--manifest',str(source/'manifest.json'),'--out-dir',str(output)],check=True)
    print(json.dumps({'pack':pack,'paletteColors':len(colors),'coatColors':len(mapping)}),flush=True)
