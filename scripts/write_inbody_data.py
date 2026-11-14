import json

records = [
    {
        "id": "inbody-2026-08-26-1528",
        "date": "2026-08-26",
        "time": "15:28",
        "weight_kg": 60.3,
        "skeletal_muscle_kg": 29.6,
        "body_fat_mass_kg": 7.8,
        "body_fat_pct": 12.9,
        "inbody_score": 77,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 59.6
    },
    {
        "id": "inbody-2026-08-28-1211",
        "date": "2026-08-28",
        "time": "12:11",
        "weight_kg": 59.6,
        "skeletal_muscle_kg": 28.5,
        "body_fat_mass_kg": 8.8,
        "body_fat_pct": 14.8,
        "inbody_score": 76,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 58.9
    },
    {
        "id": "inbody-2026-09-02-1237",
        "date": "2026-09-02",
        "time": "12:37",
        "weight_kg": 59.3,
        "skeletal_muscle_kg": 28.2,
        "body_fat_mass_kg": 8.9,
        "body_fat_pct": 15.0,
        "inbody_score": 76,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 58.6
    },
    {
        "id": "inbody-2026-09-09-1213",
        "date": "2026-09-09",
        "time": "12:13",
        "weight_kg": 59.0,
        "skeletal_muscle_kg": 28.0,
        "body_fat_mass_kg": 9.1,
        "body_fat_pct": 15.4,
        "inbody_score": 75,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 58.3
    },
    {
        "id": "inbody-2026-09-11-0852",
        "date": "2026-09-11",
        "time": "08:52",
        "weight_kg": 59.8,
        "skeletal_muscle_kg": 28.7,
        "body_fat_mass_kg": 8.5,
        "body_fat_pct": 14.2,
        "inbody_score": 76,
        "timing": "morning",
        "condition_label": "早晨未吃 (穿衣)",
        "estimated_net_weight_kg": 59.1
    },
    {
        "id": "inbody-2026-09-23-1212",
        "date": "2026-09-23",
        "time": "12:12",
        "weight_kg": 60.1,
        "skeletal_muscle_kg": 28.9,
        "body_fat_mass_kg": 9.1,
        "body_fat_pct": 15.1,
        "inbody_score": 77,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 59.4
    },
    {
        "id": "inbody-2026-10-02-1211",
        "date": "2026-10-02",
        "time": "12:11",
        "weight_kg": 61.8,
        "skeletal_muscle_kg": 29.2,
        "body_fat_mass_kg": 9.8,
        "body_fat_pct": 15.9,
        "inbody_score": 78,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 61.1
    },
    {
        "id": "inbody-2026-10-13-1239",
        "date": "2026-10-13",
        "time": "12:39",
        "weight_kg": 62.2,
        "skeletal_muscle_kg": 29.1,
        "body_fat_mass_kg": 10.5,
        "body_fat_pct": 16.9,
        "inbody_score": 77,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 61.5
    },
    {
        "id": "inbody-2026-10-16-1213",
        "date": "2026-10-16",
        "time": "12:13",
        "weight_kg": 63.0,
        "skeletal_muscle_kg": 29.9,
        "body_fat_mass_kg": 9.9,
        "body_fat_pct": 15.7,
        "inbody_score": 79,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 62.3
    },
    {
        "id": "inbody-2026-10-21-1207",
        "date": "2026-10-21",
        "time": "12:07",
        "weight_kg": 63.7,
        "skeletal_muscle_kg": 30.0,
        "body_fat_mass_kg": 10.4,
        "body_fat_pct": 16.3,
        "inbody_score": 78,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 63.0
    },
    {
        "id": "inbody-2026-10-28-1221",
        "date": "2026-10-28",
        "time": "12:21",
        "weight_kg": 64.4,
        "skeletal_muscle_kg": 29.7,
        "body_fat_mass_kg": 11.5,
        "body_fat_pct": 17.9,
        "inbody_score": 77,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 63.7
    },
    {
        "id": "inbody-2026-10-29-1210",
        "date": "2026-10-29",
        "time": "12:10",
        "weight_kg": 64.3,
        "skeletal_muscle_kg": 30.0,
        "body_fat_mass_kg": 11.1,
        "body_fat_pct": 17.3,
        "inbody_score": 78,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 63.6
    },
    {
        "id": "inbody-2026-11-02-1213",
        "date": "2026-11-02",
        "time": "12:13",
        "weight_kg": 64.5,
        "skeletal_muscle_kg": 29.6,
        "body_fat_mass_kg": 11.7,
        "body_fat_pct": 18.2,
        "inbody_score": 76,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 63.8
    },
    {
        "id": "inbody-2026-11-04-1215",
        "date": "2026-11-04",
        "time": "12:15",
        "weight_kg": 64.8,
        "skeletal_muscle_kg": 30.0,
        "body_fat_mass_kg": 11.7,
        "body_fat_pct": 18.0,
        "inbody_score": 77,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 64.1
    },
    {
        "id": "inbody-2026-11-09-1208",
        "date": "2026-11-09",
        "time": "12:08",
        "weight_kg": 65.0,
        "skeletal_muscle_kg": 30.0,
        "body_fat_mass_kg": 11.6,
        "body_fat_pct": 17.9,
        "inbody_score": 77,
        "timing": "noon",
        "condition_label": "中午飯後 (穿衣)",
        "estimated_net_weight_kg": 64.3
    },
    {
        "id": "inbody-2026-11-12-0909",
        "date": "2026-11-12",
        "time": "09:09",
        "weight_kg": 64.2,
        "skeletal_muscle_kg": 29.9,
        "body_fat_mass_kg": 11.2,
        "body_fat_pct": 17.5,
        "inbody_score": 77,
        "timing": "morning",
        "condition_label": "早晨未吃 (穿衣)",
        "estimated_net_weight_kg": 63.5
    },
    {
        "id": "inbody-2026-11-13-0912",
        "date": "2026-11-13",
        "time": "09:12",
        "weight_kg": 64.0,
        "skeletal_muscle_kg": 30.0,
        "body_fat_mass_kg": 10.9,
        "body_fat_pct": 17.0,
        "inbody_score": 78,
        "timing": "morning",
        "condition_label": "早晨未吃 (穿衣)",
        "estimated_net_weight_kg": 63.3
    }
]

# Write to both JSON locations
with open('F:/workout/src/lib/data/inbody_records.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

with open('F:/workout/src/lib/db/inbody-data.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print("Saved 17 verified InBody records cleanly to inbody_records.json and inbody-data.json")
