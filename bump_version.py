import os
import glob
import re

def replace_in_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new)
        
    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

# Update .github/workflows
for wf in glob.glob('.github/workflows/*.yml'):
    replace_in_file(wf, [
        ('1.5.3', '1.5.4'),
        ('44', '45')
    ])

# Update tests
for test_file in glob.glob('tests/*.mjs'):
    with open(test_file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    new_content = content
    # Handle version strings
    new_content = new_content.replace('1.5.3', '1.5.4')
    new_content = new_content.replace('1\\.5\\.3', '1\\.5\\.4')
    
    # Be careful with 44, only replace when it looks like a versionCode
    # e.g., 'code: 44', 'latest_version_code === 44', 'latest_version_code <= 44', 'includes(metadata.latest_version_code)'
    new_content = re.sub(r'code: 44', 'code: 45', new_content)
    new_content = re.sub(r'versionCode[^\n]*44', lambda m: m.group(0).replace('44', '45'), new_content)
    new_content = re.sub(r'latest_version_code === 44', 'latest_version_code === 45', new_content)
    new_content = re.sub(r'latest_version_code <= 44', 'latest_version_code <= 45', new_content)
    new_content = re.sub(r'AMYFX_VERSION_CODE: "44"', 'AMYFX_VERSION_CODE: "45"', new_content)
    new_content = re.sub(r'latest_version_code\': 44', 'latest_version_code\': 45', new_content)
    new_content = re.sub(r'\[40, 41, 42, 43, 44\]', '[40, 41, 42, 43, 44, 45]', new_content)
    new_content = re.sub(r'\[42, 43, 44\]', '[42, 43, 44, 45]', new_content)
    new_content = re.sub(r'\?: 44\)', '?: 45)', new_content)
    new_content = re.sub(r'\*\*Version code:\*\* `44`', '**Version code:** `45`', new_content)
    new_content = re.sub(r'default: "44"', 'default: "45"', new_content)

    if content != new_content:
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {test_file}")

# Update README
if os.path.exists('README.md'):
    replace_in_file('README.md', [
        ('1.5.3', '1.5.4'),
        ('Version code:** `44`', 'Version code:** `45`')
    ])

