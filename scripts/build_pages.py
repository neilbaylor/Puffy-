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
