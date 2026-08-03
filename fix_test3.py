import re

with open('tests/production-release-identity.test.mjs', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(r'\?: 44\)', r'\?: 45\)')

with open('tests/production-release-identity.test.mjs', 'w', encoding='utf-8') as f:
    f.write(c)
