// Hitch instrumentation (runs in the page before anything else). Splits the run into named
// segments (window.__seg(name)); per segment it keeps: frame gaps (own rAF loop), long tasks,
// shader compiles/links (with names and time spent waiting on them), texture uploads (count,
// bytes, time, biggest), draw calls per frame, 2D canvas rasterising time, live GPU texture bytes.
(() => {
  if (window.__H) return;
  const now = () => performance.now();
  const H = (window.__H = { segs: [], cur: null, ev: [], tex: new Map(), texBytes: 0, texCount: 0, kpsc: null, f: { up: 0, upB: 0, cv: 0, sh: 0, big: '' } });
  const newSeg = (name) => ({ name, t0: now(), gaps: [], lt: [], comp: 0, link: 0, names: [], shMs: 0, up: 0, upB: 0, upMs: 0, upMax: 0, upMaxWhat: '', hitches: [], sub: 0, subB: 0, draws: 0, drawsF: [], cvMs: 0, cvN: 0, frames: 0 });
  window.__seg = (name) => {
    if (H.cur) { H.cur.t1 = now(); H.cur.texEnd = [H.texBytes, H.texCount]; }
    H.cur = newSeg(name);
    H.segs.push(H.cur);
  };
  window.__seg('(page)');
  // seeded random: the same game choices run to run (timing can still move things a little)
  let s = 12345;
  Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  // frames
  let last = 0;
  const raf = (t) => {
    const a = now();
    if (last && H.cur && a - last > 50) { const f = H.f; const ld = document.querySelector('.art-loader, .boot-bar:not([hidden])') ? 'loader' : document.body.classList.contains('booting') ? 'booting' : document.querySelector('.bl-loading:not([hidden]), .curtain') ? 'curtain' : ''; H.cur.hitches.push([+((last - H.cur.t0) / 1000).toFixed(2), +(a - last).toFixed(0), +f.up.toFixed(0), +(f.upB / 1048576).toFixed(1), f.big, +f.cv.toFixed(0), +f.sh.toFixed(0), ld]); }
    H.f = { up: 0, upB: 0, cv: 0, sh: 0, big: '', bigMs: 0 };
    if (last && H.cur) { H.cur.gaps.push(a - last); H.cur.drawsF.push(H.cur.draws - (H.cur._d0 || 0)); H.cur._d0 = H.cur.draws; H.cur.frames++; }
    last = a;
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { const seg = H.segs.findLast((g) => g.t0 <= e.startTime) || H.cur; seg.lt.push(e.duration); } }).observe({ type: 'longtask', buffered: true });
  } catch {}
  const keyOf = (src) => { try { const L = window.game.textures.list; for (const k in L) { for (const so of L[k].source) if (so.image === src || so.source === src) return k; } } catch {} return '?'; };
  const wrap = (P, k, fn) => { const o = P[k]; if (!o) return; P[k] = function (...a) { return fn.call(this, o, a); }; };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    const P = C.prototype;
    const srcName = new WeakMap();
    const progName = new WeakMap();
    wrap(P, 'shaderSource', function (o, a) { const m = /SHADER_NAME (\S+)/.exec(a[1] || ''); srcName.set(a[0], m ? m[1] : '?' + (a[1] || '').length); return o.apply(this, a); });
    wrap(P, 'attachShader', function (o, a) { const n = srcName.get(a[1]); if (n && /FRAGMENT|\?/.test(n)) progName.set(a[0], n.replace(/__FRAGMENT$/, '')); return o.apply(this, a); });
    wrap(P, 'compileShader', function (o, a) { const t = now(); const r = o.apply(this, a); H.cur.comp++; H.cur.shMs += now() - t; H.f.sh += now() - t; return r; });
    wrap(P, 'linkProgram', function (o, a) { const t = now(); const r = o.apply(this, a); H.cur.link++; H.cur.names.push(progName.get(a[0]) || '?'); H.cur.shMs += now() - t; H.f.sh += now() - t; return r; });
    for (const k of ['getProgramParameter', 'getShaderParameter']) wrap(P, k, function (o, a) { const t = now(); const r = o.apply(this, a); H.cur.shMs += now() - t; H.f.sh += now() - t; return r; });
    // live texture bytes
    let unit = 0; const bound = new Map();
    wrap(P, 'activeTexture', function (o, a) { unit = a[0]; return o.apply(this, a); });
    wrap(P, 'bindTexture', function (o, a) { if (a[0] === 0x0de1) bound.set(unit, a[1]); return o.apply(this, a); });
    wrap(P, 'deleteTexture', function (o, a) { const b = H.tex.get(a[0]); if (b) { H.texBytes -= b; H.texCount--; H.tex.delete(a[0]); } return o.apply(this, a); });
    const dims = (a, sub) => {
      // texImage2D(target, level, ifmt, w, h, border, fmt, type, pixels) | (target, level, ifmt, fmt, type, source)
      // texSubImage2D(target, level, x, y, w, h, fmt, type, pixels) | (target, level, x, y, fmt, type, source)
      const srcIdx = sub ? 6 : 5;
      if (a.length === srcIdx + 1) { const s = a[srcIdx]; return [s.width || s.videoWidth || 0, s.height || s.videoHeight || 0, s.constructor && s.constructor.name]; }
      return sub ? [a[4], a[5], 'data'] : [a[3], a[4], 'data'];
    };
    wrap(P, 'texImage2D', function (o, a) {
      const [w, h, kind] = dims(a, false); const t = now(); const r = o.apply(this, a); const ms = now() - t; const b = w * h * 4;
      const seg = H.cur; seg.up++; seg.upB += b; seg.upMs += ms; if (ms > seg.upMax) { seg.upMax = ms; seg.upMaxWhat = `${w}x${h} ${kind}`; } H.f.up += ms; H.f.upB += b; if (ms > H.f.bigMs) { H.f.bigMs = ms; H.f.big = `${w}x${h}:${ms.toFixed(0)}` + (ms > 15 ? ':' + keyOf(a[a.length - 1]) : ''); }
      const tx = bound.get(unit); if (tx) { const old = H.tex.get(tx); if (old) H.texBytes -= old; else H.texCount++; H.tex.set(tx, b); H.texBytes += b; }
      return r;
    });
    wrap(P, 'texSubImage2D', function (o, a) {
      const [w, h] = dims(a, true); const t = now(); const r = o.apply(this, a); const ms = now() - t; const seg = H.cur; seg.sub++; seg.subB += w * h * 4; seg.upMs += ms; if (ms > seg.upMax) { seg.upMax = ms; seg.upMaxWhat = `sub ${w}x${h}`; } H.f.up += ms; H.f.upB += w * h * 4;
      return r;
    });
    for (const k of ['drawArrays', 'drawElements']) wrap(P, k, function (o, a) { H.cur.draws++; return o.apply(this, a); });
  }
  // 2D canvas rasterising (the drawing calls only; path building isn't timed)
  {
    const P = CanvasRenderingContext2D.prototype; let depth = 0;
    for (const k of ['fill', 'stroke', 'drawImage', 'fillText', 'strokeText', 'fillRect', 'getImageData', 'putImageData', 'clearRect']) {
      wrap(P, k, function (o, a) { if (depth) return o.apply(this, a); depth++; const t = now(); try { return o.apply(this, a); } finally { depth--; H.cur.cvMs += now() - t; H.f.cv += now() - t; H.cur.cvN++; } });
    }
  }
  // game events (to wait on), once the game exists
  const hook = () => {
    const g = window.game;
    if (!g || !g.events) return setTimeout(hook, 50);
    const e = g.events.emit;
    g.events.emit = function (name, ...a) { if (typeof name === 'string' && name !== 'step' && name !== 'prestep' && name !== 'poststep' && name !== 'prerender' && name !== 'postrender') H.ev.push([name, now()]); return e.call(this, name, ...a); };
    try { const gl = g.renderer.gl; H.kpsc = !!(gl && gl.getExtension('KHR_parallel_shader_compile')); } catch {}
  };
  hook();
  window.__sum = () => {
    if (H.cur) H.cur.t1 = now();
    const q = (arr, f) => { if (!arr.length) return 0; const s2 = [...arr].sort((x, y) => x - y); return s2[Math.min(s2.length - 1, Math.floor(s2.length * f))]; };
    return H.segs.filter((g) => g.name !== '(page)' || g.frames).map((g) => ({
      name: g.name, secs: +((g.t1 - g.t0) / 1000).toFixed(1), frames: g.frames,
      gapMax: +Math.max(0, ...g.gaps).toFixed(0), gapP99: +q(g.gaps, 0.99).toFixed(0), gapMed: +q(g.gaps, 0.5).toFixed(1), over50: g.gaps.filter((x) => x > 50).length, over100: g.gaps.filter((x) => x > 100).length,
      lt: g.lt.length, ltMax: +Math.max(0, ...g.lt).toFixed(0), ltSum: +g.lt.reduce((a, b) => a + b, 0).toFixed(0),
      comp: g.comp, link: g.link, names: g.names, shMs: +g.shMs.toFixed(1),
      up: g.up, upMB: +(g.upB / 1048576).toFixed(1), sub: g.sub, subMB: +(g.subB / 1048576).toFixed(2), upMs: +g.upMs.toFixed(0), upMax: +g.upMax.toFixed(1), upMaxWhat: g.upMaxWhat,
      drawsMed: q(g.drawsF, 0.5), drawsMax: Math.max(0, ...g.drawsF), cvMs: +g.cvMs.toFixed(0), cvN: g.cvN,
      hitches: g.hitches, evs: H.ev.filter((e) => e[1] >= g.t0 && e[1] <= g.t1).map((e) => e[0] + '@' + ((e[1] - g.t0) / 1000).toFixed(2)), texMB: +((g.texEnd ? g.texEnd[0] : H.texBytes) / 1048576).toFixed(1), texN: g.texEnd ? g.texEnd[1] : H.texCount,
    }));
  };
})();
