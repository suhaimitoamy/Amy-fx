#!/usr/bin/env python3
import os
import re

ACADEMY_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../app/src/main/assets/apps/academy"))

def clean_html_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original = content

    # Clean unparsed wikilinks [[Text]] -> Text
    content = re.sub(r'\[\[([^\]]+)\]\]', r'\1', content)
    # Clean dangling ]] if left over
    content = content.replace(']]', '')

    # Clean callout syntax inside <p>> [!info] Ikhtisar<br> -> <p><strong>Ikhtisar:</strong><br>
    content = re.sub(r'>\s*\[!(info|tip|note|warning|caution)\]\s*(\w+)?', r'<strong>\2</strong>', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    count = 0
    modified_files = []
    for root, dirs, files in os.walk(ACADEMY_DIR):
        for file in files:
            if file.endswith('.html'):
                fp = os.path.join(root, file)
                if clean_html_file(fp):
                    count += 1
                    modified_files.append(os.path.relpath(fp, ACADEMY_DIR))

    print(f"Cleaned {count} HTML files in Academy.")
    for mf in modified_files[:10]:
        print(f" - {mf}")
    if len(modified_files) > 10:
        print(f" ... and {len(modified_files)-10} more files.")

if __name__ == '__main__':
    main()
