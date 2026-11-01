/** Who is playing, with which character, on which input device. Passed from the lobby into the game. */
export interface PlayerSlot {
  slot: number; // 0..2
  characterId: string;
  inputId: string;
}

export interface Session {
  players: PlayerSlot[];
}

/** Player colors used for HUD + name tags, independent of the character's own colors. */
export const SLOT_COLORS = ['#ff4d6d', '#3fa7ff', '#ffc533'];
