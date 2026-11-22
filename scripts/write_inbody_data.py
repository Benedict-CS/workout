import json

with open('src/lib/data/inbody_records.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

with open('src/lib/data/inbody_records.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

with open('src/lib/db/inbody-data.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Verified {len(records)} InBody records in both inbody_records.json and inbody-data.json")
