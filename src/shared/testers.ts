/**
 * The testers' accounts (names, any case): they get the work-in-progress levels and every boss in
 * the game (see level/levels.ts), and only they can read the device-check reports on the server
 * (see server/users.ts, and the hidden ?bench page). One list for both.
 */
export const TESTERS: readonly string[] = ['neil', 'founder'];

/** Whether this account name is a tester's. */
export const isTesterName = (name: string | null | undefined) => TESTERS.includes((name ?? '').trim().toLowerCase());
