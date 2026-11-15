/**
 * How the palace looks on screen: which picture each person wears and where they stand in
 * each room. None of this is a game rule. The rules only know which room someone is in
 * (shared/rules/places.ts); this file turns that into a spot on the painted map.
 */
import type { Point, Rect } from '../../../shared/geometry';
import type { CourtState, GuardRank, LadyRank, Phase, PlaceId, ServantRole } from '../../../shared/types';
import { COOK_ID, EUNUCH_ID, GUARD_ID, MAID_ID, MISTRESS_ID, NEIGHBOUR_ID } from './palaceCourt';

export type SheetKey = 'court-ranks' | 'maids-and-eunuchs' | 'palace-staff';

/** The character sheets in assets/characters, as the game loads them. */
export const SHEET_URL: Readonly<Record<SheetKey, string>> = {
  'court-ranks': 'characters/court-ranks.png',
  'maids-and-eunuchs': 'characters/maids-and-eunuchs.png',
  'palace-staff': 'characters/palace-staff.png',
};

/** One figure cut out of a character sheet, in the sheet's own pixels. */
export interface Portrait {
  readonly sheet: SheetKey;
  readonly rect: Rect;
}

/** How much each sheet is shrunk so its figures stand about as tall as a doorway. */
export const SHEET_SCALE: Readonly<Record<SheetKey, number>> = {
  'court-ranks': 0.17,
  'maids-and-eunuchs': 0.115,
  'palace-staff': 0.15,
};

function portrait(sheet: SheetKey, x: number, y: number, width: number, height: number): Portrait {
  return { sheet, rect: { x, y, width, height } };
}

const LADY_PORTRAIT: Readonly<Record<LadyRank, Portrait>> = {
  second_class_attendant: portrait('court-ranks', 863, 297, 75, 204),
  first_class_attendant: portrait('court-ranks', 671, 293, 79, 208),
  noble_lady: portrait('court-ranks', 471, 286, 88, 215),
  imperial_concubine: portrait('court-ranks', 277, 283, 95, 218),
  consort: portrait('court-ranks', 67, 283, 126, 218),
  noble_consort: portrait('court-ranks', 839, 36, 121, 232),
  imperial_noble_consort: portrait('court-ranks', 633, 18, 156, 250),
  empress: portrait('court-ranks', 252, 6, 153, 260),
};

const GUARD_PORTRAIT = portrait('palace-staff', 768, 256, 111, 250);

const GUARD_PORTRAITS: Readonly<Record<GuardRank, Portrait>> = {
  blue_feather_guard: GUARD_PORTRAIT,
  third_class_guard: GUARD_PORTRAIT,
  second_class_guard: GUARD_PORTRAIT,
  first_class_guard: GUARD_PORTRAIT,
  guard_of_the_imperial_presence: GUARD_PORTRAIT,
  emperors_favorite: GUARD_PORTRAIT,
};

const SERVANT_PORTRAIT: Readonly<Record<ServantRole, Portrait>> = {
  personal_maid: portrait('maids-and-eunuchs', 207, 14, 120, 308),
  cook: portrait('palace-staff', 555, 273, 107, 233),
  eunuch: portrait('palace-staff', 768, 8, 108, 248),
  guard: GUARD_PORTRAIT,
};

/** The picture for a character or a servant, or null for someone the court does not know. */
export function portraitOf(court: CourtState, id: string): Portrait | null {
  const character = court.characters[id];
  if (character) return character.path === 'lady' ? LADY_PORTRAIT[character.rank] : GUARD_PORTRAITS[character.rank];
  const servant = court.servants[id];
  return servant ? SERVANT_PORTRAIT[servant.role] : null;
}

/** Where someone stands in a room, and where they stroll to when they walk about in it. */
export interface Stand {
  readonly at: Point;
  readonly strollTo?: Point;
}

/** How long one length of a stroll takes, in milliseconds. */
export const STROLL_MS = 9000;

/** How close the player has to be to someone to talk to them, in map pixels. */
export const REACH = 30;

const STANDS: Readonly<Record<PlaceId, Readonly<Record<string, Stand>>>> = {
  main_hall: {
    [MISTRESS_ID]: { at: { x: 410, y: 478 } },
    [NEIGHBOUR_ID]: { at: { x: 362, y: 545 } },
  },
  mistress_room: {
    [MISTRESS_ID]: { at: { x: 578, y: 552 } },
  },
  courtyard: {
    [MISTRESS_ID]: { at: { x: 270, y: 652 }, strollTo: { x: 550, y: 652 } },
    [NEIGHBOUR_ID]: { at: { x: 652, y: 700 } },
    [EUNUCH_ID]: { at: { x: 156, y: 690 }, strollTo: { x: 156, y: 740 } },
  },
  side_room_1: {
    [MAID_ID]: { at: { x: 100, y: 430 } },
  },
  side_room_2: {
    [NEIGHBOUR_ID]: { at: { x: 738, y: 442 } },
  },
  music_pavilion: {
    [NEIGHBOUR_ID]: { at: { x: 426, y: 224 } },
  },
  kitchen: {
    [COOK_ID]: { at: { x: 312, y: 210 } },
  },
  servants_quarters: {
    [COOK_ID]: { at: { x: 88, y: 716 } },
    [EUNUCH_ID]: { at: { x: 88, y: 806 } },
  },
  palace_gate: {
    [GUARD_ID]: { at: { x: 448, y: 950 } },
  },
};

/** Where a lady lies down at Night in her own room. */
const BEDS: Readonly<Record<PlaceId, Point>> = {
  mistress_room: { x: 566, y: 500 },
  side_room_2: { x: 724, y: 392 },
};

/**
 * Where a person stands in a room. Null when this map has no spot for them there, in which
 * case they are not drawn.
 */
export function standOf(placeId: PlaceId, id: string, phase: Phase): Stand | null {
  const stand = STANDS[placeId]?.[id] ?? null;
  const bed = BEDS[placeId];
  if (stand && bed && phase === 'night') return { at: bed };
  return stand;
}

/** Every place that has someone standing in it, for the test that checks the map agrees. */
export function allStands(): { placeId: PlaceId; id: string; point: Point }[] {
  const all: { placeId: PlaceId; id: string; point: Point }[] = [];
  for (const [placeId, people] of Object.entries(STANDS)) {
    for (const [id, stand] of Object.entries(people)) {
      all.push({ placeId, id, point: stand.at });
      if (stand.strollTo) all.push({ placeId, id, point: stand.strollTo });
    }
  }
  for (const [placeId, point] of Object.entries(BEDS)) all.push({ placeId, id: 'bed', point });
  return all;
}
