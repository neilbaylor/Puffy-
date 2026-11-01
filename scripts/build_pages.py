"""Assemble the shareable single-page builds in sketches/:
  - world-sketches.html : concept sketches page (needs `npx vite build -c vite.sketches.config.ts`)
  - puffy-game.html     : the whole game as one page (needs `npm run build:single`)
Both are written as page fragments (no <html>/<head>/<body>) for hosting as a claude.ai artifact.
"""
import base64, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
sk = root / 'sketches'

# ── world sketches ──
tpl = (sk / 'page.template.html').read_text()
js = (root / 'dist-sketches/sketches.js').read_text()
img = base64.b64encode((sk / 'ingame.jpg').read_bytes()).decode()
src = (root / 'src/sketches/worlds.ts').read_text()
block = src[src.index('export const WORLDS'):]
worlds = re.findall(r"id: '([^']+)',\s*name: '([^']+)',\s*mood: '([^']+)',\s*palette: \[([^\]]+)\],\s*mechanics: \[([^\]]+)\],\s*enemies: '([^']+)'", block)
cards = []
for i, (wid, name, mood, pal, mech, en) in enumerate(worlds):
    pal = re.findall(r"'(#[0-9a-fA-F]+)'", pal)
    mech = re.findall(r"'([^']+)'", mech)
    tag = ' <span class="tag">Level 1</span>' if wid == 'sunny-hills' else ''
    cards.append(f'''    <article class="world" id="{wid}">
      <div class="frame"><canvas data-world="{wid}" width="1280" height="560" aria-label="Sketch of {name}"></canvas></div>
      <div class="meta">
        <div><h2><span class="num">{i+1:02d}</span>{name}{tag}</h2><p class="mood">{mood}</p>
          <div class="swatches">{''.join(f'<i style="background:{c}" title="{c}"></i>' for c in pal)}</div></div>
        <dl class="facts"><dt>Signature hazards</dt><dd><ul>{''.join(f'<li>{m}</li>' for m in mech)}</ul></dd>
          <dt>Enemies</dt><dd>{en}</dd></dl>
      </div>
    </article>''')
html = tpl.replace('__WORLDS__', '\n'.join(cards)).replace('__INGAME__', img).replace('__JS__', js.replace('</script', '<\\/script'))
(sk / 'world-sketches.html').write_text(html)

# ── look development ──
LOOKS = [
    ('storybook', 'Crayon storybook', 'Closest to the original drawings: graphite pencil lines and crayon-colored fills with the paper showing through.',
     'Feels like the drawings came to life', 'Busier texture; small details can get noisy on a phone'),
    ('polished', 'Polished hand-drawn', 'Cleaner, rounder shapes with soft shading and a shine, but the lines still wobble and a fine crayon grain stays in the color.',
     'Reads well at small sizes and still feels hand-made', 'Less of the original crayon charm'),
    ('watercolor', 'Ink & watercolor', 'Loose brush-ink lines that swell and break, with watercolor washes bleeding a little past the lines.',
     'Most artistic and distinctive', 'Softer edges; enemies and platforms can be harder to spot'),
    ('sticker', 'Bold sticker', 'Chunky outlines and bright flat color with one hard shadow and a shine.',
     'Most readable and punchy on a phone', 'Least hand-drawn; closer to a typical mobile game'),
]
ltpl = (sk / 'lookdev.template.html').read_text()
ljs = (root / 'dist-lookdev/lookdev.js').read_text()
lcards = []
for i, (sid, name, blurb, pro, con) in enumerate(LOOKS):
    tag = ' <span class="tag">In game now</span>' if sid == 'polished' else ''
    lcards.append(f'''    <article class="opt" id="{sid}">
      <div class="frame"><canvas data-scene="{sid}" width="1200" height="520" aria-label="Sunny Hills with Puffy in the {name} style"></canvas></div>
      <div class="frame"><canvas data-giant="{sid}" width="1200" height="520" aria-label="{name} style: Puffy says WOW at a giant Mega Puff surrounded by Puffballs"></canvas></div>
      <div class="strip"><canvas data-heroes="{sid}" width="1200" height="200" aria-label="{name} style heroes: Puffy, Scruffy and Big Muscles idle, running, hurt"></canvas></div>
      <div class="strip"><canvas data-baddies="{sid}" width="1200" height="200" aria-label="{name} style bad guys: Puffball walking and squashed, Big Puff calm and angry"></canvas></div>
      <div class="meta">
        <div><h2><span class="letter">{'ABCD'[i]}</span>{name}{tag}</h2><p class="blurb">{blurb}</p></div>
        <dl class="pc"><dt>Good</dt><dd>{pro}</dd><dt>Watch out</dt><dd>{con}</dd></dl>
      </div>
    </article>''')
b64 = lambda f: base64.b64encode((sk / f).read_bytes()).decode()
(sk / 'look-development.html').write_text(
    ltpl.replace('__CARDS__', '\n'.join(lcards)).replace('__SKETCH1__', b64('puffy-sketch-1.jpg')).replace('__SKETCH2__', b64('puffy-sketch-2.jpg'))
    .replace('__SKETCH3__', b64('baddie-sketch-1.jpg')).replace('__SKETCH4__', b64('baddie-sketch-2.jpg')).replace('__SKETCH5__', b64('giant-sketch.jpg')).replace('__SKETCH6__', b64('scruffy-sketch.jpg')).replace('__SKETCH7__', b64('muscles-sketch.jpg')).replace('__SKETCH8__', b64('muscles-hurt-sketch.jpg'))
    .replace('__JS__', ljs.replace('</script', '<\\/script')))

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
print('wrote', len(worlds), 'world cards and the game page')
