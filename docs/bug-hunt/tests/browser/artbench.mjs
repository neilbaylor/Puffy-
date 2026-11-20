// usage: node artbench.mjs <bundle.js> [throttle] [runs]  -> the art bench in Chrome (canvas on the CPU)
import { chromium } from 'playwright';
const [file, thr = '4', runs = '3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--disable-accelerated-2d-canvas'] });
for (let r = 0; r < Number(runs); r++) {
  const p = await b.newPage();
  await p.goto('about:blank');
  await p.addScriptTag({ path: file });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(thr) });
  console.log(JSON.stringify(await p.evaluate(() => window.__bench())));
  await p.close();
}
await b.close();
