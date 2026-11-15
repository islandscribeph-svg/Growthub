/**
 * Phase 0 display settings. These are placeholders for how the scaffold looks
 * and feels, not game rules: docs/GAME_LOGIC.md does not mention any of them,
 * so they live here and not in shared/balance.ts.
 */

/** The part of the map visible at once, in pixels, before it is scaled to fit the window. */
export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 600;

/** Tile size used by the uploaded Tiled files (assets/tilemap). */
export const TILE_SIZE = 16;

/** The blank map borrows the size of assets/tilemap/qing-palace.tmx: 71 x 88 tiles. */
export const MAP_WIDTH = 71 * TILE_SIZE;
export const MAP_HEIGHT = 88 * TILE_SIZE;

/** Grid lines on the blank map, so movement is visible. */
export const GRID_SPACING = 4 * TILE_SIZE;

export const PLAYER_SIZE = 48;

/** Placeholder walking speed in map pixels per second. */
export const PLAYER_SPEED = 180;
