import json

with open('src/lib/db/seed-data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

print('Total sets:', len(d['sets']))
ex_map = {e['id']: e['name'] for e in d['exercises']}
pull_exs = [e for e in d['exercises'] if '引體' in e['name']]
print('Pullup exercises:', pull_exs)

for pe in pull_exs:
    sets_for_pe = [s for s in d['sets'] if s['exercise_id'] == pe['id']]
    print(f"{pe['name']} ({pe['id']}): {len(sets_for_pe)} sets")
    # print first 5 sets
    for s in sets_for_pe[:5]:
        print("  ", s.get('session_id'), s.get('weight_kg'), s.get('reps'), s.get('raw_text'))
