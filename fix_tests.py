import re

with open('tests/five-issues-regression.test.mjs', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(r'/\*\*Version code:\*\* `44`/', r'/\*\*Version code:\*\* `45`/')
c = c.replace('''const expected = update.latest_version_code === 45
    ? '1.5.4'
    : update.latest_version_code === 43
      ? '1.5.2'
      : '1.5.1';''', '''const expected = update.latest_version_code === 45
    ? '1.5.4'
    : update.latest_version_code === 44
      ? '1.5.3'
      : update.latest_version_code === 43
        ? '1.5.2'
        : '1.5.1';''')

with open('tests/five-issues-regression.test.mjs', 'w', encoding='utf-8') as f:
    f.write(c)

with open('tests/stage5-hardening.test.mjs', 'r', encoding='utf-8') as f:
    c2 = f.read()
    
c2 = c2.replace('''const expected = metadata.latest_version_code === 45
    ? '1.5.4'
    : metadata.latest_version_code === 43
      ? '1.5.2'
      : metadata.latest_version_code === 42''', '''const expected = metadata.latest_version_code === 45
    ? '1.5.4'
    : metadata.latest_version_code === 44
      ? '1.5.3'
      : metadata.latest_version_code === 43
        ? '1.5.2'
        : metadata.latest_version_code === 42''')

with open('tests/stage5-hardening.test.mjs', 'w', encoding='utf-8') as f:
    f.write(c2)

