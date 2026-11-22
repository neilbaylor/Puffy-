import Phaser from 'phaser';

/** The scene the screen is being wiped in the colour of, if any (only that one puts it back). */
let wipingFor: Phaser.Scene | null = null;
/** The game's own wipe colour (copied the first time, before any scene's taken over). */
let usual: Phaser.Display.Color | null = null;

/**
 * A scene's background colour, given the cheap way. A camera's background colour is drawn as a
 * rectangle over the whole screen before anything else, every frame — a whole screenful for the
 * graphics chip, which then mostly paints the arena right over it. But the screen is wiped to a
 * colour before every frame anyway (the game's own background colour), and that wipe costs the
 * same whatever the colour. So while this scene is the first drawn (nothing under it) and its
 * camera covers the screen, the wipe is done in its colour and the camera draws no rectangle: the
 * same pixels, one screenful less. Otherwise (another scene showing under it, or a camera
 * smaller than the screen) its camera fills in its colour as before.
 *
 * Use instead of `cameras.main.setBackgroundColor(colour)`.
 */
export function clearWith(scene: Phaser.Scene, colour: string) {
  const cam = scene.cameras.main;
  cam.setBackgroundColor(colour);
  const renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  const fill = cam.backgroundColor;
  const none = new Phaser.Display.Color(0, 0, 0, 0);
  const wipe = (renderer.config as { backgroundColor: Phaser.Display.Color }).backgroundColor;
  const own = (usual ??= wipe.clone());
  const S = Phaser.Scenes;
  const firstDrawn = () => scene.game.scene.scenes.find((s) => s.sys.settings.visible && s.sys.settings.status >= S.LOADING && s.sys.settings.status < S.SLEEPING);
  const before = () => {
    const c = cam as Phaser.Cameras.Scene2D.Camera & { forceComposite?: boolean; filters?: { internal: { getActive(): unknown[] }; external: { getActive(): unknown[] } } };
    const under =
      firstDrawn() === scene &&
      scene.cameras.cameras[0] === cam &&
      cam.visible &&
      cam.alpha === 1 &&
      !c.forceComposite &&
      !c.filters?.internal.getActive().length &&
      !c.filters?.external.getActive().length &&
      cam.x <= 0 &&
      cam.y <= 0 &&
      cam.x + cam.width >= renderer.width &&
      cam.y + cam.height >= renderer.height;
    if (under) {
      wipe.setTo(fill.red, fill.green, fill.blue, 255);
      wipingFor = scene;
      cam.backgroundColor = none;
    } else {
      putBack();
      cam.backgroundColor = fill;
    }
  };
  const putBack = () => {
    if (wipingFor !== scene) return;
    wipingFor = null;
    wipe.setTo(own.red, own.green, own.blue, own.alpha);
  };
  renderer.on(Phaser.Renderer.Events.PRE_RENDER_CLEAR, before);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    renderer.off(Phaser.Renderer.Events.PRE_RENDER_CLEAR, before);
    putBack();
    cam.backgroundColor = fill;
  });
}
