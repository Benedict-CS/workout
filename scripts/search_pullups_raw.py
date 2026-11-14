import re

with open('scripts/raw_journal.md', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
current_date = ""
current_summary = ""
in_pullup = False

pullup_occurrences = []

for idx, line in enumerate(lines):
    if '<summary>' in line:
        current_summary = line
    if '引體' in line:
        # print surrounding context
        ctx = lines[max(0, idx-2):min(len(lines), idx+8)]
        pullup_occurrences.append((idx, current_summary, '\n'.join(ctx)))

print(f"Total occurrences of '引體': {len(pullup_occurrences)}")
for i, s, c in pullup_occurrences[:10]:
    print(f"--- Line {i}: {s} ---")
    print(c)
    print()
