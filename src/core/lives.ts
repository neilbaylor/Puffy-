/**
 * Lives. You get 4 tries per run: the counter shows the spare ones, so it
 * reads 3 → 2 → 1 → 0, and you still play your last try at 0. Fainting at 0
 * is game over (back to the start of the level).
 */
export const SPARE_LIVES = 3;

export const lives = { left: SPARE_LIVES };

export function resetLives() {
  lives.left = SPARE_LIVES;
}

/** Use up a life. Returns false when there was none left (game over). */
export function loseLife(): boolean {
  if (lives.left <= 0) return false;
  lives.left--;
  return true;
}
