"""Assemble the shareable single-page builds in sketches/:
  - art.html        : every asset + world looks (needs `esbuild src/artpage/main.ts --bundle --format=iife --outfile=dist-art/art.js`)
  - puffy-game.html : the whole game as one page (needs `npm run build:single`)
Both are written as page fragments (no <html>/<head>/<body>) for hosting as a claude.ai artifact.
"""
import base64, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
sk = root / 'sketches'

# ── art & assets page (polished hand-drawn only) ──
LOOKS = [
    ('puff', 'Puff Ball Planet', 'Marshmallow earth, mint puff-moss, dandelion puffs and a ringed planet. The current look.', True),
    ('meadow', 'Meadow morning', 'Fresh blue sky, bright green hills, golden and pink puff trees.', False),
    ('candy', 'Candy clouds', 'Pastel cloud-kingdom sky, minty hills, pink and lilac puff trees.', False),
    ('golden', 'Golden hour', 'Warm late-afternoon light, peachy sky, sun-baked hills.', False),
]
SHOTS = [
    ('shot-lobby.jpg', 'Pick your player (Android tablet size)'),
    ('shot-tablet.jpg', 'Puff Ball Planet with a floating nuggie'),
    ('shot-giant.jpg', 'A Giant slamming down on someone sneaking under'),
    ('shot-hoops.jpg', 'The free-throw contest (iPad size)'),
]
SKETCHES = ['puffy-sketch-1.jpg', 'puffy-sketch-2.jpg', 'scruffy-sketch.jpg', 'muscles-sketch.jpg', 'muscles-hurt-sketch.jpg', 'baddie-sketch-1.jpg', 'baddie-sketch-2.jpg', 'giant-sketch.jpg', 'king-sketch.jpg', 'meters-sketch.jpg', 'goat-sketch.jpg']
b64 = lambda f: base64.b64encode((sk / f).read_bytes()).decode()
tpl = (sk / 'art.template.html').read_text()
js = (root / 'dist-art/art.js').read_text()
looks = '\n'.join(
    f'''      <article class="look"><div class="frame"><canvas data-look="{lid}" aria-label="Puff Ball Planet in the {name} look"></canvas></div>
        <div><h3>{name}{' <span class="tag">In game now</span>' if cur else ''}</h3><p class="note">{blurb}</p></div></article>'''
    for lid, name, blurb, cur in LOOKS)
shots = '\n'.join(f'      <figure><div class="frame"><img alt="{cap}" src="data:image/jpeg;base64,{b64(f)}"></div><figcaption>{cap}</figcaption></figure>' for f, cap in SHOTS if (sk / f).exists())
sketches = '\n'.join(f'      <img alt="Original sketch" src="data:image/jpeg;base64,{b64(f)}">' for f in SKETCHES)
(sk / 'art.html').write_text(tpl.replace('__LOOKS__', looks).replace('__SHOTS__', shots).replace('__SKETCHES__', sketches).replace('__JS__', js.replace('</script', '<\\/script')))

# ── single-page game ──
s = (root / 'dist-single/index.html').read_text()
head = s[s.index('<head>') + 6:s.rindex('</head>')]
body = s[s.rindex('<body>') + 6:s.rindex('</body>')]
head = re.sub(r'<meta charset[^>]*>\s*', '', head, count=1)
head = re.sub(r'<meta\s+name="viewport".*?/>\s*', '', head, count=1, flags=re.S)
head = head.replace('<title>Puffy</title>', '', 1)
m = re.search(r'<script type="module" crossorigin>.*</script>', head, flags=re.S)
head = head[:m.start()] + head[m.end():]
(sk / 'puffy-game.html').write_text('<title>Puffy</title>\n' + head + body + m.group(0))
print('wrote art page and game page')
