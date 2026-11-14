import json
import re

with open('F:/workout/scripts/inbody_ocr_raw.json', 'r', encoding='utf-8-sig') as f:
    items = json.load(f)

print(f"Total items: {len(items)}")

records = []

for idx, item in enumerate(items):
    text = item['text']

    # Date match: e.g. "08 · 26 · 2026 15 : 28" or "10 · 02 · 2026 12 : 35"
    d_m = re.search(r'(\d{2})\s*[\.·\/]\s*(\d{2})\s*[\.·\/]\s*(2026)\s+(\d{1,2})\s*:\s*(\d{2})', text)

    date_str = None
    time_str = None
    if d_m:
        m, d, y, hh, mm = d_m.groups()
        date_str = f"{y}-{m}-{d}"
        time_str = f"{int(hh):02d}:{mm}"

    # Weight: look near "體重" or "(kg)"
    # Usually lines:
    # 體重
    # (kg)
    # 60. 3
    w_match = re.search(r'體\s*重\s*\n\(kg\)\s*\n(\d{2}[\.·\s]+\d)', text)
    if not w_match:
        w_match = re.search(r'體\s*重\s*\(kg\)\s*(\d{2}[\.·\s]+\d)', text)
    if not w_match:
        w_match = re.search(r'體\s*重.*?(\d{2}\.\d)', text)

    # SMM: look near "骨骼肌重"
    # 骨骼肌重
    # (kg)
    # SMM
    # 29. 6
    smm_match = re.search(r'骨\s*骼\s*肌\s*重.*?(\d{2}[\.·\s]+\d)', text, re.DOTALL)

    # PBF:
    pbf_match = re.search(r'體\s*脂\s*肪\s*率.*?(\d{1,2}[\.·\s]+\d)', text, re.DOTALL)

    # InBody score: e.g. "77 / 100 分"
    score_match = re.search(r'(\d{2})\s*\/\s*100\s*分', text)

    print(f"[{idx}] file: {item['filename']} -> Date: {date_str} {time_str}")
    if not date_str:
        # print first 20 lines of text
        print("  Text header:", text[:150].replace('\n', ' | '))

print("Done scanning.")
