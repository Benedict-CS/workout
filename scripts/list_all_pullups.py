import re

with open('scripts/raw_journal.md', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
current_summary = ""

for idx, line in enumerate(lines):
    if '<summary>' in line:
        current_summary = line.strip()
    if '引體' in line and ('-' in line or '<' in line or 'set' in line):
        print(f"Line {idx+1:4d} | {current_summary[:35]:35s} | {line.strip()}")
