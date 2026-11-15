import { describe, expect, it } from 'vitest';
import { ACTIVITY_SPOT_RULES, CHILDBEARING, DOLL_UP, ENERGY, NOT_IN_THE_DOC, STAT, TRAINING } from '../balance';
import { deepFreeze, eventsOfType, makeCourt, makeGuard, makeLady, rejectionReasons } from '../testing/fixtures';
import { ACTIVITY_SPOTS, LADY_TALENTS, type ActivitySpot, type LadyTalent, type Phase } from '../types';
import { dollUp, dollUpBonusFor, dollUpBonusToday, effectiveBeauty, spotAttributeGain, train, trainingGain } from './training';

const SLOW_FROM = STAT.max - TRAINING.slowLastPoints;

function firstTalentOf(spot: ActivitySpot): LadyTalent | undefined {
  return ACTIVITY_SPOT_RULES[spot].talents[0];
}

describe('the activity spot table', () => {
  it('matches the table in section 3', () => {
    expect(ACTIVITY_SPOT_RULES.dressing_room).toMatchObject({ talents: ['makeup'], alsoRaises: 'beauty' });
    expect(ACTIVITY_SPOT_RULES.study).toMatchObject({ talents: ['poetry', 'drawing'], alsoRaises: 'intelligence' });
    expect(ACTIVITY_SPOT_RULES.music_pavilion).toMatchObject({
      talents: ['instruments', 'singing'],
      alsoRaises: 'beauty',
      attributeGain: 'small',
    });
    expect(ACTIVITY_SPOT_RULES.dance_terrace).toMatchObject({ talents: ['dancing'], alsoRaises: 'beauty' });
    expect(ACTIVITY_SPOT_RULES.sewing_room).toMatchObject({
      talents: ['sewing'],
      alsoRaises: 'obedience',
      attributeGain: 'small',
    });
    expect(ACTIVITY_SPOT_RULES.kitchen).toMatchObject({ talents: ['cooking'], alsoRaises: null });
    expect(ACTIVITY_SPOT_RULES.courtyard_chores).toMatchObject({ talents: [], alsoRaises: 'obedience' });
    expect(ACTIVITY_SPOT_RULES.servants_gossip).toMatchObject({ talents: ['plotting'], alsoRaises: null });
  });

  it('gives every talent exactly one spot', () => {
    const trainedSomewhere = ACTIVITY_SPOTS.flatMap((spot) => ACTIVITY_SPOT_RULES[spot].talents);
    expect([...trainedSomewhere].sort()).toEqual([...LADY_TALENTS].sort());
  });
});

describe('talent gains', () => {
  it('are the largest at the bottom and the smallest for the slow last points', () => {
    expect(trainingGain(STAT.min)).toBe(TRAINING.maxGain);
    expect(trainingGain(SLOW_FROM)).toBe(TRAINING.minGain);
    expect(trainingGain(STAT.max - 1)).toBe(TRAINING.minGain);
  });

  it('never grow as the talent rises, and always stay inside the range the doc gives', () => {
    let previous = trainingGain(STAT.min);
    for (let talent = STAT.min; talent <= STAT.max; talent++) {
      const gain = trainingGain(talent);
      expect(gain).toBeLessThanOrEqual(previous);
      expect(gain).toBeGreaterThanOrEqual(TRAINING.minGain);
      expect(gain).toBeLessThanOrEqual(TRAINING.maxGain);
      previous = gain;
    }
  });

  it('are still above the minimum just before the slow last points begin', () => {
    expect(trainingGain(SLOW_FROM - 1)).toBeGreaterThan(TRAINING.minGain);
  });

  it('with the starting values: 3 points below 40, 2 from 40 to 79, 1 for the last 20', () => {
    expect([0, 39, 40, 79, 80, 99].map(trainingGain)).toEqual([3, 3, 2, 2, 1, 1]);
  });
});

describe('training at an activity spot', () => {
  it('costs the training energy and raises the talent by the gain for its level', () => {
    const lan = makeLady({ id: 'lan', energy: ENERGY.perDay });
    const result = train(makeCourt({ characters: [lan] }), { type: 'train', actorId: 'lan', spot: 'kitchen' });
    const after = result.state.characters['lan'];
    expect(after?.energy).toBe(ENERGY.perDay - ENERGY.training);
    expect(after?.path === 'lady' && after.talents.cooking).toBe(trainingGain(0));
    expect(result.events).toEqual([
      {
        type: 'trained',
        characterId: 'lan',
        spot: 'kitchen',
        talent: 'cooking',
        talentGain: trainingGain(0),
        attribute: null,
        attributeGain: 0,
      },
    ]);
  });

  it('raises the right talent at every spot and leaves the others alone', () => {
    for (const spot of ACTIVITY_SPOTS) {
      for (const talent of ACTIVITY_SPOT_RULES[spot].talents) {
        const lan = makeLady({ id: 'lan' });
        const after = train(makeCourt({ characters: [lan] }), { type: 'train', actorId: 'lan', spot, talent }).state
          .characters['lan'];
        if (after?.path !== 'lady') throw new Error('expected a lady');
        for (const other of LADY_TALENTS) {
          expect(after.talents[other]).toBe(other === talent ? trainingGain(0) : 0);
        }
      }
    }
  });

  it('lets her choose between the two talents of the study and of the music pavilion', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' })] });
    const drawing = train(court, { type: 'train', actorId: 'lan', spot: 'study', talent: 'drawing' });
    expect(eventsOfType(drawing.events, 'trained')[0]?.talent).toBe('drawing');
    const singing = train(court, { type: 'train', actorId: 'lan', spot: 'music_pavilion', talent: 'singing' });
    expect(eventsOfType(singing.events, 'trained')[0]?.talent).toBe('singing');
  });

  it('refuses a spot with two talents when she has not chosen one', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' })] });
    const result = train(court, { type: 'train', actorId: 'lan', spot: 'study' });
    expect(rejectionReasons(result.events)).toEqual(['talent_not_chosen']);
    expect(result.state).toBe(court);
  });

  it('refuses a talent the spot does not train', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan' })] });
    expect(rejectionReasons(train(court, { type: 'train', actorId: 'lan', spot: 'kitchen', talent: 'poetry' }).events)).toEqual([
      'spot_does_not_train_that_talent',
    ]);
    expect(
      rejectionReasons(train(court, { type: 'train', actorId: 'lan', spot: 'courtyard_chores', talent: 'sewing' }).events),
    ).toEqual(['spot_does_not_train_that_talent']);
  });

  it('raises no talent for courtyard chores, but still costs the energy', () => {
    const lan = makeLady({ id: 'lan' });
    const result = train(makeCourt({ characters: [lan] }), { type: 'train', actorId: 'lan', spot: 'courtyard_chores' });
    const after = result.state.characters['lan'];
    if (after?.path !== 'lady') throw new Error('expected a lady');
    expect(after.talents).toEqual(lan.talents);
    expect(after.energy).toBe(lan.energy - ENERGY.training);
    expect(eventsOfType(result.events, 'trained')[0]).toMatchObject({ talent: null, attribute: 'obedience' });
  });

  it('uses the slow gain inside the last points and never takes a talent above the top', () => {
    const cases: [number, number][] = [
      [SLOW_FROM, SLOW_FROM + TRAINING.minGain],
      [STAT.max - 1, STAT.max],
      [STAT.max, STAT.max],
    ];
    for (const [before, expected] of cases) {
      const lan = makeLady({ id: 'lan', talents: { ...makeLady({ id: 'x' }).talents, sewing: before } });
      const after = train(makeCourt({ characters: [lan] }), { type: 'train', actorId: 'lan', spot: 'sewing_room' }).state
        .characters['lan'];
      expect(after?.path === 'lady' && after.talents.sewing).toBe(expected);
    }
  });

  it('caps the gain at the top when a larger gain would overshoot', () => {
    expect(trainingGain(SLOW_FROM - 1)).toBeGreaterThan(1);
    const lan = makeLady({ id: 'lan', talents: { ...makeLady({ id: 'x' }).talents, dancing: SLOW_FROM - 1 } });
    const result = train(makeCourt({ characters: [lan] }), { type: 'train', actorId: 'lan', spot: 'dance_terrace' });
    const after = result.state.characters['lan'];
    expect(after?.path === 'lady' && after.talents.dancing).toBe(SLOW_FROM - 1 + trainingGain(SLOW_FROM - 1));
  });

  it('works with exactly enough energy and is refused with one point too few', () => {
    const enough = makeCourt({ characters: [makeLady({ id: 'lan', energy: ENERGY.training })] });
    const worked = train(enough, { type: 'train', actorId: 'lan', spot: 'kitchen' });
    expect(worked.state.characters['lan']?.energy).toBe(0);

    const short = makeCourt({ characters: [makeLady({ id: 'lan', energy: ENERGY.training - 1 })] });
    const refused = train(short, { type: 'train', actorId: 'lan', spot: 'kitchen' });
    expect(rejectionReasons(refused.events)).toEqual(['not_enough_energy']);
    expect(refused.state).toBe(short);
  });

  it('allows exactly as many training actions as the daily energy pays for', () => {
    let state = makeCourt({ characters: [makeLady({ id: 'lan', energy: ENERGY.perDay })] });
    let done = 0;
    for (let attempt = 0; attempt < ENERGY.perDay; attempt++) {
      const result = train(state, { type: 'train', actorId: 'lan', spot: 'kitchen' });
      if (eventsOfType(result.events, 'trained').length > 0) done += 1;
      state = result.state;
    }
    expect(done).toBe(Math.floor(ENERGY.perDay / ENERGY.training));
  });

  it('is only possible in the Day phase', () => {
    const wrongPhases: Phase[] = ['morning', 'evening', 'night'];
    for (const phase of wrongPhases) {
      const court = makeCourt({ phase, characters: [makeLady({ id: 'lan' })] });
      expect(rejectionReasons(train(court, { type: 'train', actorId: 'lan', spot: 'kitchen' }).events)).toEqual(['wrong_phase']);
    }
  });

  it('cannot be done by a lady in the Cold Palace, and can again the day after she leaves', () => {
    const lan = makeLady({ id: 'lan', exiledThroughDay: 6 });
    const inside = makeCourt({ day: 6, characters: [lan] });
    expect(rejectionReasons(train(inside, { type: 'train', actorId: 'lan', spot: 'kitchen' }).events)).toEqual(['in_cold_palace']);
    const released = makeCourt({ day: 7, characters: [lan] });
    expect(rejectionReasons(train(released, { type: 'train', actorId: 'lan', spot: 'kitchen' }).events)).toEqual([]);
  });

  it('is refused for someone who is not in the court, and for a guard', () => {
    const court = makeCourt({ characters: [makeGuard({ id: 'bo' })] });
    expect(rejectionReasons(train(court, { type: 'train', actorId: 'nobody', spot: 'kitchen' }).events)).toEqual(['unknown_character']);
    expect(rejectionReasons(train(court, { type: 'train', actorId: 'bo', spot: 'kitchen' }).events)).toEqual(['not_a_lady']);
  });

  it('never raises Childbearing, whichever spot she uses', () => {
    for (const spot of ACTIVITY_SPOTS) {
      const lan = makeLady({ id: 'lan', childbearing: 60 });
      const after = train(makeCourt({ characters: [lan] }), { type: 'train', actorId: 'lan', spot, talent: firstTalentOf(spot) })
        .state.characters['lan'];
      expect(after?.path === 'lady' && after.childbearing).toBe(60);
    }
    expect(CHILDBEARING.start).toBe(STAT.max);
  });

  it('never changes the state it was given', () => {
    const court = deepFreeze(makeCourt({ characters: [makeLady({ id: 'lan' })] }));
    for (const spot of ACTIVITY_SPOTS) {
      expect(() => train(court, { type: 'train', actorId: 'lan', spot, talent: firstTalentOf(spot) })).not.toThrow();
    }
    expect(court.characters['lan']?.energy).toBe(10);
  });
});

describe('the attribute a spot also raises', () => {
  it('uses the normal number for normal rows and the small number for rows marked small', () => {
    const numbers = { spotAttributeGain: 4, spotAttributeGainSmall: 1 };
    expect(spotAttributeGain('normal', numbers)).toBe(4);
    expect(spotAttributeGain('small', numbers)).toBe(1);
  });

  it('is switched off while the doc gives no number for it', () => {
    expect(spotAttributeGain('normal', { spotAttributeGain: null, spotAttributeGainSmall: null })).toBe(0);
    expect(spotAttributeGain('small', { spotAttributeGain: null, spotAttributeGainSmall: null })).toBe(0);
  });

  it('is added to the right attribute at every spot, and to no other', () => {
    for (const spot of ACTIVITY_SPOTS) {
      const rule = ACTIVITY_SPOT_RULES[spot];
      const lan = makeLady({ id: 'lan', beauty: 30, intelligence: 30, obedience: 30 });
      const after = train(makeCourt({ characters: [lan] }), { type: 'train', actorId: 'lan', spot, talent: firstTalentOf(spot) })
        .state.characters['lan'];
      if (after?.path !== 'lady') throw new Error('expected a lady');
      const gain = spotAttributeGain(rule.attributeGain);
      expect(after.beauty).toBe(30 + (rule.alsoRaises === 'beauty' ? gain : 0));
      expect(after.intelligence).toBe(30 + (rule.alsoRaises === 'intelligence' ? gain : 0));
      expect(after.obedience).toBe(30 + (rule.alsoRaises === 'obedience' ? gain : 0));
    }
  });

  it('never takes an attribute above the top of the scale', () => {
    const lan = makeLady({ id: 'lan', beauty: STAT.max });
    const after = train(makeCourt({ characters: [lan] }), { type: 'train', actorId: 'lan', spot: 'dressing_room' }).state
      .characters['lan'];
    expect(after?.beauty).toBe(STAT.max);
  });

  it('is still waiting for its numbers from the doc', () => {
    expect(NOT_IN_THE_DOC.spotAttributeGain).toBeNull();
    expect(NOT_IN_THE_DOC.spotAttributeGainSmall).toBeNull();
  });
});

describe('dolling up', () => {
  const withMakeup = (makeup: number, extra: Partial<Parameters<typeof makeLady>[0]> = {}) =>
    makeLady({ id: 'lan', talents: { ...makeLady({ id: 'x' }).talents, makeup }, ...extra });

  it('gives a Beauty bonus of a quarter of her Makeup, rounded down', () => {
    expect(dollUpBonusFor(0)).toBe(0);
    expect(dollUpBonusFor(40)).toBe(40 * DOLL_UP.makeupShare);
    expect(dollUpBonusFor(STAT.max)).toBe(STAT.max * DOLL_UP.makeupShare);
    expect(dollUpBonusFor(43)).toBe(Math.floor(43 * DOLL_UP.makeupShare));
  });

  it('with the starting values: Makeup 3 gives 0, Makeup 4 gives 1, Makeup 100 gives 25', () => {
    expect([3, 4, 100].map(dollUpBonusFor)).toEqual([0, 1, 25]);
  });

  it('costs its energy and lasts for the game day', () => {
    const court = makeCourt({ characters: [withMakeup(40, { beauty: 30 })] });
    const result = dollUp(court, { type: 'doll_up', actorId: 'lan', inOwnRoom: true });
    const after = result.state.characters['lan'];
    if (after?.path !== 'lady') throw new Error('expected a lady');
    expect(after.energy).toBe(10 - DOLL_UP.energyCost);
    expect(after.beauty).toBe(30);
    expect(dollUpBonusToday(after)).toBe(dollUpBonusFor(40));
    expect(effectiveBeauty(after)).toBe(30 + dollUpBonusFor(40));
    expect(result.events).toEqual([{ type: 'dolled_up', characterId: 'lan', beautyBonus: dollUpBonusFor(40) }]);
  });

  it('does not stack when she dolls up twice in one day', () => {
    const court = makeCourt({ characters: [withMakeup(40)] });
    const once = dollUp(court, { type: 'doll_up', actorId: 'lan', inOwnRoom: true }).state;
    const twice = dollUp(once, { type: 'doll_up', actorId: 'lan', inOwnRoom: true }).state;
    const after = twice.characters['lan'];
    expect(after?.path === 'lady' && dollUpBonusToday(after)).toBe(dollUpBonusFor(40));
  });

  it('is doubled by premium cosmetics', () => {
    const lan = withMakeup(40, { today: { ...makeLady({ id: 'x' }).today, premiumCosmetics: true } });
    const after = dollUp(makeCourt({ characters: [lan] }), { type: 'doll_up', actorId: 'lan', inOwnRoom: true }).state
      .characters['lan'];
    expect(after?.path === 'lady' && dollUpBonusToday(after)).toBe(dollUpBonusFor(40) * DOLL_UP.premiumCosmeticsMultiplier);
  });

  it('never shows a Beauty above the top of the scale', () => {
    const lan = withMakeup(STAT.max, { beauty: STAT.max - 1 });
    const after = dollUp(makeCourt({ characters: [lan] }), { type: 'doll_up', actorId: 'lan', inOwnRoom: true }).state
      .characters['lan'];
    expect(after && effectiveBeauty(after)).toBe(STAT.max);
  });

  it('gives no bonus to a lady who has not dolled up', () => {
    expect(effectiveBeauty(withMakeup(80, { beauty: 30 }))).toBe(30);
  });

  it('can only be done in her own room', () => {
    const court = makeCourt({ characters: [withMakeup(40)] });
    const result = dollUp(court, { type: 'doll_up', actorId: 'lan', inOwnRoom: false });
    expect(rejectionReasons(result.events)).toEqual(['not_in_own_room']);
    expect(result.state).toBe(court);
  });

  it('is refused without energy, outside the Day phase, in the Cold Palace, and for a guard', () => {
    const intent = { type: 'doll_up', actorId: 'lan', inOwnRoom: true } as const;
    expect(rejectionReasons(dollUp(makeCourt({ characters: [withMakeup(40, { energy: 0 })] }), intent).events)).toEqual([
      'not_enough_energy',
    ]);
    expect(rejectionReasons(dollUp(makeCourt({ phase: 'evening', characters: [withMakeup(40)] }), intent).events)).toEqual([
      'wrong_phase',
    ]);
    expect(
      rejectionReasons(dollUp(makeCourt({ day: 2, characters: [withMakeup(40, { exiledThroughDay: 3 })] }), intent).events),
    ).toEqual(['in_cold_palace']);
    expect(
      rejectionReasons(dollUp(makeCourt({ characters: [makeGuard({ id: 'bo' })] }), { ...intent, actorId: 'bo' }).events),
    ).toEqual(['not_a_lady']);
  });

  it('never changes the state it was given', () => {
    const court = deepFreeze(makeCourt({ characters: [withMakeup(40)] }));
    expect(() => dollUp(court, { type: 'doll_up', actorId: 'lan', inOwnRoom: true })).not.toThrow();
  });
});
