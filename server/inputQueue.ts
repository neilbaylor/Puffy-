/**
 * A player's buttons waiting for the server's ticks (one per tick, [seq, buttons]).
 *
 * A laggy phone catches up in a burst, and the queue can't be allowed to grow (that's lag
 * for good). It used to just drop all but the newest two — and with them any jump, fire or
 * bomb press in between, which the phone had already shown (a double jump, then a snap back
 * down). Now only repeats go: an entry with the same buttons as the one before it just holds
 * them a tick longer, so taking it out loses no press. Repeats with jump up go first (down to
 * `keep`); repeats with jump held only if it's still over `max` (holding jump is how high you
 * go, so those cost a little height). Only if the burst is all presses (frantic mashing) do
 * the oldest go, past `hardMax`.
 */
export function compactQueue(queue: [number, number][], held: number, keep: number, max: number, hardMax: number, jumpBit: number) {
  const pass = (target: number, drop: (b: number) => boolean) => {
    let prev = held;
    for (let i = 0; i < queue.length && queue.length > target; ) {
      if (queue[i][1] === prev && drop(prev)) {
        queue.splice(i, 1);
        continue;
      }
      prev = queue[i][1];
      i++;
    }
  };
  pass(keep, (b) => (b & jumpBit) === 0);
  if (queue.length > max) pass(max, () => true);
  if (queue.length > hardMax) queue.splice(0, queue.length - hardMax);
}
