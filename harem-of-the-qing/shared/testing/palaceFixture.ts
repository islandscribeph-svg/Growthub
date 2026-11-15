/**
 * A small mapped palace for tests about places: a mistress, an attendant who loves music, a
 * player attendant, a gate guard, and three servants. Test data, not game rules.
 */
import type { CourtState, Lady, Phase, PlaceId, Servant } from '../types';
import { HOME_PALACE, makeCourt, makeGuard, makeLady, makeMaid, makePlace, makePlayerLady } from './fixtures';

export const LAN = 'lan';
export const MEI = 'mei';
export const YU = 'yu';
export const BO = 'bo';
export const MAID = 'maid';
export const COOK = 'cook';
export const EUNUCH = 'eunuch';

export interface PalaceParts {
  readonly phase?: Phase;
  readonly day?: number;
  readonly lan?: Partial<Lady>;
  readonly mei?: Partial<Lady>;
  readonly yu?: Partial<Lady>;
  readonly relationships?: readonly (readonly [string, string, number])[];
  readonly whereabouts?: readonly (readonly [string, PlaceId])[];
}

const TEST_SILVER = 500;

export function makePalaceCourt(parts: PalaceParts = {}): CourtState {
  const lan = makePlayerLady({ id: LAN, silver: TEST_SILVER, ...parts.lan });
  const mei = makeLady({ id: MEI, rank: 'consort', ...parts.mei });
  const base = makeLady({ id: YU, rank: 'first_class_attendant' });
  const yu = makeLady({ ...base, talents: { ...base.talents, instruments: 60 }, ...parts.yu });
  const cook: Servant = { id: COOK, name: COOK, role: 'cook', loyalty: 50, servesId: null, palaceId: HOME_PALACE, loyaltyFromTipsToday: 0 };
  const eunuch: Servant = { ...cook, id: EUNUCH, name: EUNUCH, role: 'eunuch' };
  return makeCourt({
    phase: parts.phase ?? 'day',
    day: parts.day ?? 1,
    characters: [lan, mei, yu, makeGuard({ id: BO })],
    servants: [makeMaid({ id: MAID, servesId: LAN }), cook, eunuch],
    relationships: parts.relationships ?? [],
    places: [
      makePlace({ id: 'hall', kind: 'main_hall' }),
      makePlace({ id: 'yard', kind: 'courtyard', spots: ['courtyard_chores'] }),
      makePlace({ id: 'kitchen', spots: ['kitchen'] }),
      makePlace({ id: 'study', spots: ['study'] }),
      makePlace({ id: 'music', spots: ['music_pavilion'] }),
      makePlace({ id: 'sewing', spots: ['sewing_room'] }),
      makePlace({ id: 'mei_room', kind: 'private_room', ownerId: MEI }),
      makePlace({ id: 'yu_room', kind: 'private_room', ownerId: YU }),
      makePlace({ id: 'lan_room', kind: 'private_room', ownerId: LAN }),
      makePlace({ id: 'quarters', kind: 'servants_quarters' }),
      makePlace({ id: 'gate', kind: 'gate' }),
    ],
    whereabouts: parts.whereabouts ?? [],
  });
}
