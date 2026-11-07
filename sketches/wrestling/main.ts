import { render } from './concept';
render().then((out) => {
  for (const [k, c] of Object.entries(out)) { c.id = k; c.style.width = '1280px'; document.body.appendChild(c); }
  (window as any).done = Object.keys(out);
}).catch((e) => { (window as any).err = String(e && e.stack || e); });
