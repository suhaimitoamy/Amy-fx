import os
import glob
import re

def fix(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        c = f.read()
    
    new_c = c.replace(
        '47:C2:32:BC:45:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7',
        '47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7'
    )
    
    if c != new_c:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_c)
        print(f"Fixed {filepath}")

for wf in glob.glob('.github/workflows/*.yml'):
    fix(wf)

for t in glob.glob('tests/*.mjs'):
    fix(t)

