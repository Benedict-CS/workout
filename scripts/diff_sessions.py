import json

with open('scripts/supa_sessions.json', 'r', encoding='utf-8') as f:
    supa = json.load(f)

with open('src/lib/db/seed-data.json', 'r', encoding='utf-8') as f:
    seed = json.load(f)

supa_ids = set(s['id'] for s in supa)
seed_ids = set(s['id'] for s in seed['sessions'])

diff = supa_ids - seed_ids
print("In Supabase but not in seed:", diff)
for s in supa:
    if s['id'] in diff:
        print("  ", s)
