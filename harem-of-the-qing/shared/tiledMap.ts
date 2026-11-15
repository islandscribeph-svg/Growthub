/**
 * Reads a map exported from Tiled as JSON (https://doc.mapeditor.org/en/stable/reference/json-map-format/).
 *
 * A game map is a painted background on an image layer, plus two object layers:
 * "collisions" (rectangles the player cannot walk through) and "zones" (named rectangles
 * the player can stand in). Only rectangles are used; other shapes are skipped with a warning.
 */
import { rectCenter, rectContainsPoint, type Point, type Rect, type Size } from './geometry';

export const COLLISIONS_LAYER = 'collisions';
export const ZONES_LAYER = 'zones';

/** The player starts in the middle of this zone when the map has one. */
export const START_ZONE = 'side_room_1';

export interface Zone {
  id: number;
  name: string;
  rect: Rect;
}

export interface Background {
  /** Path of the picture, as written in the map file (relative to the map file). */
  image: string;
  x: number;
  y: number;
  /** Size of the picture. Tiled only writes this from version 1.11.1, so it can be missing. */
  size: Size | null;
}

export interface AreaMap {
  /** The map's own size in Tiled: tiles across and down, times the tile size. */
  gridSize: Size;
  background: Background | null;
  collisions: Rect[];
  zones: Zone[];
  /** Plain-language notes about anything in the file that was skipped or looks wrong. */
  warnings: string[];
}

type Json = Record<string, unknown>;

interface ObjectLayer {
  objects: unknown[];
  offsetX: number;
  offsetY: number;
}

interface CollectedLayers {
  images: Background[];
  collisions: ObjectLayer[];
  zones: ObjectLayer[];
}

/** Throws an Error with a plain-language message when the data is not a Tiled JSON map. */
export function parseTiledMap(data: unknown): AreaMap {
  if (!isJson(data) || !Array.isArray(data.layers)) {
    throw new Error('This is not a Tiled map saved as JSON (it has no list of layers).');
  }
  const warnings: string[] = [];
  if (data.infinite === true) {
    warnings.push('This is an "infinite" Tiled map. Turn that off in Map Properties so the map has edges.');
  }

  const found: CollectedLayers = { images: [], collisions: [], zones: [] };
  collectLayers(data.layers, 0, 0, found);

  if (found.images.length > 1) {
    warnings.push(`The map has ${found.images.length} image layers. Only the first is drawn.`);
  }
  if (found.collisions.length === 0) {
    warnings.push(`The map has no object layer named "${COLLISIONS_LAYER}", so nothing blocks the player.`);
  }
  if (found.zones.length === 0) {
    warnings.push(`The map has no object layer named "${ZONES_LAYER}", so there is nothing to interact with.`);
  }

  const collisions = found.collisions.flatMap((layer) =>
    readRectangles(layer, COLLISIONS_LAYER, warnings).map((object) => object.rect),
  );
  const zones = found.zones.flatMap((layer) => readRectangles(layer, ZONES_LAYER, warnings));
  const unnamed = zones.filter((zone) => zone.name === '').length;
  if (unnamed > 0) {
    warnings.push(`${unnamed} zone(s) have no name. Give each zone a name in Tiled.`);
  }

  return {
    gridSize: {
      width: numberOr(data.width, 0) * numberOr(data.tilewidth, 0),
      height: numberOr(data.height, 0) * numberOr(data.tileheight, 0),
    },
    background: found.images[0] ?? null,
    collisions,
    zones,
    warnings,
  };
}

/**
 * The walkable rectangle of a map: the painted background when there is one, otherwise the Tiled grid.
 * Pass `loadedImageSize` when the picture has been loaded and the map file did not record its size.
 */
export function areaBounds(map: AreaMap, loadedImageSize?: Size): Rect {
  const background = map.background;
  const imageSize = loadedImageSize ?? background?.size;
  if (background && imageSize) {
    return { x: background.x, y: background.y, width: imageSize.width, height: imageSize.height };
  }
  return { x: 0, y: 0, width: map.gridSize.width, height: map.gridSize.height };
}

/** The middle of the start zone when the map has one, otherwise the middle of the map. */
export function startPosition(map: AreaMap, bounds: Rect): Point {
  const start = map.zones.find((zone) => zone.name === START_ZONE);
  return rectCenter(start ? start.rect : bounds);
}

/** The zone the point is in. Where zones overlap, the smallest one wins. */
export function zoneAt(point: Point, zones: readonly Zone[]): Zone | null {
  let found: Zone | null = null;
  for (const zone of zones) {
    if (!rectContainsPoint(zone.rect, point)) continue;
    if (!found || area(zone.rect) < area(found.rect)) found = zone;
  }
  return found;
}

function area(rect: Rect): number {
  return rect.width * rect.height;
}

function collectLayers(layers: unknown[], offsetX: number, offsetY: number, found: CollectedLayers): void {
  for (const layer of layers) {
    if (!isJson(layer)) continue;
    const x = offsetX + numberOr(layer.offsetx, 0);
    const y = offsetY + numberOr(layer.offsety, 0);
    const name = typeof layer.name === 'string' ? layer.name.trim().toLowerCase() : '';

    if (layer.type === 'group' && Array.isArray(layer.layers)) {
      collectLayers(layer.layers, x, y, found);
    } else if (layer.type === 'imagelayer' && typeof layer.image === 'string' && layer.image !== '') {
      const width = numberOr(layer.imagewidth, 0);
      const height = numberOr(layer.imageheight, 0);
      found.images.push({
        image: layer.image,
        x,
        y,
        size: width > 0 && height > 0 ? { width, height } : null,
      });
    } else if (layer.type === 'objectgroup' && Array.isArray(layer.objects)) {
      const objectLayer = { objects: layer.objects, offsetX: x, offsetY: y };
      if (name === COLLISIONS_LAYER) found.collisions.push(objectLayer);
      if (name === ZONES_LAYER) found.zones.push(objectLayer);
    }
  }
}

function readRectangles(layer: ObjectLayer, layerName: string, warnings: string[]): Zone[] {
  const rectangles: Zone[] = [];
  let skipped = 0;
  let rotated = 0;
  for (const object of layer.objects) {
    if (!isJson(object)) continue;
    const width = numberOr(object.width, 0);
    const height = numberOr(object.height, 0);
    const isOtherShape =
      object.point === true ||
      object.ellipse === true ||
      object.polygon !== undefined ||
      object.polyline !== undefined ||
      object.text !== undefined ||
      object.gid !== undefined;
    if (isOtherShape || width <= 0 || height <= 0) {
      skipped++;
      continue;
    }
    if (numberOr(object.rotation, 0) !== 0) rotated++;
    rectangles.push({
      id: numberOr(object.id, 0),
      name: typeof object.name === 'string' ? object.name.trim() : '',
      rect: {
        x: numberOr(object.x, 0) + layer.offsetX,
        y: numberOr(object.y, 0) + layer.offsetY,
        width,
        height,
      },
    });
  }
  if (skipped > 0) {
    warnings.push(`${skipped} object(s) in "${layerName}" are not rectangles and were skipped.`);
  }
  if (rotated > 0) {
    warnings.push(`${rotated} rectangle(s) in "${layerName}" are rotated. The rotation is ignored.`);
  }
  return rectangles;
}

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
