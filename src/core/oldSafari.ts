/**
 * Older Safari (16 and before: the owner's old iPad, iPadOS 16.6) paints a word's outline
 * (-webkit-text-stroke) over its letters, ignoring `paint-order: stroke fill`, so the outlined titles
 * turn into black blobs. There `html.no-po` swaps each outline for a ring of text shadows (ui/oldSafari.css,
 * generated from ui/style.css by scripts/old_safari_css.py: rerun it after changing outlined text), which looks the same and draws right everywhere. Newer browsers keep
 * the real outline. (Every iPhone and iPad browser is Safari underneath: their iOS version decides.)
 */
const ua = navigator.userAgent;
const webkitOnly = /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua);
const ios = /\bOS (\d+)_\d+(?:_\d+)? like Mac OS X/.exec(ua);
const safari = /Version\/(\d+)[.\d]* (?:Mobile\/\S+ )?Safari\//.exec(ua);
const major = ios ? +ios[1] : safari ? +safari[1] : 0;
if (webkitOnly && major > 0 && major < 17) document.documentElement.classList.add('no-po');
