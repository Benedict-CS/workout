import json

with open('scripts/inbody_ocr_raw.json', 'r', encoding='utf-8-sig') as f:
    items = json.load(f)

for idx in [1, 2, 3, 5]:
    item = items[idx]
    print(f"=== {idx}: {item['filename']} ===")
    for line in item['text'].split('\n'):
        if any(w in line for w in ['60.', '59.', '28.', '29.', '15.', '14.', '12.', '38.', '37.', '36.', 'kg']):
            print('  ', line.strip())
