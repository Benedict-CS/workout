import json
import re

with open('F:/workout/scripts/raw_journal.md', 'r', encoding='utf-8') as f:
    text = f.read()

data = json.load(open('F:/workout/src/lib/db/seed-data.json', encoding='utf-8'))
seed_sessions = {s['id']: s for s in data['sessions']}
seed_sets = data['sets']

# Build exercise name map from seed
ex_name_map = {e['id']: e['name'] for e in data['exercises']}

details_blocks = re.findall(r'<details>([\s\S]*?)<\/details>', text)

missing_exercises = []

for block in details_blocks:
    m = re.search(r'<summary><b>(\d{1,2})\/(\d{1,2})\s*\((.*?)\)(.*?)<\/b><\/summary>', block)
    if not m:
        continue
    month = int(m.group(1))
    day = int(m.group(2))
    target = m.group(3).strip()
    rest = m.group(4).strip()
    date_str = f"2026-{month:02d}-{day:02d}"

    # Extract all exercise names from this markdown session block
    raw_ex_lines = [
        l.strip()
        for l in block.split('\n')
        if l.strip().startswith('- ')
        and ('：' in l or ':' in l)
        and not l.strip().startswith('- set')
        and not 'Kg' in l.split('：')[0].split(':')[0]
    ]

    clean_md_exercises = []
    for l in raw_ex_lines:
        clean = l.replace('- ', '').split('：')[0].split(':')[0].strip()
        clean = re.sub(r'\(.*?\)', '', clean).strip()
        clean = re.sub(r'（.*?）', '', clean).strip()
        clean_md_exercises.append(clean)

    # Find matching session in seed
    matching_seed = [s for s in data['sessions'] if s['date'] == date_str]
    if not matching_seed:
        print(f"Session completely missing in seed: {date_str} {target}")
        continue

    for ms in matching_seed:
        ms_sets = [st for st in seed_sets if st['session_id'] == ms['id']]
        seed_ex_names = set(ex_name_map.get(st['exercise_id'], '') for st in ms_sets)

        for cmd_ex in clean_md_exercises:
            # Check if this exercise exists in seed
            matched = any(cmd_ex in s_name or s_name in cmd_ex for s_name in seed_ex_names)
            if not matched:
                missing_exercises.append({
                    "date": date_str,
                    "session": ms['display_title'],
                    "missing_exercise": cmd_ex
                })

print(f"Total missing exercise occurrences in seed: {len(missing_exercises)}")
for item in missing_exercises:
    print(f"[{item['date']}] {item['session']} -> MISSING: {item['missing_exercise']}")
