/**
 * Display settings. These are placeholders for how the game looks and feels,
 * not game rules: docs/GAME_LOGIC.md does not mention any of them, so they
 * live here and not in shared/balance.ts.
 */
import type { Size } from '../../shared/geometry';

/** The size of the game screen in pixels, before it is scaled to fit the window. */
export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 600;

/** How much the map is magnified on screen. */
export const MAP_ZOOM = 2;

/** Maps live in assets/maps. This one opens unless the address says ?map=another-name. */
export const MAPS_FOLDER = 'maps';
export const DEFAULT_MAP = 'consort-palace';

/** The placeholder player square, in map pixels. Must be narrower than the doorways. */
export const PLAYER_BODY: Size = { width: 12, height: 12 };

/** Placeholder walking speed in map pixels per second. */
export const PLAYER_SPEED = 90;

/**
 * How often the palace's NPCs and servants move to another of their usual places while the
 * game is being tested by hand. In the real game a phase lasts 30 minutes and the server moves
 * them a few times in it (WHEREABOUTS in shared/balance.ts); here the clock is moved by a
 * button, so they move on this short timer.
 */
export const COURT_STIR_MS = 40_000;

/** The dice the playable palace starts with. Add ?seed=anything to the address for other rolls. */
export const DEFAULT_SEED = 'palace';
