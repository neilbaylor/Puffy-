"""Run after changing outlined text in src/ui/style.css:
    python3 scripts/old_safari_css.py src/ui/style.css src/ui/oldSafari.css
Makes outline fallbacks for browsers that draw -webkit-text-stroke over the letters (no paint-order on HTML text)."""
import re, sys, math
src = open(sys.argv[1]).read()
src_nc = re.sub(r'/\*.*?\*/', '', src, flags=re.S)

def rules(text, media=None):
    i = 0; out = []
    while i < len(text):
        j = text.find('{', i)
        if j < 0: break
        head = text[i:j].strip()
        depth = 1; k = j + 1
        while depth:
            if text[k] == '{': depth += 1
            elif text[k] == '}': depth -= 1
            k += 1
        body = text[j+1:k-1]
        if head.startswith('@media') or head.startswith('@supports'):
            out += rules(body, head)
        elif not head.startswith('@'):
            out.append((media, head, body))
        i = k
    return out

def decl(body, prop):
    m = None
    for m_ in re.finditer(r'(?:^|;)\s*' + re.escape(prop) + r'\s*:\s*([^;]+)', body): m = m_
    return m.group(1).strip() if m else None

def ring(width, color):
    m = re.fullmatch(r'([\d.]+)(px|em)', width)
    n, unit = float(m.group(1)), m.group(2)
    r = n / 2  # with paint-order: stroke fill only the outer half shows
    pts = []
    for a in range(16):
        t = a * math.pi / 8
        x, y = r * math.cos(t), r * math.sin(t)
        fmt = (lambda v: f'{round(v, 2):g}px') if unit == 'px' else (lambda v: f'{round(v, 4):g}em')
        pts.append(f'{fmt(x)} {fmt(y)} 0 {color}')
    if r > (3 if unit == 'px' else 0.03):  # fill the gaps of a wide ring
        for a in range(8):
            t = a * math.pi / 4 + math.pi / 8
            pts.append(f'{fmt(r*0.6*math.cos(t))} {fmt(r*0.6*math.sin(t))} 0 {color}')
    return ', '.join(pts)

out = ['/* Generated from style.css by scripts/old_safari_css.py (see core/oldSafari.ts): outlines as text-shadow rings for */',
       '/* browsers that paint -webkit-text-stroke over the letters (Safari 16 and older ignore paint-order on HTML text). */']
for media, sel, body in rules(src_nc):
    stroke = decl(body, '-webkit-text-stroke')
    if stroke is None: continue
    sels = ', '.join('html.no-po ' + s.strip() for s in sel.split(','))
    if stroke == '0' or stroke.startswith('0 '):
        css = f'{sels} {{ text-shadow: {decl(body, "text-shadow") or "none"}; }}'
    else:
        w, *c = stroke.split(None, 1)
        color = c[0] if c else 'currentColor'
        shadow = decl(body, 'text-shadow')
        rs = ring(w, color) + (', ' + shadow if shadow and shadow != 'none' else '')
        css = f'{sels} {{ -webkit-text-stroke: 0; text-shadow: {rs}; }}'
    out.append(f'{media} {{ {css} }}' if media else css)
# rules that only set a text-shadow on something an outlined rule covers (a compound or a descendant of
# it): the ring rules above would win (or the child's own shadow would drop the inherited ring): add the ring
stroked = [(m, sl.strip(), decl(b, '-webkit-text-stroke')) for m, se, b in rules(src_nc) if decl(b, '-webkit-text-stroke') for sl in se.split(',')]
for media, sel, body in rules(src_nc):
    sh = decl(body, 'text-shadow')
    if not sh or decl(body, '-webkit-text-stroke') is not None: continue
    for s1 in (x.strip() for x in sel.split(',')):
        best = max((st for st in stroked if st[0] == media and s1 != st[1] and s1.startswith(st[1]) and re.match(r'[.:\s\[]', s1[len(st[1]):])), key=lambda st: len(st[1]), default=None)
        if not best or best[2] == '0': continue
        w, *c = best[2].split(None, 1)
        rs = ring(w, c[0] if c else 'currentColor') + ('' if sh == 'none' else ', ' + sh)
        css = f'html.no-po {s1} {{ text-shadow: {rs}; }}'
        out.append(f'{media} {{ {css} }}' if media else css)
open(sys.argv[2], 'w').write('\n'.join(out) + '\n')
print(len(out) - 2, 'rules')
