import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Offline play: writes dist/sw.js (the service worker, from src/sw.js) once the build is written,
 * with this build's list of files filled in, so there's no list to keep up to date by hand:
 * - `shell`: everything the game needs to start (the page, its code and styles, fonts, icons,
 *   the app manifest), saved when the service worker installs;
 * - `music`: the songs, saved as they're played and, in the background, the rest of them;
 * - `version` (src/version.ts) and `id` (a fingerprint of every file): the cache's name, so a
 *   new build gets a new cache and the old one is cleared away;
 * - `index`: the page's own fingerprint (the service worker only saves the page it was built with).
 * Not for the dev server, nor the single-file build (`--mode single`: it can't have one).
 */
export function offline(): Plugin {
  let outDir = 'dist';
  let root = '.';
  return {
    name: 'puffy-offline',
    apply: (_config, env) => env.command === 'build' && env.mode !== 'single',
    configResolved(config) {
      root = config.root;
      outDir = resolve(root, config.build.outDir);
    },
    writeBundle: {
      sequential: true,
      order: 'post',
      handler() {
        const files: string[] = [];
        const walk = (dir: string) => {
          for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else files.push(relative(outDir, p).split(sep).join('/'));
          }
        };
        walk(outDir);
        const sha = (f: string) => createHash('sha256').update(readFileSync(join(outDir, f))).digest('hex');
        // (not the hidden ?bench page's file: it's for checking a device, online, and no player needs
        // it kept — fetched once, if ever, like any other /assets/ file)
        const list = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !/(^|\/)benchPage-[\w-]+\.js$/.test(f)).sort();
        const isMusic = (f: string) => /\.(m4a|mp3|ogg|wav)$/.test(f);
        const id = createHash('sha256')
          .update(list.map((f) => `${f}:${sha(f)}`).join('\n'))
          .digest('hex')
          .slice(0, 10);
        const version = /VERSION\s*=\s*'([^']+)'/.exec(readFileSync(join(root, 'src/version.ts'), 'utf8'))?.[1] ?? '0';
        const build = { version, id, index: sha('index.html'), shell: list.filter((f) => !isMusic(f)), music: list.filter(isMusic) };
        const sw = readFileSync(join(root, 'src/sw.js'), 'utf8').replace('self.__PUFFY_BUILD__', JSON.stringify(build));
        writeFileSync(join(outDir, 'sw.js'), sw);
      },
    },
  };
}
