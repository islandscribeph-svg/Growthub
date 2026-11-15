import { describe, expect, it } from 'vitest';
import consortPalace from '../../../assets/maps/consort-palace.json';
import { distanceBetween, type Point } from '../../../shared/geometry';
import { findFreeSpot, isFree, type WalkArea } from '../../../shared/movement';
import { areaBounds, parseTiledMap, startPosition, zoneAt } from '../../../shared/tiledMap';
import { PHASES } from '../../../shared/types';
import { PLAYER_BODY } from '../config';
import { REACH, allStands, portraitOf, standOf } from './layout';
import { PALACE_PLACES, YOU, createPalaceCourt } from './palaceCourt';
import { PalaceSession } from './PalaceSession';

const map = parseTiledMap(consortPalace);
const walkArea: WalkArea = { bounds: areaBounds(map), obstacles: map.collisions };
const STEP = 4;

function placeAt(point: Point): string | null {
  return zoneAt(point, map.zones)?.name ?? null;
}

/** Every spot the player can walk to from where she starts, on a grid of a few pixels. */
function walkableSpots(): Point[] {
  const start = findFreeSpot(startPosition(map, walkArea.bounds), PLAYER_BODY, walkArea);
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const spots = [start];
  for (let index = 0; index < spots.length; index++) {
    const from = spots[index]!;
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]] as const) {
      const next = { x: from.x + dx, y: from.y + dy };
      const key = `${next.x},${next.y}`;
      if (seen.has(key) || !isFree(next, PLAYER_BODY, walkArea)) continue;
      seen.add(key);
      spots.push(next);
    }
  }
  return spots;
}

const spots = walkableSpots();
const placesWalkedInto = new Set(spots.map(placeAt));

describe('the palace map and the court agree', () => {
  it('has a zone on the map for every place of the court', () => {
    const zoneNames = new Set(map.zones.map((zone) => zone.name));
    expect(PALACE_PLACES.map((place) => place.id).filter((id) => !zoneNames.has(id))).toEqual([]);
  });

  it('has a place in the court for every named zone on the map', () => {
    const placeIds = new Set(PALACE_PLACES.map((place) => place.id));
    expect(map.zones.map((zone) => zone.name).filter((name) => !placeIds.has(name))).toEqual([]);
  });

  it('starts the player in her own room', () => {
    const start = findFreeSpot(startPosition(map, walkArea.bounds), PLAYER_BODY, walkArea);
    const room = PALACE_PLACES.find((place) => place.ownerId === YOU);
    expect(placeAt(start)).toBe(room?.id);
  });

  it('lets the player walk from her room into every place', () => {
    expect(PALACE_PLACES.map((place) => place.id).filter((id) => !placesWalkedInto.has(id))).toEqual([]);
  });
});

describe('where people stand', () => {
  it('puts every standing, strolling and sleeping spot inside the room it belongs to', () => {
    const misplaced = allStands().filter(({ placeId, point }) => placeAt(point) !== placeId);
    expect(misplaced).toEqual([]);
  });

  it('lets the player walk to within reach of every spot, standing in the same room', () => {
    const outOfReach = allStands().filter(
      ({ placeId, point }) => !spots.some((spot) => placeAt(spot) === placeId && distanceBetween(spot, point) <= REACH),
    );
    expect(outOfReach).toEqual([]);
  });

  it('has a spot for everyone wherever the court can send them, in every phase and with many dice', () => {
    const unplaced = new Set<string>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const session = new PalaceSession(seed);
      for (let step = 0; step < PHASES.length * 3; step++) {
        for (const [id, placeId] of Object.entries(session.court.whereabouts)) {
          if (id !== YOU && !standOf(placeId, id, session.court.phase)) unplaced.add(`${id} in ${placeId}`);
        }
        if (step % 2 === 0) session.stir();
        else session.nextPhase();
      }
    }
    expect([...unplaced]).toEqual([]);
  });

  it('lays a lady on her bed at Night, and nowhere else', () => {
    expect(standOf('mistress_room', 'mei', 'night')).not.toEqual(standOf('mistress_room', 'mei', 'day'));
    expect(standOf('main_hall', 'mei', 'night')).toEqual(standOf('main_hall', 'mei', 'day'));
  });

  it('has no spot for someone in a room they never use', () => {
    expect(standOf('kitchen', 'mei', 'day')).toBeNull();
    expect(standOf('nowhere', 'mei', 'day')).toBeNull();
  });
});

describe('portraits', () => {
  it('has a picture for everyone in the palace', () => {
    const court = createPalaceCourt();
    const ids = [...Object.keys(court.characters), ...Object.keys(court.servants)];
    expect(ids.filter((id) => portraitOf(court, id) === null)).toEqual([]);
  });

  it('has no picture for someone the court does not know', () => {
    expect(portraitOf(createPalaceCourt(), 'nobody')).toBeNull();
  });
});
