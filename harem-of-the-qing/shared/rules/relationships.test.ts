import { describe, expect, it } from 'vitest';
import { ENERGY, HATED, RELATIONSHIP, RELATIONSHIP_CHANGE, STEPPING_ON_TOES } from '../balance';
import {
  HIGHEST_ROLL,
  LOWEST_ROLL,
  deepFreeze,
  eventsOfType,
  makeCourt,
  makeGuard,
  makeLady,
  makeMaid,
  rejectionReasons,
  scriptedRng,
} from '../testing/fixtures';
import { EMPEROR_ID, EMPRESS_DOWAGER_ID, type Phase } from '../types';
import {
  applyCaughtSabotagingFallout,
  applyKindness,
  applyWitnessFallout,
  areFriends,
  averageRelationship,
  changeRelationship,
  friendsOf,
  greet,
  haremAverage,
  isHated,
  palaceMistress,
  payRespects,
  relationshipBetween,
  statusPanelRelationships,
} from './relationships';
import { train } from './training';

const FRIENDS = RELATIONSHIP.friendsFrom;

describe('relationship scores', () => {
  it('start at the strangers score for a pair who have never dealt with each other', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })] });
    expect(relationshipBetween(court, 'lan', 'mei')).toBe(RELATIONSHIP.strangers);
    expect(relationshipBetween(court, 'lan', EMPRESS_DOWAGER_ID)).toBe(RELATIONSHIP.strangers);
  });

  it('are one score per pair, the same from either side', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })] });
    const after = changeRelationship(court, 'mei', 'lan', 7, 'gift').state;
    expect(relationshipBetween(after, 'lan', 'mei')).toBe(RELATIONSHIP.strangers + 7);
    expect(relationshipBetween(after, 'mei', 'lan')).toBe(RELATIONSHIP.strangers + 7);
    expect(Object.keys(after.relationships)).toHaveLength(1);
  });

  it('exist between ladies, guards and the Empress Dowager', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' }), makeGuard({ id: 'bo' })] });
    expect(relationshipBetween(changeRelationship(court, 'lan', 'bo', 5, 'gift').state, 'bo', 'lan')).toBe(
      RELATIONSHIP.strangers + 5,
    );
    expect(
      relationshipBetween(changeRelationship(court, 'lan', EMPRESS_DOWAGER_ID, 5, 'gift').state, 'lan', EMPRESS_DOWAGER_ID),
    ).toBe(RELATIONSHIP.strangers + 5);
  });

  it('report each change with where the score was and where it is now', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })] });
    expect(changeRelationship(court, 'mei', 'lan', -3, 'gift').events).toEqual([
      {
        type: 'relationship_changed',
        between: ['lan', 'mei'],
        from: RELATIONSHIP.strangers,
        to: RELATIONSHIP.strangers - 3,
        cause: 'gift',
      },
    ]);
  });

  it('never go below the bottom of the scale', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' }), makeLady({ id: 'yu' })],
      relationships: [['lan', 'mei', 5]],
    });
    expect(relationshipBetween(changeRelationship(court, 'lan', 'mei', -60, 'caught_sabotaging_her').state, 'lan', 'mei')).toBe(
      RELATIONSHIP.min,
    );
  });

  it('never go above the top of the scale', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      relationships: [['lan', 'mei', 96]],
    });
    expect(relationshipBetween(changeRelationship(court, 'lan', 'mei', 10, 'gift').state, 'lan', 'mei')).toBe(RELATIONSHIP.max);
  });

  it('report nothing when the score is already at the end of the scale', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      relationships: [['lan', 'mei', RELATIONSHIP.max]],
    });
    const result = changeRelationship(court, 'lan', 'mei', 1, 'greeting');
    expect(result.events).toEqual([]);
    expect(result.state).toBe(court);
  });

  it('cannot be changed with oneself, with the Emperor, or with someone who is not in the court', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' })] });
    expect(changeRelationship(court, 'lan', 'lan', 5, 'gift').state).toBe(court);
    expect(() => changeRelationship(court, 'lan', EMPEROR_ID, 5, 'gift')).toThrow();
    expect(() => changeRelationship(court, 'lan', 'nobody', 5, 'gift')).toThrow();
  });

  it('never change the state they were given', () => {
    const court = deepFreeze(
      makeCourt({ characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })], relationships: [['lan', 'mei', 40]] }),
    );
    expect(() => changeRelationship(court, 'lan', 'mei', -45, 'caught_sabotaging_her')).not.toThrow();
    expect(relationshipBetween(court, 'lan', 'mei')).toBe(40);
  });
});

describe('friends', () => {
  it('are two characters whose score is exactly the friends score or higher', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' }), makeLady({ id: 'yu' }), makeGuard({ id: 'bo' })],
      relationships: [
        ['lan', 'mei', FRIENDS],
        ['lan', 'yu', FRIENDS - 1],
        ['lan', 'bo', RELATIONSHIP.max],
      ],
    });
    expect(areFriends(court, 'lan', 'mei')).toBe(true);
    expect(areFriends(court, 'mei', 'lan')).toBe(true);
    expect(areFriends(court, 'lan', 'yu')).toBe(false);
    expect(areFriends(court, 'lan', 'lan')).toBe(false);
    expect(friendsOf(court, 'lan').sort()).toEqual(['bo', 'mei']);
  });

  it('are announced when the score reaches the friends score, and when it drops back below', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      relationships: [['lan', 'mei', FRIENDS - 1]],
    });
    const up = changeRelationship(court, 'lan', 'mei', 1, 'greeting');
    expect(eventsOfType(up.events, 'became_friends')).toEqual([{ type: 'became_friends', between: ['lan', 'mei'] }]);
    const again = changeRelationship(up.state, 'lan', 'mei', 1, 'greeting');
    expect(eventsOfType(again.events, 'became_friends')).toEqual([]);
    const down = changeRelationship(up.state, 'lan', 'mei', -1, 'gift');
    expect(eventsOfType(down.events, 'friendship_ended')).toEqual([{ type: 'friendship_ended', between: ['lan', 'mei'] }]);
  });
});

describe('the hated state', () => {
  const HATED_BELOW = RELATIONSHIP.hatedBelow;

  it('is an average across every other lady of the harem', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' }), makeLady({ id: 'yu', palaceId: 'palace_2' })],
      relationships: [
        ['lan', 'mei', 10],
        ['lan', 'yu', 40],
      ],
    });
    expect(haremAverage(court, 'lan')).toBe(25);
    expect(haremAverage(court, 'mei')).toBe((10 + RELATIONSHIP.strangers) / 2);
  });

  it('does not count guards or the Empress Dowager in the average', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' }), makeGuard({ id: 'bo' })],
      relationships: [
        ['lan', 'mei', 20],
        ['lan', 'bo', 0],
        ['lan', EMPRESS_DOWAGER_ID, 0],
      ],
    });
    expect(haremAverage(court, 'lan')).toBe(20);
  });

  it('begins just below the hated score, not exactly on it', () => {
    const onTheLine = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      relationships: [['lan', 'mei', HATED_BELOW]],
    });
    expect(isHated(onTheLine, 'lan')).toBe(false);
    const below = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      relationships: [['lan', 'mei', HATED_BELOW - 1]],
    });
    expect(isHated(below, 'lan')).toBe(true);
  });

  it('never applies to a lady who is the only lady, or to a guard', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' }), makeGuard({ id: 'bo' })], relationships: [['lan', 'bo', 0]] });
    expect(haremAverage(court, 'lan')).toBeNull();
    expect(isHated(court, 'lan')).toBe(false);
    expect(isHated(court, 'bo')).toBe(false);
  });

  it('drops the loyalty of her own servants, once, when she becomes hated', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' }), makeLady({ id: 'yu' })],
      servants: [
        makeMaid({ id: 'lan_maid', servesId: 'lan', loyalty: 50 }),
        makeMaid({ id: 'mei_maid', servesId: 'mei', loyalty: 50 }),
      ],
      relationships: [
        ['lan', 'mei', HATED_BELOW],
        ['lan', 'yu', HATED_BELOW],
      ],
    });
    const result = changeRelationship(court, 'lan', 'mei', -1, 'gift');
    expect(isHated(result.state, 'lan')).toBe(true);
    expect(eventsOfType(result.events, 'became_hated')).toEqual([{ type: 'became_hated', characterId: 'lan' }]);
    expect(result.state.servants['lan_maid']?.loyalty).toBe(50 - HATED.servantLoyaltyLoss);
    expect(result.state.servants['mei_maid']?.loyalty).toBe(50);

    const further = changeRelationship(result.state, 'lan', 'yu', -1, 'gift');
    expect(eventsOfType(further.events, 'became_hated')).toEqual([]);
    expect(further.state.servants['lan_maid']?.loyalty).toBe(50 - HATED.servantLoyaltyLoss);
  });

  it('never takes a servant below 0 loyalty', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      servants: [makeMaid({ id: 'lan_maid', servesId: 'lan', loyalty: HATED.servantLoyaltyLoss - 5 })],
      relationships: [['lan', 'mei', HATED_BELOW]],
    });
    const result = changeRelationship(court, 'lan', 'mei', -1, 'gift');
    expect(result.state.servants['lan_maid']?.loyalty).toBe(0);
  });

  it('can make both ladies of a pair hated at once', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      relationships: [['lan', 'mei', HATED_BELOW]],
    });
    const result = changeRelationship(court, 'lan', 'mei', -1, 'gift');
    expect(eventsOfType(result.events, 'became_hated').map((event) => event.characterId).sort()).toEqual(['lan', 'mei']);
  });

  it('ends when her average climbs back to the hated score', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      relationships: [['lan', 'mei', HATED_BELOW - 1]],
    });
    const result = changeRelationship(court, 'lan', 'mei', 1, 'greeting');
    expect(isHated(result.state, 'lan')).toBe(false);
    expect(eventsOfType(result.events, 'no_longer_hated').map((event) => event.characterId).sort()).toEqual(['lan', 'mei']);
  });
});

describe('group averages', () => {
  it('average one character with any group, leaving herself out', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' }), makeLady({ id: 'yu' })],
      relationships: [
        ['lan', 'mei', 50],
        ['lan', 'yu', 20],
      ],
    });
    expect(averageRelationship(court, 'lan', ['mei', 'yu'])).toBe(35);
    expect(averageRelationship(court, 'lan', ['lan', 'mei'])).toBe(50);
    expect(averageRelationship(court, 'lan', [])).toBeNull();
  });

  it('fill the grouped rows of the status panel', () => {
    const court = makeCourt({
      characters: [
        makeLady({ id: 'lan' }),
        makeLady({ id: 'mistress', rank: 'consort' }),
        makeLady({ id: 'mei' }),
        makeLady({ id: 'yu' }),
        makeLady({ id: 'empress', rank: 'empress', palaceId: 'empress_palace' }),
        makeLady({ id: 'far_1', palaceId: 'palace_2' }),
        makeLady({ id: 'far_2', palaceId: 'palace_3' }),
        makeGuard({ id: 'bo' }),
      ],
      relationships: [
        ['lan', EMPRESS_DOWAGER_ID, 33],
        ['lan', 'empress', 22],
        ['lan', 'mistress', 55],
        ['lan', 'mei', 50],
        ['lan', 'yu', 31],
        ['lan', 'far_1', 10],
        ['lan', 'far_2', 11],
        ['lan', 'bo', 99],
      ],
    });
    expect(statusPanelRelationships(court, 'lan')).toEqual({
      empressDowager: 33,
      empress: 22,
      palaceMistress: 55,
      ownPalaceLadies: 41,
      otherPalaces: 11,
    });
  });

  it('leave a row empty when there is nobody in it', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' })] });
    expect(statusPanelRelationships(court, 'lan')).toEqual({
      empressDowager: RELATIONSHIP.strangers,
      empress: null,
      palaceMistress: null,
      ownPalaceLadies: null,
      otherPalaces: null,
    });
    expect(statusPanelRelationships(court, 'nobody')).toBeNull();
  });
});

describe('the palace mistress', () => {
  it('is the highest-ranked resident', () => {
    const court = makeCourt({
      characters: [
        makeLady({ id: 'concubine', rank: 'imperial_concubine' }),
        makeLady({ id: 'consort', rank: 'consort' }),
        makeLady({ id: 'elsewhere', rank: 'noble_consort', palaceId: 'palace_2' }),
      ],
    });
    expect(palaceMistress(court, 'palace_1')?.id).toBe('consort');
    expect(palaceMistress(court, 'palace_2')?.id).toBe('elsewhere');
  });

  it('must be an Imperial Concubine or above', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'noble', rank: 'noble_lady' }), makeLady({ id: 'lan' })] });
    expect(palaceMistress(court, 'palace_1')).toBeNull();
  });

  it('is the one with more favor when two residents share the top rank', () => {
    const court = makeCourt({
      characters: [
        makeLady({ id: 'a', rank: 'imperial_concubine', favor: 60 }),
        makeLady({ id: 'b', rank: 'imperial_concubine', favor: 61 }),
      ],
    });
    expect(palaceMistress(court, 'palace_1')?.id).toBe('b');
  });

  it('is not a lady who is away in the Cold Palace', () => {
    const court = makeCourt({
      day: 3,
      characters: [
        makeLady({ id: 'away', rank: 'consort', exiledThroughDay: 5 }),
        makeLady({ id: 'home', rank: 'imperial_concubine' }),
      ],
    });
    expect(palaceMistress(court, 'palace_1')?.id).toBe('home');
  });
});

describe('Morning respects', () => {
  const household = (phase: Phase = 'morning') =>
    makeCourt({
      phase,
      characters: [
        makeLady({ id: 'lan', energy: ENERGY.perDay }),
        makeLady({ id: 'mistress', rank: 'consort' }),
        makeLady({ id: 'empress', rank: 'empress', palaceId: 'empress_palace' }),
      ],
    });

  it('raise the relationship with her palace mistress, and cost no energy', () => {
    const result = payRespects(household(), { type: 'pay_respects', actorId: 'lan' });
    expect(relationshipBetween(result.state, 'lan', 'mistress')).toBe(
      RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.respectsOrGreeting,
    );
    expect(result.state.characters['lan']?.energy).toBe(ENERGY.perDay);
    expect(eventsOfType(result.events, 'respects_paid')).toEqual([{ type: 'respects_paid', characterId: 'lan', toId: 'mistress' }]);
    expect(eventsOfType(result.events, 'relationship_changed')[0]?.cause).toBe('morning_respects');
  });

  it('count once a Morning, and again the next Morning', () => {
    const once = payRespects(household(), { type: 'pay_respects', actorId: 'lan' });
    const twice = payRespects(once.state, { type: 'pay_respects', actorId: 'lan' });
    expect(rejectionReasons(twice.events)).toEqual(['already_paid_respects']);
    expect(relationshipBetween(twice.state, 'lan', 'mistress')).toBe(
      RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.respectsOrGreeting,
    );
  });

  it('go from a mistress to the Empress', () => {
    const result = payRespects(household(), { type: 'pay_respects', actorId: 'mistress' });
    expect(eventsOfType(result.events, 'respects_paid')[0]?.toId).toBe('empress');
    expect(relationshipBetween(result.state, 'mistress', 'empress')).toBe(
      RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.respectsOrGreeting,
    );
  });

  it('are refused when there is nobody to bow to', () => {
    expect(rejectionReasons(payRespects(household(), { type: 'pay_respects', actorId: 'empress' }).events)).toEqual([
      'nobody_to_pay_respects_to',
    ]);
    const noMistress = makeCourt({ phase: 'morning', characters: [makeLady({ id: 'lan' })] });
    expect(rejectionReasons(payRespects(noMistress, { type: 'pay_respects', actorId: 'lan' }).events)).toEqual([
      'nobody_to_pay_respects_to',
    ]);
    const noEmpress = makeCourt({ phase: 'morning', characters: [makeLady({ id: 'mistress', rank: 'consort' })] });
    expect(rejectionReasons(payRespects(noEmpress, { type: 'pay_respects', actorId: 'mistress' }).events)).toEqual([
      'nobody_to_pay_respects_to',
    ]);
  });

  it('can only be paid in the Morning', () => {
    const wrongPhases: Phase[] = ['day', 'evening', 'night'];
    for (const phase of wrongPhases) {
      expect(rejectionReasons(payRespects(household(phase), { type: 'pay_respects', actorId: 'lan' }).events)).toEqual([
        'wrong_phase',
      ]);
    }
  });

  it('are refused for a guard and for someone who is not in the court', () => {
    const court = makeCourt({ phase: 'morning', characters: [makeGuard({ id: 'bo' })] });
    expect(rejectionReasons(payRespects(court, { type: 'pay_respects', actorId: 'bo' }).events)).toEqual(['not_a_lady']);
    expect(rejectionReasons(payRespects(court, { type: 'pay_respects', actorId: 'nobody' }).events)).toEqual(['unknown_character']);
  });

  it('never change the state they were given', () => {
    const court = deepFreeze(household());
    expect(() => payRespects(court, { type: 'pay_respects', actorId: 'lan' })).not.toThrow();
  });
});

describe('a greeting', () => {
  const pair = (energy: number = ENERGY.perDay, phase: Phase = 'day') =>
    makeCourt({ phase, characters: [makeLady({ id: 'lan', energy }), makeLady({ id: 'mei' }), makeGuard({ id: 'bo' })] });

  it('raises the relationship and costs the socializing energy', () => {
    const result = greet(pair(), { type: 'greet', actorId: 'lan', targetId: 'mei' });
    expect(relationshipBetween(result.state, 'lan', 'mei')).toBe(RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.respectsOrGreeting);
    expect(result.state.characters['lan']?.energy).toBe(ENERGY.perDay - ENERGY.socializing);
    expect(result.state.characters['mei']?.energy).toBe(ENERGY.perDay);
  });

  it('can be given to a guard and to the Empress Dowager, and by a guard', () => {
    expect(rejectionReasons(greet(pair(), { type: 'greet', actorId: 'lan', targetId: 'bo' }).events)).toEqual([]);
    expect(rejectionReasons(greet(pair(), { type: 'greet', actorId: 'lan', targetId: EMPRESS_DOWAGER_ID }).events)).toEqual([]);
    expect(rejectionReasons(greet(pair(), { type: 'greet', actorId: 'bo', targetId: 'lan' }).events)).toEqual([]);
  });

  it('is refused without energy, outside the Day phase, to herself, and to someone with no relationship score', () => {
    expect(rejectionReasons(greet(pair(0), { type: 'greet', actorId: 'lan', targetId: 'mei' }).events)).toEqual([
      'not_enough_energy',
    ]);
    expect(rejectionReasons(greet(pair(10, 'evening'), { type: 'greet', actorId: 'lan', targetId: 'mei' }).events)).toEqual([
      'wrong_phase',
    ]);
    expect(rejectionReasons(greet(pair(), { type: 'greet', actorId: 'lan', targetId: 'lan' }).events)).toEqual([
      'cannot_target_self',
    ]);
    expect(rejectionReasons(greet(pair(), { type: 'greet', actorId: 'lan', targetId: EMPEROR_ID }).events)).toEqual([
      'unknown_recipient',
    ]);
    expect(rejectionReasons(greet(pair(), { type: 'greet', actorId: 'nobody', targetId: 'mei' }).events)).toEqual([
      'unknown_character',
    ]);
  });

  it('still costs energy when the score is already at the top', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      relationships: [['lan', 'mei', RELATIONSHIP.max]],
    });
    const result = greet(court, { type: 'greet', actorId: 'lan', targetId: 'mei' });
    expect(relationshipBetween(result.state, 'lan', 'mei')).toBe(RELATIONSHIP.max);
    expect(result.state.characters['lan']?.energy).toBe(ENERGY.perDay - ENERGY.socializing);
  });
});

describe('helping with her task, or warning her of a plot', () => {
  const court = makeCourt({ characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mei' })] });

  it('is worth the lowest gain on the lowest roll and the highest gain on the highest roll', () => {
    const low = applyKindness(court, 'lan', 'mei', 'help', scriptedRng([LOWEST_ROLL]));
    expect(relationshipBetween(low.state, 'lan', 'mei')).toBe(RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.helpMin);
    const high = applyKindness(court, 'lan', 'mei', 'warning_of_a_plot', scriptedRng([HIGHEST_ROLL]));
    expect(relationshipBetween(high.state, 'lan', 'mei')).toBe(RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.helpMax);
    expect(eventsOfType(high.events, 'relationship_changed')[0]?.cause).toBe('warning_of_a_plot');
  });
});

describe('bearing witness against her', () => {
  const court = makeCourt({
    characters: [
      makeLady({ id: 'witness' }),
      makeLady({ id: 'accused' }),
      makeLady({ id: 'friend' }),
      makeLady({ id: 'barely_friend' }),
      makeLady({ id: 'almost_friend' }),
      makeGuard({ id: 'guard_friend' }),
    ],
    relationships: [
      ['witness', 'accused', 50],
      ['accused', 'friend', 90],
      ['accused', 'barely_friend', FRIENDS],
      ['accused', 'almost_friend', FRIENDS - 1],
      ['accused', 'guard_friend', 80],
      ['witness', 'friend', 60],
    ],
  });

  it('costs the witness dearly with her, and with each of her friends', () => {
    const result = applyWitnessFallout(court, 'witness', 'accused');
    expect(relationshipBetween(result.state, 'witness', 'accused')).toBe(50 + RELATIONSHIP_CHANGE.witnessAgainstHer);
    expect(relationshipBetween(result.state, 'witness', 'friend')).toBe(60 + RELATIONSHIP_CHANGE.witnessAgainstHerFriends);
    expect(relationshipBetween(result.state, 'witness', 'barely_friend')).toBe(
      RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.witnessAgainstHerFriends,
    );
    expect(relationshipBetween(result.state, 'witness', 'guard_friend')).toBe(
      RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.witnessAgainstHerFriends,
    );
  });

  it('costs nothing with a lady who is one point short of being her friend', () => {
    const result = applyWitnessFallout(court, 'witness', 'accused');
    expect(relationshipBetween(result.state, 'witness', 'almost_friend')).toBe(RELATIONSHIP.strangers);
  });

  it('leaves her own friendships with her friends untouched', () => {
    const result = applyWitnessFallout(court, 'witness', 'accused');
    expect(relationshipBetween(result.state, 'accused', 'friend')).toBe(90);
  });

  it('does not count the witness among her friends, even when they were friends', () => {
    const friendly = makeCourt({
      characters: [makeLady({ id: 'witness' }), makeLady({ id: 'accused' })],
      relationships: [['witness', 'accused', 85]],
    });
    const result = applyWitnessFallout(friendly, 'witness', 'accused');
    expect(relationshipBetween(result.state, 'witness', 'accused')).toBe(85 + RELATIONSHIP_CHANGE.witnessAgainstHer);
    expect(eventsOfType(result.events, 'relationship_changed')).toHaveLength(1);
    expect(eventsOfType(result.events, 'friendship_ended')).toHaveLength(1);
  });

  it('stops at the bottom of the scale', () => {
    const cold = makeCourt({
      characters: [makeLady({ id: 'witness' }), makeLady({ id: 'accused' }), makeLady({ id: 'friend' })],
      relationships: [
        ['witness', 'accused', 12],
        ['accused', 'friend', 90],
        ['witness', 'friend', 4],
      ],
    });
    const result = applyWitnessFallout(cold, 'witness', 'accused');
    expect(relationshipBetween(result.state, 'witness', 'accused')).toBe(RELATIONSHIP.min);
    expect(relationshipBetween(result.state, 'witness', 'friend')).toBe(RELATIONSHIP.min);
  });
});

describe('caught sabotaging her', () => {
  const court = makeCourt({
    characters: [
      makeLady({ id: 'saboteur', palaceId: 'palace_2' }),
      makeLady({ id: 'victim' }),
      makeLady({ id: 'housemate_1' }),
      makeLady({ id: 'housemate_2' }),
      makeLady({ id: 'elsewhere', palaceId: 'palace_3' }),
    ],
    relationships: [['saboteur', 'victim', 70]],
  });

  it('costs the saboteur dearly with her, and with everyone in her palace', () => {
    const result = applyCaughtSabotagingFallout(court, 'saboteur', 'victim');
    expect(relationshipBetween(result.state, 'saboteur', 'victim')).toBe(70 + RELATIONSHIP_CHANGE.caughtSabotagingHer);
    for (const housemate of ['housemate_1', 'housemate_2']) {
      expect(relationshipBetween(result.state, 'saboteur', housemate)).toBe(
        RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.caughtSabotagingHerPalace,
      );
    }
  });

  it('costs nothing with ladies of other palaces', () => {
    const result = applyCaughtSabotagingFallout(court, 'saboteur', 'victim');
    expect(relationshipBetween(result.state, 'saboteur', 'elsewhere')).toBe(RELATIONSHIP.strangers);
  });

  it('does not charge the victim twice, or the saboteur with herself, when they share a palace', () => {
    const shared = makeCourt({ characters: [makeLady({ id: 'saboteur' }), makeLady({ id: 'victim' }), makeLady({ id: 'housemate' })] });
    const result = applyCaughtSabotagingFallout(shared, 'saboteur', 'victim');
    expect(relationshipBetween(result.state, 'saboteur', 'victim')).toBe(RELATIONSHIP.min);
    expect(eventsOfType(result.events, 'relationship_changed')).toHaveLength(2);
  });
});

describe('using her activity spot uninvited', () => {
  const SAFE = STEPPING_ON_TOES.safeFromRelationship;
  const spot = (score: number) =>
    makeCourt({
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'regular', rank: 'consort' })],
      relationships: [['lan', 'regular', score]],
    });

  it('costs relationship with the regular when she is present', () => {
    const result = train(spot(RELATIONSHIP.strangers), { type: 'train', actorId: 'lan', spot: 'kitchen', regularPresentId: 'regular' });
    expect(relationshipBetween(result.state, 'lan', 'regular')).toBe(RELATIONSHIP.strangers - STEPPING_ON_TOES.relationshipLoss);
    expect(eventsOfType(result.events, 'relationship_changed')[0]?.cause).toBe('used_her_activity_spot');
    expect(eventsOfType(result.events, 'trained')).toHaveLength(1);
  });

  it('costs nothing when the relationship is exactly the safe score, and costs one point below it', () => {
    const safe = train(spot(SAFE), { type: 'train', actorId: 'lan', spot: 'kitchen', regularPresentId: 'regular' });
    expect(relationshipBetween(safe.state, 'lan', 'regular')).toBe(SAFE);
    const unsafe = train(spot(SAFE - 1), { type: 'train', actorId: 'lan', spot: 'kitchen', regularPresentId: 'regular' });
    expect(relationshipBetween(unsafe.state, 'lan', 'regular')).toBe(SAFE - 1 - STEPPING_ON_TOES.relationshipLoss);
  });

  it('costs nothing when she asks first', () => {
    const result = train(spot(RELATIONSHIP.strangers), {
      type: 'train',
      actorId: 'lan',
      spot: 'kitchen',
      regularPresentId: 'regular',
      askedFirst: true,
    });
    expect(relationshipBetween(result.state, 'lan', 'regular')).toBe(RELATIONSHIP.strangers);
  });

  it('costs nothing when the regular is not there, or when she is the regular herself', () => {
    const away = train(spot(RELATIONSHIP.strangers), { type: 'train', actorId: 'lan', spot: 'kitchen', regularPresentId: null });
    expect(relationshipBetween(away.state, 'lan', 'regular')).toBe(RELATIONSHIP.strangers);
    const own = train(spot(RELATIONSHIP.strangers), { type: 'train', actorId: 'regular', spot: 'kitchen', regularPresentId: 'regular' });
    expect(eventsOfType(own.events, 'relationship_changed')).toEqual([]);
  });

  it('costs nothing when the training itself was refused', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan', energy: 0 }), makeLady({ id: 'regular' })] });
    const result = train(court, { type: 'train', actorId: 'lan', spot: 'kitchen', regularPresentId: 'regular' });
    expect(relationshipBetween(result.state, 'lan', 'regular')).toBe(RELATIONSHIP.strangers);
  });
});
