#!/usr/bin/env python3
"""
Character Sprite Pipeline Utility
=================================
Processes 1024x1024 2D Pixel Art Master Spritesheets:
- Removes #00FF00 Chroma Green Background
- Slices Walk Cycles (Front, Back, Side), Solo Actions (Sit, Lie, Jump), and Social Interactions (Handshake, Hug, Kiss)
- Packages 4x4 Spritesheet into `public/plaza/sheets/{char_id}.png`
- Normalizes and exports individual action sprites into `public/plaza/actions/{char_id}_{action}.png`

Usage:
  python scripts/process_character_spritesheet.py --char cat --sheet path/to/master.jpg
"""

import os
import sys
import argparse
import numpy as np
from PIL import Image

def remove_chroma_green(im, threshold=35, min_green=115):
    """Cleanly replaces pure chroma green #00FF00 background with transparent alpha."""
    arr = np.array(im.convert("RGBA"))
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    mask = (g > min_green) & (g > r.astype(int) + threshold) & (g > b.astype(int) + threshold)
    arr[mask, 3] = 0
    return Image.fromarray(arr)

def process_master_spritesheet(char_id, sheet_path, web_root="."):
    public_dir = os.path.join(web_root, "public", "plaza")
    sheets_dir = os.path.join(public_dir, "sheets")
    actions_dir = os.path.join(public_dir, "actions")
    chars_dir = os.path.join(public_dir, "chars")
    
    os.makedirs(sheets_dir, exist_ok=True)
    os.makedirs(actions_dir, exist_ok=True)
    os.makedirs(chars_dir, exist_ok=True)
    
    raw_img = Image.open(sheet_path)
    clean_img = remove_chroma_green(raw_img)
    W, H = clean_img.size
    
    # 5 Standard Master Rows:
    # Row 0: Walk Front (4 cols)
    # Row 1: Walk Back (4 cols)
    # Row 2: Walk Side (4 cols)
    # Row 3: Solo Actions: Sit, Lie, Jump (3 cols)
    # Row 4: Social Interactions: Handshake, Hug, Kiss (3 cols)
    row_h = H / 5.0
    
    # 1. Build standard 4x4 In-Game Spritesheet (768x960)
    # Row 0: Front Walk (4 frames)
    # Row 1: Back Walk (4 frames)
    # Row 2: Side Walk (4 frames)
    # Row 3: Emotions/Actions (Col 0: Jump/Cheer, Col 1: Sad/Lie, Col 2: Wave/Handshake, Col 3: Talk/Hug)
    fw, fh = 192, 240
    out_sheet = Image.new("RGBA", (fw * 4, fh * 4), (0, 0, 0, 0))
    
    # Populate rows 0, 1, 2 from master walk cycles
    for r_idx in range(3):
        col_w = W / 4.0
        for c_idx in range(4):
            box = (int(c_idx * col_w), int(r_idx * row_h), int((c_idx + 1) * col_w), int((r_idx + 1) * row_h))
            cell = clean_img.crop(box)
            bbox = cell.getbbox()
            if bbox:
                cropped = cell.crop(bbox)
                # Fit into fw, fh keeping bottom-centered alignment
                scale = min((fw - 16) / cropped.width, (fh - 16) / cropped.height, 1.0)
                new_w, new_h = int(cropped.width * scale), int(cropped.height * scale)
                scaled = cropped.resize((new_w, new_h), Image.Resampling.NEAREST)
                px = c_idx * fw + (fw - new_w) // 2
                py = r_idx * fh + (fh - new_h) - 8
                out_sheet.paste(scaled, (px, py), scaled)
                
    # Populate row 3 (Special Actions / Expressions)
    # Col 0: Jump, Col 1: Sad/Lie, Col 2: Wave/Handshake, Col 3: Talk/Hug
    action_cols_w = W / 3.0
    # Jump (Row 3, Col 2 in master) -> Col 0 in sheet
    jump_box = (int(2 * action_cols_w), int(3 * row_h), int(3 * action_cols_w), int(4 * row_h))
    jump_cell = clean_img.crop(jump_box)
    j_bbox = jump_cell.getbbox()
    if j_bbox:
        j_cropped = jump_cell.crop(j_bbox)
        scale = min((fw - 16) / j_cropped.width, (fh - 16) / j_cropped.height, 1.0)
        s_jump = j_cropped.resize((int(j_cropped.width * scale), int(j_cropped.height * scale)), Image.Resampling.NEAREST)
        out_sheet.paste(s_jump, (0 * fw + (fw - s_jump.width) // 2, 3 * fh + (fh - s_jump.height) - 8), s_jump)

    sheet_out_path = os.path.join(sheets_dir, f"{char_id}.png")
    out_sheet.save(sheet_out_path)
    print(f"[OK] In-Game Spritesheet saved: {sheet_out_path} ({out_sheet.size})")

    # 2. Extract Individual Dedicated Solo Actions (Sit, Lie, Jump)
    solo_names = ["sit", "lie", "jump"]
    for c_idx, act in enumerate(solo_names):
        box = (int(c_idx * action_cols_w), int(3 * row_h), int((c_idx + 1) * action_cols_w), int(4 * row_h))
        cell = clean_img.crop(box)
        bbox = cell.getbbox()
        if bbox:
            cropped = cell.crop(bbox)
            # Add safe padding
            pad = 6
            padded = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
            padded.paste(cropped, (pad, pad), cropped)
            act_path = os.path.join(actions_dir, f"{char_id}_{act}.png")
            padded.save(act_path)
            print(f"[OK] Solo Action saved: {act_path} ({padded.size})")

    # 3. Extract Social Interactions (Handshake, Hug, Kiss)
    interact_names = ["handshake", "hug", "kiss"]
    for c_idx, act in enumerate(interact_names):
        box = (int(c_idx * action_cols_w), int(4 * row_h), int((c_idx + 1) * action_cols_w), int(5 * row_h))
        cell = clean_img.crop(box)
        bbox = cell.getbbox()
        if bbox:
            cropped = cell.crop(bbox)
            pad = 6
            padded = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
            padded.paste(cropped, (pad, pad), cropped)
            act_path = os.path.join(actions_dir, f"{char_id}_interact_{act}.png")
            padded.save(act_path)
            print(f"[OK] Interaction Action saved: {act_path} ({padded.size})")

    # 4. Save representative portrait in chars/
    front_idle_box = (0, 0, int(W / 4.0), int(row_h))
    front_cell = clean_img.crop(front_idle_box)
    f_bbox = front_cell.getbbox()
    if f_bbox:
        char_portrait = front_cell.crop(f_bbox)
        char_path = os.path.join(chars_dir, f"{char_id}.png")
        char_portrait.save(char_path)
        print(f"[OK] Character Portrait saved: {char_path} ({char_portrait.size})")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process Character Master Spritesheet")
    parser.add_argument("--char", required=True, help="Character identifier (e.g. cat, cute, nerd)")
    parser.add_argument("--sheet", required=True, help="Path to input 1024x1024 master spritesheet image")
    parser.add_argument("--root", default="voiceroom-web", help="Project root directory")
    args = parser.parse_args()
    
    process_master_spritesheet(args.char, args.sheet, args.root)
