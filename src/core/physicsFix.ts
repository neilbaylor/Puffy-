import Phaser from 'phaser';

/**
 * Arcade physics without its tree (`useTree: false`, main.ts: much cheaper) checks a sprite against
 * a group by walking the group's live list of members, with its length read once. A hit that
 * destroys a member (a rocket into the Queen, say) shrinks that list mid-walk, and the walk then
 * reads past its end — "Cannot read properties of undefined (reading 'body')", which stops the game
 * cold (Safari: the page). Here the same walk goes over a copy of the list, and skips members
 * already gone. Everything else is Phaser's own code, unchanged.
 */
export function fixArcadeGroupWalk() {
  type Body = Phaser.Physics.Arcade.Body;
  type World = Phaser.Physics.Arcade.World & {
    __walkFixed?: boolean;
    useTree: boolean;
    canCollide(a: Body, b: unknown): boolean;
    separate(a: Body, b: Body, process?: unknown, ctx?: unknown, overlapOnly?: boolean): boolean;
    _total: number;
  };
  const P = Phaser.Physics.Arcade.World.prototype as unknown as World & {
    collideSpriteVsGroup: (...a: unknown[]) => void;
  };
  if (P.__walkFixed) return;
  P.__walkFixed = true;
  const original = P.collideSpriteVsGroup;
  P.collideSpriteVsGroup = function (this: World, sprite: unknown, group: Phaser.Physics.Arcade.Group, collideCallback?: (a: unknown, b: unknown) => void, processCallback?: unknown, callbackContext?: unknown, overlapOnly?: boolean) {
    // (with the tree, or against static bodies, Phaser searches a copy already)
    if (this.useTree || group.physicsType === Phaser.Physics.Arcade.STATIC_BODY) return original.call(this, sprite, group, collideCallback, processCallback, callbackContext, overlapOnly);
    const s = sprite as { isBody?: boolean; body?: Body };
    const bodyA = (s.isBody ? sprite : s.body) as Body | undefined;
    if (group.getLength() === 0 || !bodyA || !bodyA.enable || bodyA.checkCollision.none || !this.canCollide(bodyA, group)) return;
    const children = group.getChildren().slice();
    for (const child of children) {
      if (child === sprite) continue;
      const bodyB = (child as { body?: Body } | undefined)?.body;
      // (destroyed by an earlier hit in this same walk: no body, or no longer in the group)
      if (!bodyB || !bodyB.enable || !group.contains(child)) continue;
      if (this.separate(bodyA, bodyB, processCallback, callbackContext, overlapOnly)) {
        collideCallback?.call(callbackContext, bodyA.gameObject, bodyB.gameObject);
        this._total++;
      }
      // (the sprite itself destroyed by that hit: nothing more to check)
      if (!bodyA.enable) return;
    }
  } as unknown as (...a: unknown[]) => void;
}
