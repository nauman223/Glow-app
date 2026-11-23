"""Safety check for bundled sticker SVGs. Usage: python -I check.py <stickers dir>."""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SVG_NS = '{http://www.w3.org/2000/svg}'
FORBIDDEN_TAGS = {'script', 'foreignObject', 'image', 'style', 'use', 'a', 'iframe', 'feImage', 'animate', 'set'}
LOCAL_URL = re.compile(r'url\(#([A-Za-z][\w-]*)\)')

failures = []
total = 0
count = 0
for path in sorted(Path(sys.argv[1]).rglob('*.svg')):
    raw = path.read_bytes()
    total += len(raw)
    count += 1
    text = raw.decode('utf-8')
    problems = []
    if '<!DOCTYPE' in text or '<!ENTITY' in text or '<?xml-stylesheet' in text:
        problems.append('doctype/entity/stylesheet PI')
    try:
        root = ET.fromstring(text)
    except ET.ParseError as error:
        failures.append(f'{path}: XML parse error {error}')
        continue
    if root.tag != SVG_NS + 'svg':
        problems.append('root is not svg')
    if root.get('viewBox') is None:
        problems.append('no viewBox')
    ids = {el.get('id') for el in root.iter() if el.get('id')}
    for el in root.iter():
        tag = el.tag.replace(SVG_NS, '')
        if not el.tag.startswith(SVG_NS):
            problems.append(f'foreign namespace element {el.tag}')
        if tag in FORBIDDEN_TAGS:
            problems.append(f'forbidden <{tag}>')
        for name, value in el.attrib.items():
            local = name.split('}')[-1]
            if local.lower().startswith('on'):
                problems.append(f'event attribute {local}')
            if local in ('href', 'style') or name.startswith('{http://www.w3.org/1999/xlink}'):
                problems.append(f'forbidden attribute {local}')
            if 'url(' in value:
                stripped = LOCAL_URL.sub('', value)
                if 'url(' in stripped:
                    problems.append(f'non-local url() in {local}')
                for ref in LOCAL_URL.findall(value):
                    if ref not in ids:
                        problems.append(f'dangling url(#{ref})')
            if re.search(r'(javascript|data|https?):', value, re.I):
                problems.append(f'scheme in {local}')
    if len(raw) > 2048:
        problems.append(f'{len(raw)} bytes > 2 KB')
    for problem in problems:
        failures.append(f'{path}: {problem}')

print(f'{count} files, {total} bytes')
print('\n'.join(failures) if failures else 'all checks passed')
sys.exit(1 if failures else 0)
