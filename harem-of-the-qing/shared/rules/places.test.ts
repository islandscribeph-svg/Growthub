import { describe, expect, it } from 'vitest';
import { PRIVATE_ROOM, RELATIONSHIP } from '../balance';
import { createRng } from '../rng';
import { deepFreeze, eventsOfType, makeCourt, makeLady, rejectionReasons, rollOf, scriptedRng } from '../testing/fixtures';
import { BO, COOK, EUNUCH, LAN, MAID, MEI, YU, makePalaceCourt } from '../testing/palaceFixture';
import { PHASES, type CourtState, type Lady } from '../types';
import { advancePhase } from './clock';
import {
  areTogether,
  enterPlace,
  favouriteSpot,
  isInOwnRoom,
  ownRoomOf,
  peopleIn,
  placeOf,
  regularPresent,
  spotRegular,
  stirCourt,
  usualPlacesOfCharacter,
  usualPlacesOfServant,
} from './places';
import { relationshipBetween } from './relationships';

const WELCOME = PRIVATE_ROOM.welcomeFromRelationship;
const LOSS = PRIVATE_ROOM.relationshipLoss;

function enter(state: CourtState, actorId: string, placeId: string | null) {
  return enterPlace(state, { type: 'enter_place', actorId, placeId });
}

function ladyOf(state: CourtState, id: string): Lady {
  const character = state.characters[id];
  if (character?.path !== 'lady') throw new Error(`${id} is not a lady`);
  return character;
}

describe('where people are', () => {
  it('puts a character in the place she steps into', () => {
    const result = enter(makePalaceCourt(), LAN, 'study');
    expect(placeOf(result.state, LAN)?.id).toBe('study');
    expect(result.events).toEqual([{ type: 'place_entered', characterId: LAN, placeId: 'study' }]);
  });

  it('takes her off the map when she steps out of every place', () => {
    const result = enter(makePalaceCourt({ whereabouts: [[LAN, 'study']] }), LAN, null);
    expect(placeOf(result.state, LAN)).toBeNull();
    expect(result.state.whereabouts).not.toHaveProperty(LAN);
  });

  it('does nothing when she is already there', () => {
    const court = makePalaceCourt({ whereabouts: [[LAN, 'study']] });
    const result = enter(court, LAN, 'study');
    expect(result.state).toBe(court);
    expect(result.events).toEqual([]);
  });

  it('refuses a place that is not on the map, and a character who is not in the court', () => {
    const court = makePalaceCourt();
    expect(rejectionReasons(enter(court, LAN, 'moon').events)).toEqual(['unknown_place']);
    expect(rejectionReasons(enter(court, 'nobody', 'study').events)).toEqual(['unknown_character']);
    expect(enter(court, LAN, 'moon').state).toBe(court);
  });

  it('knows who is together, who is in a place, and whose room is whose', () => {
    const court = makePalaceCourt({ whereabouts: [[LAN, 'lan_room'], [MAID, 'lan_room'], [MEI, 'hall']] });
    expect(areTogether(court, LAN, MAID)).toBe(true);
    expect(areTogether(court, LAN, MEI)).toBe(false);
    expect(areTogether(court, YU, BO)).toBe(false);
    expect(peopleIn(court, 'lan_room').sort()).toEqual([LAN, MAID]);
    expect(ownRoomOf(court, MEI)?.id).toBe('mei_room');
    expect(ownRoomOf(court, BO)).toBeNull();
    expect(isInOwnRoom(court, LAN)).toBe(true);
    expect(isInOwnRoom(court, MEI)).toBe(false);
  });

  it('never changes the court it is given', () => {
    const court = deepFreeze(makePalaceCourt({ whereabouts: [[MEI, 'mei_room']] }));
    expect(() => enter(court, LAN, 'mei_room')).not.toThrow();
    expect(() => stirCourt(court, createRng('frozen'))).not.toThrow();
  });
});

describe("walking in on a lady in her own room", () => {
  const meiInHerRoom = [[MEI, 'mei_room']] as const;

  it('costs relationship with her', () => {
    const result = enter(makePalaceCourt({ whereabouts: meiInHerRoom }), LAN, 'mei_room');
    expect(relationshipBetween(result.state, LAN, MEI)).toBe(RELATIONSHIP.strangers - LOSS);
    expect(eventsOfType(result.events, 'walked_in_on')).toEqual([
      { type: 'walked_in_on', characterId: LAN, onId: MEI, placeId: 'mei_room', outcome: 'charged' },
    ]);
    expect(eventsOfType(result.events, 'relationship_changed')[0]?.cause).toBe('walked_in_on_her');
    expect(ladyOf(result.state, LAN).today.walkedInOn).toEqual([MEI]);
  });

  it('costs nothing when the room is empty', () => {
    const result = enter(makePalaceCourt({ whereabouts: [[MEI, 'hall']] }), LAN, 'mei_room');
    expect(relationshipBetween(result.state, LAN, MEI)).toBe(RELATIONSHIP.strangers);
    expect(eventsOfType(result.events, 'walked_in_on')).toEqual([]);
  });

  it('costs nothing in her own room, or in a room that is nobody\'s', () => {
    const court = makePalaceCourt({ whereabouts: [[MEI, 'study'], [MAID, 'lan_room']] });
    expect(enter(court, LAN, 'lan_room').events).toHaveLength(1);
    expect(enter(court, LAN, 'study').events).toHaveLength(1);
  });

  it('costs nothing exactly on the welcome threshold, and costs just below it', () => {
    const welcome = enter(makePalaceCourt({ whereabouts: meiInHerRoom, relationships: [[LAN, MEI, WELCOME]] }), LAN, 'mei_room');
    expect(relationshipBetween(welcome.state, LAN, MEI)).toBe(WELCOME);
    expect(eventsOfType(welcome.events, 'walked_in_on')[0]?.outcome).toBe('welcome');
    expect(ladyOf(welcome.state, LAN).today.walkedInOn).toEqual([]);

    const justBelow = enter(makePalaceCourt({ whereabouts: meiInHerRoom, relationships: [[LAN, MEI, WELCOME - 1]] }), LAN, 'mei_room');
    expect(relationshipBetween(justBelow.state, LAN, MEI)).toBe(WELCOME - 1 - LOSS);
  });

  it('counts once per lady per game day, and again the next day', () => {
    const first = enter(makePalaceCourt({ phase: 'night', whereabouts: meiInHerRoom }), LAN, 'mei_room');
    const out = enter(first.state, LAN, 'hall');
    const again = enter(out.state, LAN, 'mei_room');
    expect(relationshipBetween(again.state, LAN, MEI)).toBe(RELATIONSHIP.strangers - LOSS);
    expect(eventsOfType(again.events, 'walked_in_on')[0]?.outcome).toBe('already_counted');

    const nextDay = advancePhase(enter(again.state, LAN, 'hall').state);
    const tomorrow = enter(nextDay.state, LAN, 'mei_room');
    expect(relationshipBetween(tomorrow.state, LAN, MEI)).toBe(RELATIONSHIP.strangers - LOSS - LOSS);
  });

  it('counts separately for each lady', () => {
    const court = makePalaceCourt({ whereabouts: [[MEI, 'mei_room'], [YU, 'yu_room']] });
    const both = enter(enter(court, LAN, 'mei_room').state, LAN, 'yu_room');
    expect(relationshipBetween(both.state, LAN, MEI)).toBe(RELATIONSHIP.strangers - LOSS);
    expect(relationshipBetween(both.state, LAN, YU)).toBe(RELATIONSHIP.strangers - LOSS);
  });

  it('costs nothing to a lady who outranks the one she walks in on', () => {
    const result = enter(makePalaceCourt({ whereabouts: [[YU, 'yu_room']] }), MEI, 'yu_room');
    expect(relationshipBetween(result.state, MEI, YU)).toBe(RELATIONSHIP.strangers);
    expect(eventsOfType(result.events, 'walked_in_on')[0]?.outcome).toBe('welcome');
  });

  it('costs a guard too, since he does not outrank a lady', () => {
    const result = enter(makePalaceCourt({ whereabouts: meiInHerRoom }), BO, 'mei_room');
    expect(relationshipBetween(result.state, BO, MEI)).toBe(RELATIONSHIP.strangers - LOSS);
  });

  it('never takes a relationship below 0', () => {
    const result = enter(makePalaceCourt({ whereabouts: meiInHerRoom, relationships: [[LAN, MEI, 1]] }), LAN, 'mei_room');
    expect(relationshipBetween(result.state, LAN, MEI)).toBe(0);
  });
});

describe('the regular of an activity spot', () => {
  it('is the highest-ranked lady of the palace whose best talent is trained there', () => {
    const court = makePalaceCourt({ mei: { talents: { ...makeLady({ id: 'x' }).talents, singing: 80 } } });
    const music = court.places['music'];
    if (!music) throw new Error('no music room');
    expect(favouriteSpot(ladyOf(court, YU))).toBe('music_pavilion');
    expect(spotRegular(court, music, 'music_pavilion')?.id).toBe(MEI);
    expect(spotRegular(court, music, 'kitchen')).toBeNull();
  });

  it('is only present when she is standing there, and is never the one asking', () => {
    const away = makePalaceCourt({ whereabouts: [[YU, 'yard']] });
    const there = makePalaceCourt({ whereabouts: [[YU, 'music']] });
    const music = there.places['music'];
    if (!music) throw new Error('no music room');
    expect(regularPresent(away, music, 'music_pavilion', LAN)).toBeNull();
    expect(regularPresent(there, music, 'music_pavilion', LAN)?.id).toBe(YU);
    expect(regularPresent(there, music, 'music_pavilion', YU)).toBeNull();
  });

  it('has a favourite spot even when every talent is level: the first in the list', () => {
    expect(favouriteSpot(makeLady({ id: 'plain' }))).toBe('dressing_room');
  });
});

describe('where NPCs and servants spend each phase', () => {
  const usual = (phase: (typeof PHASES)[number], id: string): string[] => {
    const court = makePalaceCourt({ phase });
    return usualPlacesOfCharacter(court, court.characters[id] ?? ladyOf(court, id));
  };

  it('finds a palace mistress in her hall, walking the courtyard, or in her room', () => {
    expect(usual('morning', MEI)).toEqual(['hall']);
    expect(usual('day', MEI)).toEqual(['hall', 'yard', 'mei_room']);
    expect(usual('evening', MEI)).toEqual(['hall', 'mei_room']);
    expect(usual('night', MEI)).toEqual(['mei_room']);
  });

  it('finds another lady at Morning respects, then at her favourite spot, the courtyard or her room', () => {
    expect(usual('morning', YU)).toEqual(['hall']);
    expect(usual('day', YU)).toEqual(['music', 'yard', 'yu_room']);
    expect(usual('evening', YU)).toEqual(['yard', 'yu_room']);
    expect(usual('night', YU)).toEqual(['yu_room']);
  });

  it('keeps a guard at the gate in every phase', () => {
    for (const phase of PHASES) expect(usual(phase, BO)).toEqual(['gate']);
  });

  it('keeps a personal maid in her lady\'s room, the cook in the kitchen and the eunuch in the yard, until they go to bed', () => {
    for (const phase of PHASES) {
      const court = makePalaceCourt({ phase });
      const places = (id: string): string[] => {
        const servant = court.servants[id];
        if (!servant) throw new Error(`no servant ${id}`);
        return usualPlacesOfServant(court, servant);
      };
      expect(places(MAID)).toEqual(['lan_room']);
      expect(places(COOK)).toEqual([phase === 'night' ? 'quarters' : 'kitchen']);
      expect(places(EUNUCH)).toEqual([phase === 'morning' || phase === 'day' ? 'yard' : 'quarters']);
    }
  });

  it('has nowhere for a lady in the Cold Palace, or in a palace with no mapped places', () => {
    const exiled = makePalaceCourt({ mei: { exiledThroughDay: 3 } });
    expect(usualPlacesOfCharacter(exiled, ladyOf(exiled, MEI))).toEqual([]);
    const unmapped = makeCourt({ characters: [makeLady({ id: 'far', rank: 'consort', palaceId: 'elsewhere' })] });
    expect(usualPlacesOfCharacter(unmapped, ladyOf(unmapped, 'far'))).toEqual([]);
  });
});

describe('the court stirring', () => {
  it('gathers the ladies in the main hall each Morning and sends them to their rooms at Night', () => {
    const morning = stirCourt(makePalaceCourt({ phase: 'morning' }), createRng('a')).state;
    expect(morning.whereabouts[MEI]).toBe('hall');
    expect(morning.whereabouts[YU]).toBe('hall');
    expect(morning.whereabouts[BO]).toBe('gate');
    expect(morning.whereabouts[MAID]).toBe('lan_room');
    const night = stirCourt({ ...morning, phase: 'night' }, createRng('a')).state;
    expect(night.whereabouts[MEI]).toBe('mei_room');
    expect(night.whereabouts[YU]).toBe('yu_room');
    expect(night.whereabouts[COOK]).toBe('quarters');
  });

  it('never moves a player', () => {
    const court = makePalaceCourt({ whereabouts: [[LAN, 'study']] });
    for (const seed of ['a', 'b', 'c']) {
      expect(stirCourt(court, createRng(seed)).state.whereabouts[LAN]).toBe('study');
    }
    expect(stirCourt(makePalaceCourt(), createRng('a')).state.whereabouts).not.toHaveProperty(LAN);
  });

  it('only ever picks from the usual places, over many stirs', () => {
    let court = makePalaceCourt({ phase: 'day' });
    const rng = createRng('many');
    const seen = new Set<string>();
    for (let stir = 0; stir < 60; stir++) {
      court = stirCourt(court, rng).state;
      seen.add(court.whereabouts[MEI] ?? 'nowhere');
      expect(['music', 'yard', 'yu_room']).toContain(court.whereabouts[YU]);
    }
    expect([...seen].sort()).toEqual(['hall', 'mei_room', 'yard']);
  });

  it('follows the dice: the roll picks the place', () => {
    const lowest = rollOf(0, 2, 0);
    const highest = rollOf(0, 2, 2);
    const rolls = (meiRoll: number): number[] => [meiRoll, lowest, lowest, lowest, lowest, lowest];
    expect(stirCourt(makePalaceCourt(), scriptedRng(rolls(lowest))).state.whereabouts[MEI]).toBe('hall');
    expect(stirCourt(makePalaceCourt(), scriptedRng(rolls(highest))).state.whereabouts[MEI]).toBe('mei_room');
  });

  it('gives the same court from the same seed', () => {
    const one = stirCourt(makePalaceCourt(), createRng('same'));
    const two = stirCourt(makePalaceCourt(), createRng('same'));
    expect(one).toEqual(two);
  });

  it('reports only the moves that happened', () => {
    const settled = stirCourt(makePalaceCourt({ phase: 'night' }), createRng('a'));
    expect(eventsOfType(settled.events, 'whereabouts_changed').length).toBeGreaterThan(0);
    const again = stirCourt(settled.state, createRng('b'));
    expect(again.events).toEqual([]);
    expect(again.state).toBe(settled.state);
  });

  it('takes a lady sent to the Cold Palace off the map', () => {
    const court = makePalaceCourt({ mei: { exiledThroughDay: 5 }, whereabouts: [[MEI, 'hall']] });
    const result = stirCourt(court, createRng('a'));
    expect(result.state.whereabouts).not.toHaveProperty(MEI);
    expect(result.events).toContainEqual({ type: 'whereabouts_changed', id: MEI, from: 'hall', to: null });
  });
});
