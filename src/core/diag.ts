import { LIGHT, LIGHT_KEY } from './light';
import { VERSION } from '../version';

/**
 * A hidden diagnostics box (only with `?diag` in the address): what this device reports, and which
 * mode it's in. For working out how a device behaves; players never see it.
 */
export const diag = { refresh: '', view: '', smooth: '', seenAs: '' };

export function showDiag() {
  let on = false;
  try {
    on = new URLSearchParams(location.search).has('diag');
  } catch {
    /* (no address) */
  }
  if (!on) return;
  const box = document.createElement('pre');
  box.style.cssText =
    'position:fixed;right:8px;bottom:8px;z-index:9999;margin:0;padding:8px 10px;max-width:60vw;white-space:pre-wrap;font:600 11px/1.35 ui-monospace,monospace;color:#fff;background:#000c;border-radius:8px;pointer-events:none';
  document.body.appendChild(box);
  const nav = navigator as Navigator & { deviceMemory?: number };
  let maxTex = 0;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    maxTex = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 0;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    /* no WebGL */
  }
  const fill = () => {
    let key = '';
    try {
      key = localStorage.getItem(LIGHT_KEY) ?? '(none)';
    } catch {
      key = '(no storage)';
    }
    box.textContent = [
      `v${VERSION} · ${LIGHT ? 'LIGHT' : 'FULL'} mode · saved: ${key}`,
      `memory: ${nav.deviceMemory ?? '?'} GB · cores: ${nav.hardwareConcurrency ?? '?'} · max picture: ${maxTex || '?'}`,
      `screen: ${innerWidth}×${innerHeight} @${devicePixelRatio} · refresh: ${diag.refresh}`,
      `page size: ${diag.view} · edge smoothing: ${diag.smooth} · seen as: ${diag.seenAs}`,
    ].join('\n');
  };
  fill();
  setInterval(fill, 500);
}
