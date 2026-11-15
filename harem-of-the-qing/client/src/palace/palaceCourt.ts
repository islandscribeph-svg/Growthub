/**
 * The court the playable palace opens with: the sandbox's small court, placed in the rooms of
 * the one painted palace. Each place's id is the name of a zone in assets/maps/consort-palace.json.
 * The people and their stats are made-up test data.
 */
import { STARTING } from '../../../shared/balance';
import type { CharacterId, CourtState, Place, PlaceKind, Servant, ActivitySpot } from '../../../shared/types';
import { HOME, MAID_ID, YOU, createDemoCourt } from '../sandbox/demoCourt';

export const MISTRESS_ID: CharacterId = 'mei';
export const NEIGHBOUR_ID: CharacterId = 'yu';
export const GUARD_ID: CharacterId = 'bo';
export const COOK_ID = 'zhao';
export const EUNUCH_ID = 'li';

/** A talent level that makes Attendant Yu the regular of the music room. */
const YU_INSTRUMENTS = 58;

function place(id: string, name: string, kind: PlaceKind, spots: readonly ActivitySpot[] = [], ownerId: CharacterId | null = null): Place {
  return { id, name, palaceId: HOME, kind, ownerId, spots };
}

/** The rooms of the palace. The painting has no dressing room, sewing room or dance terrace, so three places stand in. */
export const PALACE_PLACES: readonly Place[] = [
  place('courtyard', 'the courtyard', 'courtyard', ['courtyard_chores']),
  place('main_hall', 'the main hall', 'main_hall'),
  place('mistress_room', "Consort Mei's room", 'private_room', [], MISTRESS_ID),
  place('side_room_1', 'your room', 'private_room', [], YOU),
  place('side_room_2', "Attendant Yu's room", 'private_room', [], NEIGHBOUR_ID),
  place('study', 'the study', 'workroom', ['study']),
  place('kitchen', 'the kitchen', 'workroom', ['kitchen']),
  place('music_pavilion', 'the music room', 'workroom', ['music_pavilion']),
  place('dressing_room', 'the dressing room', 'workroom', ['dressing_room']),
  place('sewing_room', 'the sewing room', 'workroom', ['sewing_room']),
  place('dance_terrace', 'the dance terrace', 'workroom', ['dance_terrace']),
  place('garden', 'the kitchen garden', 'workroom'),
  place('servants_quarters', "the servants' quarters", 'servants_quarters'),
  place('palace_gate', 'the palace gate', 'gate'),
];

function staff(id: string, name: string, role: Servant['role']): Servant {
  return { id, name, role, loyalty: STARTING.maidLoyalty, servesId: null, palaceId: HOME, loyaltyFromTipsToday: 0 };
}

/** Day 1, Morning, with nobody placed yet. The session places everyone before play starts. */
export function createPalaceCourt(): CourtState {
  const court = createDemoCourt();
  const yu = court.characters[NEIGHBOUR_ID];
  if (yu?.path !== 'lady') throw new Error('The demo court has lost Attendant Yu.');
  return {
    ...court,
    id: 'palace_court',
    characters: {
      ...court.characters,
      [yu.id]: { ...yu, talents: { ...yu.talents, instruments: YU_INSTRUMENTS } },
    },
    servants: {
      ...court.servants,
      [COOK_ID]: staff(COOK_ID, 'Cook Zhao', 'cook'),
      [EUNUCH_ID]: staff(EUNUCH_ID, 'Eunuch Li', 'eunuch'),
    },
    places: Object.fromEntries(PALACE_PLACES.map((entry) => [entry.id, entry])),
    whereabouts: {},
  };
}

export { HOME, MAID_ID, YOU };
