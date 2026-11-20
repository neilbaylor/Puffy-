// The music module keeps "only the last two decoded songs" (plus the one playing). Each song decoded
// is 13–21 MB (100–170 s, mono, 32 kHz, float32). Scenario: the start screen's song is playing; you peek
// at the Battle lobby (its song decoded ahead), the Bosses menu (the boss song decoded ahead), then start
// Part 2 (its song decoded ahead, then played). How many songs stay decoded through the level?
const node = () => ({ connect: (x: any) => x ?? node(), disconnect() {}, start() {}, stop() {}, gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, playbackRate: { value: 1 }, buffer: null as any, loop: false, onended: null as any });
(globalThis as any).AudioContext = class { state = 'running'; currentTime = 0; destination = {}; resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } createBufferSource() { return node(); } createGain() { return node(); } createBuffer() { return { getChannelData: () => new Float32Array(1) }; } };
(globalThis as any).OfflineAudioContext = class { decodeAudioData(_d: any, ok: (b: any) => void) { ok({ numberOfChannels: 1, duration: 120, length: 1 }); } };
(globalThis as any).fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
const m = await import('/workspace/Puffy-/src/core/music');
const flush = () => new Promise((r) => setTimeout(r, 20));
const state = () => (window as any).__music();
m.primeMusic(); // (the first tap: audio unlocked)
m.playMenuMusic();
await flush();
console.log('start screen          ', JSON.stringify(state()));
m.preloadBattleMusic(); // the Battle lobby (battleUi.ts:160)
await flush();
m.preloadHoopsMusic(); // the Bosses menu (ui.ts:1353)
await flush();
m.preloadLevelMusic(2); // Play: Part 2 (ui.ts:1466), the menu song still on
await flush();
m.playLevelSong(2);
await flush();
console.log('playing Part 2        ', JSON.stringify(state()));
m.preloadHoopsMusic(); // near the end of the level (GameScene.ts:886)
await flush();
console.log('end of Part 2         ', JSON.stringify(state()));
