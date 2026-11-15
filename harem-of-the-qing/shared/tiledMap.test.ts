import { describe, expect, it } from 'vitest';
import consortPalace from '../assets/maps/consort-palace.json';
import { rectCenter } from './geometry';
import { findFreeSpot, isFree } from './movement';
import { areaBounds, parseTiledMap, START_ZONE, startPosition, zoneAt } from './tiledMap';

function rectangle(id: number, name: string, x: number, y: number, width: number, height: number) {
  return { id, name, type: '', x, y, width, height, rotation: 0, visible: true };
}

function tiledMap(layers: unknown[]) {
  return { type: 'map', width: 20, height: 10, tilewidth: 16, tileheight: 16, infinite: false, layers };
}

const background = { id: 1, name: 'background', type: 'imagelayer', image: '../art/palace.jpg', x: 0, y: 0 };
const collisions = {
  id: 2,
  name: 'collisions',
  type: 'objectgroup',
  objects: [rectangle(1, '', 0, 0, 320, 16), rectangle(2, '', 0, 0, 16, 160)],
};
const zones = {
  id: 3,
  name: 'zones',
  type: 'objectgroup',
  objects: [rectangle(3, 'side_room_1', 32, 32, 64, 48), rectangle(4, 'kitchen', 160, 32, 96, 96)],
};

describe('parseTiledMap', () => {
  it('reads the background, the collision rectangles and the named zones', () => {
    const map = parseTiledMap(tiledMap([background, collisions, zones]));
    expect(map.gridSize).toEqual({ width: 320, height: 160 });
    expect(map.background).toEqual({ image: '../art/palace.jpg', x: 0, y: 0, size: null });
    expect(map.collisions).toEqual([
      { x: 0, y: 0, width: 320, height: 16 },
      { x: 0, y: 0, width: 16, height: 160 },
    ]);
    expect(map.zones.map((zone) => zone.name)).toEqual(['side_room_1', 'kitchen']);
    expect(map.zones[0]?.rect).toEqual({ x: 32, y: 32, width: 64, height: 48 });
    expect(map.warnings).toEqual([]);
  });

  it('records the picture size when Tiled wrote it', () => {
    const map = parseTiledMap(tiledMap([{ ...background, imagewidth: 819, imageheight: 1024 }]));
    expect(map.background?.size).toEqual({ width: 819, height: 1024 });
  });

  it('finds layers whatever their capital letters, and inside group layers with offsets', () => {
    const group = {
      id: 9,
      name: 'gameplay',
      type: 'group',
      offsetx: 100,
      offsety: 0,
      layers: [{ ...collisions, name: 'Collisions', offsetx: 0, offsety: 5 }],
    };
    const map = parseTiledMap(tiledMap([group, { ...zones, name: ' ZONES ' }]));
    expect(map.collisions[0]).toEqual({ x: 100, y: 5, width: 320, height: 16 });
    expect(map.zones).toHaveLength(2);
  });

  it('skips shapes that are not rectangles and says so', () => {
    const mixed = {
      ...collisions,
      objects: [
        rectangle(1, '', 0, 0, 32, 32),
        { id: 2, name: '', x: 5, y: 5, width: 0, height: 0, point: true },
        { id: 3, name: '', x: 5, y: 5, width: 20, height: 20, ellipse: true },
        { id: 4, name: '', x: 5, y: 5, width: 0, height: 0, polygon: [{ x: 0, y: 0 }] },
      ],
    };
    const map = parseTiledMap(tiledMap([mixed, zones]));
    expect(map.collisions).toHaveLength(1);
    expect(map.warnings).toEqual(['3 object(s) in "collisions" are not rectangles and were skipped.']);
  });

  it('warns when the collisions or zones layer is missing, or a zone has no name', () => {
    const map = parseTiledMap(tiledMap([background]));
    expect(map.collisions).toEqual([]);
    expect(map.zones).toEqual([]);
    expect(map.warnings).toHaveLength(2);

    const unnamed = parseTiledMap(tiledMap([collisions, { ...zones, objects: [rectangle(1, '', 0, 0, 5, 5)] }]));
    expect(unnamed.warnings).toEqual(['1 zone(s) have no name. Give each zone a name in Tiled.']);
  });

  it('refuses a file that is not a Tiled JSON map', () => {
    expect(() => parseTiledMap('<!doctype html>')).toThrow(/not a Tiled map/);
    expect(() => parseTiledMap({ hello: 'world' })).toThrow(/not a Tiled map/);
  });
});

describe('areaBounds', () => {
  it('uses the painted background when its size is known', () => {
    const map = parseTiledMap(tiledMap([{ ...background, offsetx: 8, imagewidth: 819, imageheight: 1024 }]));
    expect(areaBounds(map)).toEqual({ x: 8, y: 0, width: 819, height: 1024 });
  });

  it('uses the size of the loaded picture when the file does not record it', () => {
    const map = parseTiledMap(tiledMap([background]));
    expect(areaBounds(map, { width: 400, height: 300 })).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('falls back to the Tiled grid when there is no picture', () => {
    expect(areaBounds(parseTiledMap(tiledMap([collisions, zones])))).toEqual({ x: 0, y: 0, width: 320, height: 160 });
  });
});

describe('startPosition', () => {
  it(`is the middle of the "${START_ZONE}" zone when the map has one`, () => {
    const map = parseTiledMap(tiledMap([collisions, zones]));
    expect(startPosition(map, areaBounds(map))).toEqual({ x: 64, y: 56 });
  });

  it('is the middle of the map otherwise', () => {
    const map = parseTiledMap(tiledMap([collisions]));
    expect(startPosition(map, areaBounds(map))).toEqual({ x: 160, y: 80 });
  });
});

describe('zoneAt', () => {
  const map = parseTiledMap(
    tiledMap([
      { ...zones, objects: [rectangle(1, 'courtyard', 0, 0, 300, 150), rectangle(2, 'well', 100, 50, 20, 20)] },
    ]),
  );

  it('finds the zone the player is standing in', () => {
    expect(zoneAt({ x: 10, y: 10 }, map.zones)?.name).toBe('courtyard');
  });

  it('prefers the smallest zone where zones overlap', () => {
    expect(zoneAt({ x: 110, y: 60 }, map.zones)?.name).toBe('well');
  });

  it('finds nothing outside every zone', () => {
    expect(zoneAt({ x: 310, y: 10 }, map.zones)).toBeNull();
  });
});

describe('the stand-in palace map in assets/maps', () => {
  const map = parseTiledMap(consortPalace);
  const bounds = areaBounds(map);
  const walkArea = { bounds, obstacles: map.collisions };
  const body = { width: 12, height: 12 };

  it('loads without warnings and has a background, collisions and zones', () => {
    expect(map.warnings).toEqual([]);
    expect(map.background?.image).toBe('../palace-layouts/consort-palace-furnished.jpg');
    expect(bounds).toEqual({ x: 0, y: 0, width: 819, height: 1024 });
    expect(map.collisions.length).toBeGreaterThan(0);
  });

  it(`has a "${START_ZONE}" zone with free floor to start on`, () => {
    const start = findFreeSpot(startPosition(map, bounds), body, walkArea);
    expect(isFree(start, body, walkArea)).toBe(true);
    expect(zoneAt(start, map.zones)?.name).toBe(START_ZONE);
  });

  it('has some free floor in every zone', () => {
    for (const zone of map.zones) {
      const spot = findFreeSpot(rectCenter(zone.rect), body, walkArea);
      expect(zoneAt(spot, [zone]), zone.name).not.toBeNull();
    }
  });
});
