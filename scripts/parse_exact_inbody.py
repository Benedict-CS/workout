import json
import re

with open('F:/workout/scripts/inbody_ocr_raw.json', 'r', encoding='utf-8-sig') as f:
    items = json.load(f)

def clean_num(s):
    if not s:
        return 0.0
    s = s.replace('·', '.').replace(' ', '').replace(',', '.')
    try:
        return float(s)
    except:
        return 0.0

extracted = []

for idx, item in enumerate(items):
    text = item['text']

    # Date
    d_m = re.search(r'(\d{2})\s*[\.·\/]\s*(\d{2})\s*[\.·\/]\s*(2026)\s+(\d{1,2})\s*:\s*(\d{2})', text)
    if not d_m:
        if 'll. 09. 2026 12 : 08' in text or 'll. 09. 2026' in text:
            m, d, y, hh, mm = "11", "09", "2026", "12", "08"
        else:
            print(f"FAILED date on {item['filename']}")
            continue
    else:
        m, d, y, hh, mm = d_m.groups()

    date_str = f"{y}-{m}-{d}"
    time_str = f"{int(hh):02d}:{mm}"

    # Weight
    # 60. 3 kg
    w = 0.0
    w_match = re.search(r'體\s*重\s*\n\(kg\)\s*\n(\d{2}[\.·\s]+\d)', text)
    if w_match:
        w = clean_num(w_match.group(1))
    else:
        # fallback: find in history section at bottom: 體重 \n (kg) 60.3
        w_fb = re.search(r'體\s*重\s*\(kg\)\s*(\d{2}[\.·\s]+\d)', text)
        if w_fb:
            w = clean_num(w_fb.group(1))

    # SMM (骨骼肌重)
    smm = 0.0
    smm_match = re.search(r'骨\s*骼\s*肌\s*重\s*\n\(kg\)\s*\nSMM\s*\n(\d{2}[\.·\s]+\d)', text)
    if not smm_match:
        smm_match = re.search(r'骨\s*骼\s*肌\s*重.*?(\d{2}[\.·\s]+\d)', text, re.DOTALL)
    if smm_match:
        smm = clean_num(smm_match.group(1))

    # PBF (體脂肪率)
    pbf = 0.0
    pbf_match = re.search(r'體\s*脂\s*肪\s*率.*?(\d{1,2}[\.·\s]+\d)\s*%', text, re.DOTALL)
    if not pbf_match:
        pbf_match = re.search(r'PBF.*?(\d{1,2}[\.·\s]+\d)', text, re.DOTALL)
    if pbf_match:
        pbf = clean_num(pbf_match.group(1))

    # Fat mass (體脂肪重)
    fat_mass = 0.0
    fat_match = re.search(r'體\s*脂\s*肪\s*重\s*\n\(kg\)\s*\n(\d{1,2}[\.·\s]+\d)', text)
    if fat_match:
        fat_mass = clean_num(fat_match.group(1))
    else:
        fat_mass = round((w * pbf) / 100, 1)

    # Score
    score = 77
    score_match = re.search(r'(\d{2})\s*\/\s*100\s*分', text)
    if score_match:
        score = int(score_match.group(1))

    timing = "morning" if int(hh) < 11 else "noon"
    cond = "早晨未吃 (穿衣)" if timing == "morning" else "中午飯後 (穿衣)"
    net_w = round(w - 0.7, 1)

    extracted.append({
        "id": f"inbody-{date_str}-{time_str.replace(':', '')}",
        "date": date_str,
        "time": time_str,
        "weight_kg": w,
        "skeletal_muscle_kg": smm,
        "body_fat_mass_kg": fat_mass,
        "body_fat_pct": pbf,
        "inbody_score": score,
        "timing": timing,
        "condition_label": cond,
        "estimated_net_weight_kg": net_w
    })

# Sort chronologically
extracted.sort(key=lambda x: (x['date'], x['time']))

print(f"Successfully extracted {len(extracted)} InBody records!")
for r in extracted:
    print(f"{r['date']} {r['time']}: Weight={r['weight_kg']}, SMM={r['skeletal_muscle_kg']}, PBF={r['body_fat_pct']}%, FatMass={r['body_fat_mass_kg']}, Score={r['inbody_score']}")

with open('F:/workout/src/lib/data/inbody_records.json', 'w', encoding='utf-8') as f:
    json.dump(extracted, f, ensure_ascii=False, indent=2)

with open('F:/workout/src/lib/db/inbody-data.json', 'w', encoding='utf-8') as f:
    json.dump(extracted, f, ensure_ascii=False, indent=2)

print("Saved cleanly to inbody_records.json and inbody-data.json!")
