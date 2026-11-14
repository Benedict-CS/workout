import json

with open('src/lib/db/seed-data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for date in ['2026-11-10', '2026-11-05', '2026-11-02', '2026-10-29']:
    sess = [s for s in d['sessions'] if s['date'] == date]
    print(f"=== Date: {date} ===")
    for s in sess:
        print(f"  Session ID: {s['id']}, Title: {s['display_title']}, Target: {s['target_muscle']}")
        sess_sets = [st for st in d['sets'] if st['session_id'] == s['id']]
        print(f"  Sets count: {len(sess_sets)}")
        ex_names = {}
        for st in sess_sets:
            ex_id = st['exercise_id']
            ex_obj = next((e for e in d['exercises'] if e['id'] == ex_id), None)
            name = ex_obj['name'] if ex_obj else ex_id
            ex_names[name] = ex_names.get(name, 0) + 1
        for name, cnt in ex_names.items():
            print(f"    - {name}: {cnt} sets")
