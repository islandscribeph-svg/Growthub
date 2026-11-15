import { describe, expect, it } from 'vitest';
import { CLOCK, ENERGY, HOURS_PER_REAL_DAY, MS_PER_HOUR, RELATIONSHIP, RELATIONSHIP_CHANGE, SKIPPED_RESPECTS } from '../balance';
import { deepFreeze, eventsOfType, makeCourt, makeGuard, makeLady, makeMaid } from '../testing/fixtures';
import { PHASES } from '../types';
import { advancePhase, clockAt, gameDayMs, gameDaysPerRealDay, morningEnergy, nextPhase, phaseMs } from './clock';
import { payRespects, relationshipBetween } from './relationships';

describe('the game day', () => {
  it('has four phases in the order Morning, Day, Evening, Night', () => {
    expect(PHASES).toEqual(['morning', 'day', 'evening', 'night']);
    expect(nextPhase('morning')).toBe('day');
    expect(nextPhase('day')).toBe('evening');
    expect(nextPhase('evening')).toBe('night');
    expect(nextPhase('night')).toBe('morning');
  });

  it('lasts as many real hours as the doc says, split equally between the phases', () => {
    expect(gameDayMs()).toBe(CLOCK.gameDayRealHours * MS_PER_HOUR);
    expect(phaseMs() * PHASES.length).toBe(gameDayMs());
  });

  it('fits a whole number of game days into a real day', () => {
    expect(gameDaysPerRealDay()).toBe(HOURS_PER_REAL_DAY / CLOCK.gameDayRealHours);
    expect(gameDaysPerRealDay() * gameDayMs()).toBe(HOURS_PER_REAL_DAY * MS_PER_HOUR);
  });

  it('matches the worked example in section 1: 2 real hours a day, twelve game days per real day', () => {
    expect(gameDayMs()).toBe(2 * 60 * 60 * 1000);
    expect(gameDaysPerRealDay()).toBe(12);
  });
});

describe('reading the clock from real time', () => {
  it('starts on day 1 in the Morning', () => {
    expect(clockAt(0)).toEqual({ day: 1, phase: 'morning', msUntilNextPhase: phaseMs() });
  });

  it('changes phase exactly on each phase boundary', () => {
    expect(clockAt(phaseMs() - 1).phase).toBe('morning');
    expect(clockAt(phaseMs()).phase).toBe('day');
    expect(clockAt(2 * phaseMs()).phase).toBe('evening');
    expect(clockAt(3 * phaseMs()).phase).toBe('night');
    expect(clockAt(gameDayMs() - 1)).toEqual({ day: 1, phase: 'night', msUntilNextPhase: 1 });
  });

  it('starts the next game day exactly when the day length has passed', () => {
    expect(clockAt(gameDayMs())).toEqual({ day: 2, phase: 'morning', msUntilNextPhase: phaseMs() });
    expect(clockAt(gameDaysPerRealDay() * gameDayMs()).day).toBe(gameDaysPerRealDay() + 1);
  });

  it('treats a time before the start as the start', () => {
    expect(clockAt(-500)).toEqual(clockAt(0));
  });
});

describe('advancing the phase', () => {
  it('walks through the four phases and then starts the next day', () => {
    let state = makeCourt({ day: 1, phase: 'morning' });
    const seen: string[] = [];
    for (let step = 0; step < 5; step++) {
      state = advancePhase(state).state;
      seen.push(`${state.day}:${state.phase}`);
    }
    expect(seen).toEqual(['1:day', '1:evening', '1:night', '2:morning', '2:day']);
  });

  it('reports the phase change, and the new day when there is one', () => {
    const toDay = advancePhase(makeCourt({ day: 3, phase: 'morning' }));
    expect(toDay.events).toEqual([{ type: 'phase_changed', day: 3, phase: 'day' }]);

    const toMorning = advancePhase(makeCourt({ day: 3, phase: 'night' }));
    expect(toMorning.events.slice(0, 2)).toEqual([
      { type: 'phase_changed', day: 4, phase: 'morning' },
      { type: 'day_started', day: 4 },
    ]);
  });

  it('never changes the state it was given', () => {
    const state = deepFreeze(
      makeCourt({ phase: 'night', characters: [makeLady({ id: 'lan', energy: 4 })], servants: [makeMaid({ id: 'maid', servesId: 'lan' })] }),
    );
    for (const phase of PHASES) {
      expect(() => advancePhase({ ...state, phase })).not.toThrow();
    }
    expect(state.characters['lan']?.energy).toBe(4);
  });
});

describe('energy', () => {
  it('is restored to the daily amount for every lady and guard when a new day starts', () => {
    const state = makeCourt({
      phase: 'night',
      characters: [
        makeLady({ id: 'lan', energy: 0 }),
        makeLady({ id: 'mei', energy: 3 }),
        makeGuard({ id: 'bo', energy: 0 }),
      ],
    });
    const result = advancePhase(state);
    expect(result.state.characters['lan']?.energy).toBe(ENERGY.perDay);
    expect(result.state.characters['mei']?.energy).toBe(ENERGY.perDay);
    expect(result.state.characters['bo']?.energy).toBe(ENERGY.perDay);
    expect(eventsOfType(result.events, 'energy_restored')).toHaveLength(3);
  });

  it('is not carried over: unspent energy is lost when Night falls', () => {
    const state = makeCourt({
      phase: 'evening',
      characters: [makeLady({ id: 'lan', energy: 7 }), makeLady({ id: 'mei', energy: 0 })],
    });
    const result = advancePhase(state);
    expect(result.state.phase).toBe('night');
    expect(result.state.characters['lan']?.energy).toBe(0);
    expect(result.state.characters['mei']?.energy).toBe(0);
    expect(eventsOfType(result.events, 'energy_lost')).toEqual([{ type: 'energy_lost', characterId: 'lan', amount: 7 }]);
  });

  it('does not change in the middle of the day', () => {
    const state = makeCourt({ phase: 'morning', characters: [makeLady({ id: 'lan', energy: 6 })] });
    const afterDay = advancePhase(state).state;
    const afterEvening = advancePhase(afterDay).state;
    expect(afterDay.characters['lan']?.energy).toBe(6);
    expect(afterEvening.characters['lan']?.energy).toBe(6);
  });

  it('stays at 0 for a lady who is ill, and comes back the day after her illness ends', () => {
    const lan = makeLady({ id: 'lan', illThroughDay: 5 });
    expect(morningEnergy(lan, 4)).toBe(0);
    expect(morningEnergy(lan, 5)).toBe(0);
    expect(morningEnergy(lan, 6)).toBe(ENERGY.perDay);

    const illDay = advancePhase(makeCourt({ day: 4, phase: 'night', characters: [lan] }));
    expect(illDay.state.day).toBe(5);
    expect(illDay.state.characters['lan']?.energy).toBe(0);
    const wellDay = advancePhase(makeCourt({ day: 5, phase: 'night', characters: [lan] }));
    expect(wellDay.state.characters['lan']?.energy).toBe(ENERGY.perDay);
  });
});

describe('the daily records', () => {
  it('are wiped when a new day starts', () => {
    const lan = makeLady({
      id: 'lan',
      today: {
        paidRespects: true,
        dollUpBonus: 12,
        premiumCosmetics: true,
        giftedTo: ['mei'],
        greeted: ['mei'],
        workSold: 1,
        silverSentToPlayers: 20,
        silverReceivedFromPlayers: 30,
        walkedInOn: ['mei'],
      },
    });
    const maid = makeMaid({ id: 'maid', servesId: 'lan', loyaltyFromTipsToday: 6 });
    const result = advancePhase(makeCourt({ phase: 'night', characters: [lan], servants: [maid] }));
    expect(result.state.characters['lan']?.today).toEqual({
      paidRespects: false,
      dollUpBonus: 0,
      premiumCosmetics: false,
      giftedTo: [],
      greeted: [],
      workSold: 0,
      silverSentToPlayers: 0,
      silverReceivedFromPlayers: 0,
      walkedInOn: [],
    });
    expect(result.state.servants['maid']?.loyaltyFromTipsToday).toBe(0);
  });

  it('are kept through the rest of the day', () => {
    const lan = makeLady({ id: 'lan', today: { ...makeLady({ id: 'x' }).today, paidRespects: true, dollUpBonus: 9 } });
    let state = makeCourt({ phase: 'morning', characters: [lan] });
    for (let step = 0; step < 3; step++) state = advancePhase(state).state;
    expect(state.phase).toBe('night');
    expect(state.characters['lan']?.today.paidRespects).toBe(true);
    expect(state.characters['lan']?.today.dollUpBonus).toBe(9);
  });
});

describe('the end of the Morning', () => {
  const household = () =>
    makeCourt({
      phase: 'morning',
      characters: [makeLady({ id: 'lan' }), makeLady({ id: 'mistress', rank: 'consort' })],
    });

  it('costs a lady who skipped her respects a little Obedience and a little standing with her mistress', () => {
    const before = household();
    const result = advancePhase(before);
    expect(result.state.phase).toBe('day');
    expect(result.state.characters['lan']).toMatchObject({ obedience: makeLady({ id: 'x' }).obedience - SKIPPED_RESPECTS.obedienceLoss });
    expect(relationshipBetween(result.state, 'lan', 'mistress')).toBe(RELATIONSHIP.strangers - SKIPPED_RESPECTS.relationshipLoss);
  });

  it('costs nothing to a lady who paid them', () => {
    const paid = payRespects(household(), { type: 'pay_respects', actorId: 'lan' });
    const result = advancePhase(paid.state);
    expect(result.state.characters['lan']).toMatchObject({ obedience: makeLady({ id: 'x' }).obedience });
    expect(relationshipBetween(result.state, 'lan', 'mistress')).toBe(
      RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.respectsOrGreeting,
    );
  });

  it('is the only phase change that checks respects', () => {
    let state = advancePhase(household()).state;
    const afterMorning = relationshipBetween(state, 'lan', 'mistress');
    for (let step = 0; step < PHASES.length - 1; step++) state = advancePhase(state).state;
    expect(state.phase).toBe('morning');
    expect(relationshipBetween(state, 'lan', 'mistress')).toBe(afterMorning);
  });
});
