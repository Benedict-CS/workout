import json

with open('scripts/inbody_ocr_raw.json', 'r', encoding='utf-8-sig') as f:
    items = json.load(f)

for idx, item in enumerate(items):
    text = item['text']
    history_idx = text.find('身 體 組 成 歷 程 紀 錄')
    print(f"=== ITEM {idx}: {item['filename']} ===")
    if history_idx != -1:
        print(text[history_idx:history_idx+400])
    else:
        print("NO HISTORY SECTION")
