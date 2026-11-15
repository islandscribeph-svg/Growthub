import { describe, expect, it } from 'vitest';
import {
  BRIBE,
  CHILDBEARING_RESTORATION,
  DOLL_UP,
  ENERGY,
  GIFT_QUALITY,
  GUARD_STIPEND,
  HATED,
  RELATIONSHIP,
  SELLING,
  SELLING_WORK,
  SERVANT,
  SHOP_PRICE,
  STAT,
  STIPEND,
  TIP,
  TRANSFER,
} from '../balance';
import {
  deepFreeze,
  eventsOfType,
  makeCourt,
  makeGuard,
  makeLady,
  makeMaid,
  makePlayerLady,
  rejectionReasons,
  rollOf,
  scriptedRng,
  HIGHEST_ROLL,
  LOWEST_ROLL,
} from '../testing/fixtures';
import { createRng } from '../rng';
import { GUARD_RANKS, LADY_RANKS, type CourtState, type Lady, type Phase, type ShopItem } from '../types';
import { advancePhase } from './clock';
import {
  bribeCost,
  bribeCostFor,
  buy,
  giveSilver,
  payStipends,
  saleValue,
  sellWork,
  servantRefusesBribe,
  silencedBribeCost,
  spendSilver,
  stipendFor,
  tipServant,
} from './money';
import { dollUp, dollUpBonusFor, dollUpBonusToday } from './training';

const CAP = TRANSFER.playerToPlayerCapPerDay;
const SHOP_ITEMS = Object.keys(SHOP_PRICE) as ShopItem[];

function silverOf(state: CourtState, id: string): number | undefined {
  return state.characters[id]?.silver;
}

describe('stipends', () => {
  it('pay each rank the amount in the stipend table', () => {
    const ladies = LADY_RANKS.map((rank) => makeLady({ id: rank, rank, silver: 1 }));
    const result = payStipends(makeCourt({ phase: 'morning', characters: ladies }));
    for (const rank of LADY_RANKS) {
      expect(silverOf(result.state, rank)).toBe(1 + STIPEND[rank]);
    }
    expect(eventsOfType(result.events, 'stipend_paid')).toHaveLength(LADY_RANKS.length);
  });

  it('with the starting values: 5, 8, 12, 20, 30, 45, 60 and 100 taels from the lowest rank to the Empress', () => {
    expect(LADY_RANKS.map((rank) => STIPEND[rank])).toEqual([5, 8, 12, 20, 30, 45, 60, 100]);
  });

  it('grow with rank', () => {
    for (let index = 1; index < LADY_RANKS.length; index++) {
      const lower = LADY_RANKS[index - 1];
      const higher = LADY_RANKS[index];
      if (lower && higher) expect(STIPEND[higher]).toBeGreaterThan(STIPEND[lower]);
    }
  });

  it('arrive when the Morning begins, and at no other phase change', () => {
    let state = makeCourt({ day: 1, phase: 'morning', characters: [makeLady({ id: 'lan', rank: 'noble_lady' })] });
    const silverAfterEachPhase: number[] = [];
    for (let step = 0; step < 8; step++) {
      state = advancePhase(state).state;
      silverAfterEachPhase.push(silverOf(state, 'lan') ?? -1);
    }
    const stipend = STIPEND.noble_lady;
    expect(silverAfterEachPhase).toEqual([0, 0, 0, stipend, stipend, stipend, stipend, 2 * stipend]);
  });

  it('are not paid to a lady in the Cold Palace, and resume the Morning after she leaves', () => {
    const lan = makeLady({ id: 'lan', rank: 'consort', exiledThroughDay: 6 });
    expect(stipendFor(lan, 6)).toBe(0);
    expect(stipendFor(lan, 7)).toBe(STIPEND.consort);
    const lastDayInside = advancePhase(makeCourt({ day: 5, phase: 'night', characters: [lan] }));
    expect(silverOf(lastDayInside.state, 'lan')).toBe(0);
    const firstDayOut = advancePhase(makeCourt({ day: 6, phase: 'night', characters: [lan] }));
    expect(silverOf(firstDayOut.state, 'lan')).toBe(STIPEND.consort);
  });

  it('are written in the ledger', () => {
    const result = payStipends(makeCourt({ day: 4, phase: 'morning', characters: [makeLady({ id: 'lan' })] }));
    expect(result.state.ledger).toEqual([
      {
        day: 4,
        phase: 'morning',
        characterId: 'lan',
        direction: 'in',
        amount: STIPEND.second_class_attendant,
        reason: 'stipend',
        item: null,
        otherId: null,
        leavesTrail: false,
      },
    ]);
  });

  it('pay a guard the amount for his rank', () => {
    for (const rank of GUARD_RANKS) {
      expect(stipendFor(makeGuard({ id: 'bo', rank }), 1)).toBe(GUARD_STIPEND[rank]);
    }
    const result = payStipends(makeCourt({ characters: [makeGuard({ id: 'bo' })] }));
    expect(silverOf(result.state, 'bo')).toBe(GUARD_STIPEND.blue_feather_guard);
  });

  it('pay a guard the same as a lady of the same rank number', () => {
    GUARD_RANKS.forEach((rank, index) => {
      const ladyRank = LADY_RANKS[index];
      if (!ladyRank) throw new Error('more guard ranks than lady ranks');
      expect(GUARD_STIPEND[rank]).toBe(STIPEND[ladyRank]);
    });
  });

  it('are not paid to a guard posted to the frontier', () => {
    const bo = makeGuard({ id: 'bo', exiledThroughDay: 6 });
    expect(stipendFor(bo, 6)).toBe(0);
    expect(stipendFor(bo, 7)).toBe(GUARD_STIPEND.blue_feather_guard);
  });
});

describe('silver never goes below zero', () => {
  it('refuses to spend more than she has, and allows spending exactly what she has', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan', silver: 25 })] });
    const details = { reason: 'purchase', item: null, otherId: null, leavesTrail: false } as const;
    expect(spendSilver(court, 'lan', 26, details)).toBeNull();
    expect(silverOf(spendSilver(court, 'lan', 25, details) ?? court, 'lan')).toBe(0);
    expect(spendSilver(court, 'lan', -5, details)).toBeNull();
    expect(spendSilver(court, 'nobody', 1, details)).toBeNull();
  });

  it('holds for every shop item when she is one tael short', () => {
    for (const item of SHOP_ITEMS) {
      const lan = makeLady({ id: 'lan', silver: SHOP_PRICE[item] - 1, illThroughDay: 9, childbearing: 50 });
      const court = makeCourt({ characters: [lan] });
      const result = buy(court, { type: 'buy', actorId: 'lan', item });
      expect(rejectionReasons(result.events)).toEqual(['not_enough_silver']);
      expect(result.state).toBe(court);
    }
  });

  it('holds with no silver at all', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan', silver: 0 }), makeLady({ id: 'mei' })], servants: [makeMaid({ id: 'maid', servesId: 'lan' })] });
    expect(rejectionReasons(buy(court, { type: 'buy', actorId: 'lan', item: 'poison_ingredients' }).events)).toEqual([
      'not_enough_silver',
    ]);
    expect(rejectionReasons(tipServant(court, { type: 'tip_servant', actorId: 'lan', servantId: 'maid' }).events)).toEqual([
      'not_enough_silver',
    ]);
    expect(rejectionReasons(giveSilver(court, { type: 'give_silver', actorId: 'lan', recipientId: 'mei', amount: 1 }).events)).toEqual([
      'not_enough_silver',
    ]);
  });
});

describe('the shop', () => {
  it('charges the listed price for every item and leaves her with 0 when she had exactly enough', () => {
    for (const item of SHOP_ITEMS) {
      const lan = makeLady({ id: 'lan', silver: SHOP_PRICE[item], illThroughDay: 9, childbearing: 50 });
      const result = buy(makeCourt({ characters: [lan] }), { type: 'buy', actorId: 'lan', item });
      expect(rejectionReasons(result.events)).toEqual([]);
      expect(silverOf(result.state, 'lan')).toBe(0);
      expect(eventsOfType(result.events, 'purchased')).toEqual([{ type: 'purchased', characterId: 'lan', item, cost: SHOP_PRICE[item] }]);
    }
  });

  it('with the starting values: poison 25, fertility poison 40, a cure 15, Childbearing 30, cosmetics 5', () => {
    expect(SHOP_PRICE).toEqual({
      poison_ingredients: 25,
      fertility_poison_ingredients: 40,
      physician_cure: 15,
      childbearing_restoration: 30,
      premium_cosmetics: 5,
    });
  });

  it('logs every purchase', () => {
    let state = makeCourt({ day: 2, characters: [makeLady({ id: 'lan', silver: 500, illThroughDay: 9, childbearing: 50 })] });
    for (const item of SHOP_ITEMS) state = buy(state, { type: 'buy', actorId: 'lan', item }).state;
    expect(state.ledger.map((entry) => entry.item)).toEqual(SHOP_ITEMS);
    expect(state.ledger.every((entry) => entry.reason === 'purchase' && entry.direction === 'out' && entry.day === 2)).toBe(true);
    expect(state.ledger.map((entry) => entry.amount)).toEqual(SHOP_ITEMS.map((item) => SHOP_PRICE[item]));
  });

  it('leaves a trail for poison ingredients, and for nothing else', () => {
    let state = makeCourt({ characters: [makeLady({ id: 'lan', silver: 500, illThroughDay: 9, childbearing: 50 })] });
    for (const item of SHOP_ITEMS) state = buy(state, { type: 'buy', actorId: 'lan', item }).state;
    const withTrail = state.ledger.filter((entry) => entry.leavesTrail).map((entry) => entry.item);
    expect(withTrail).toEqual(['poison_ingredients', 'fertility_poison_ingredients']);
  });

  it('puts poison ingredients in her keeping', () => {
    let state = makeCourt({ characters: [makeLady({ id: 'lan', silver: 500 })] });
    state = buy(state, { type: 'buy', actorId: 'lan', item: 'poison_ingredients' }).state;
    state = buy(state, { type: 'buy', actorId: 'lan', item: 'poison_ingredients' }).state;
    state = buy(state, { type: 'buy', actorId: 'lan', item: 'fertility_poison_ingredients' }).state;
    expect(state.characters['lan']?.inventory).toEqual({ poisonIngredients: 2, fertilityPoisonIngredients: 1 });
  });

  it('cures an illness, and refuses a cure for someone who is not ill', () => {
    const ill = makeCourt({ day: 3, characters: [makeLady({ id: 'lan', silver: 100, illThroughDay: 5 })] });
    const cured = buy(ill, { type: 'buy', actorId: 'lan', item: 'physician_cure' });
    expect(cured.state.characters['lan']?.illThroughDay).toBeNull();
    expect(eventsOfType(cured.events, 'illness_cured')).toHaveLength(1);

    const well = makeCourt({ day: 6, characters: [makeLady({ id: 'lan', silver: 100, illThroughDay: 5 })] });
    const refused = buy(well, { type: 'buy', actorId: 'lan', item: 'physician_cure' });
    expect(rejectionReasons(refused.events)).toEqual(['not_ill']);
    expect(silverOf(refused.state, 'lan')).toBe(100);
  });

  it('restores Childbearing by the listed points, never above the top, and refuses when it is already full', () => {
    const points = CHILDBEARING_RESTORATION.points;
    const cases: [number, number][] = [
      [40, 40 + points],
      [STAT.max - points, STAT.max],
      [STAT.max - 1, STAT.max],
    ];
    for (const [before, expected] of cases) {
      const court = makeCourt({ characters: [makeLady({ id: 'lan', silver: 100, childbearing: before })] });
      const after = buy(court, { type: 'buy', actorId: 'lan', item: 'childbearing_restoration' }).state.characters['lan'];
      expect(after?.path === 'lady' && after.childbearing).toBe(expected);
    }
    const full = makeCourt({ characters: [makeLady({ id: 'lan', silver: 100, childbearing: STAT.max })] });
    const refused = buy(full, { type: 'buy', actorId: 'lan', item: 'childbearing_restoration' });
    expect(rejectionReasons(refused.events)).toEqual(['childbearing_already_full']);
    expect(silverOf(refused.state, 'lan')).toBe(100);
  });

  it('doubles that day’s doll-up bonus with premium cosmetics, whether bought before or after dolling up', () => {
    const lan = makeLady({ id: 'lan', silver: 100, talents: { ...makeLady({ id: 'x' }).talents, makeup: 40 } });
    const court = makeCourt({ characters: [lan] });
    const doll = { type: 'doll_up', actorId: 'lan', inOwnRoom: true } as const;
    const cosmetics = { type: 'buy', actorId: 'lan', item: 'premium_cosmetics' } as const;
    const expected = dollUpBonusFor(40) * DOLL_UP.premiumCosmeticsMultiplier;

    const boughtFirst = dollUp(buy(court, cosmetics).state, doll).state.characters['lan'];
    expect(boughtFirst?.path === 'lady' && dollUpBonusToday(boughtFirst)).toBe(expected);
    const boughtAfter = buy(dollUp(court, doll).state, cosmetics).state.characters['lan'];
    expect(boughtAfter?.path === 'lady' && dollUpBonusToday(boughtAfter)).toBe(expected);
  });

  it('sells premium cosmetics once a day, and they wear off the next day', () => {
    const court = makeCourt({ phase: 'day', characters: [makeLady({ id: 'lan', silver: 100 })] });
    const once = buy(court, { type: 'buy', actorId: 'lan', item: 'premium_cosmetics' });
    const twice = buy(once.state, { type: 'buy', actorId: 'lan', item: 'premium_cosmetics' });
    expect(rejectionReasons(twice.events)).toEqual(['already_bought_today']);
    expect(silverOf(twice.state, 'lan')).toBe(100 - SHOP_PRICE.premium_cosmetics);

    let state = once.state;
    for (let step = 0; step < 3; step++) state = advancePhase(state).state;
    expect(state.phase).toBe('morning');
    expect(state.characters['lan']?.today.premiumCosmetics).toBe(false);
  });

  it('refuses Childbearing restoration and cosmetics to a guard, and anything to someone not in the court', () => {
    const court = makeCourt({ characters: [makeGuard({ id: 'bo', silver: 500 })] });
    expect(rejectionReasons(buy(court, { type: 'buy', actorId: 'bo', item: 'childbearing_restoration' }).events)).toEqual(['not_a_lady']);
    expect(rejectionReasons(buy(court, { type: 'buy', actorId: 'bo', item: 'premium_cosmetics' }).events)).toEqual(['not_a_lady']);
    expect(rejectionReasons(buy(court, { type: 'buy', actorId: 'nobody', item: 'poison_ingredients' }).events)).toEqual([
      'unknown_character',
    ]);
  });

  it('never changes the state it was given', () => {
    const court = deepFreeze(makeCourt({ characters: [makeLady({ id: 'lan', silver: 500, illThroughDay: 9, childbearing: 50 })] }));
    for (const item of SHOP_ITEMS) expect(() => buy(court, { type: 'buy', actorId: 'lan', item })).not.toThrow();
    expect(court.ledger).toEqual([]);
  });
});

describe('the bribe formula', () => {
  it('is Loyalty times the rank number, divided as the doc says', () => {
    expect(bribeCost({ servantLoyalty: 60, targetRankNumber: 5, targetHated: false })).toBe((60 * 5) / BRIBE.rankDivisor);
    expect(bribeCost({ servantLoyalty: 80, targetRankNumber: 8, targetHated: false })).toBe((80 * 8) / BRIBE.rankDivisor);
  });

  it('matches the worked examples in section 9: 150 taels for a Consort’s maid, 30 for a Second Class Attendant’s', () => {
    expect(bribeCost({ servantLoyalty: 60, targetRankNumber: 5, targetHated: false })).toBe(150);
    expect(bribeCost({ servantLoyalty: 60, targetRankNumber: 1, targetHated: false })).toBe(30);
  });

  it('never falls below the minimum, even for a servant with no loyalty', () => {
    expect(bribeCost({ servantLoyalty: 0, targetRankNumber: 1, targetHated: false })).toBe(BRIBE.minimum);
    expect(bribeCost({ servantLoyalty: BRIBE.minimum * BRIBE.rankDivisor, targetRankNumber: 1, targetHated: false })).toBe(
      BRIBE.minimum,
    );
    expect(bribeCost({ servantLoyalty: BRIBE.minimum * BRIBE.rankDivisor + BRIBE.rankDivisor, targetRankNumber: 1, targetHated: false })).toBe(
      BRIBE.minimum + 1,
    );
  });

  it('is halved when the target is hated, but still not below the minimum', () => {
    const full = bribeCost({ servantLoyalty: 60, targetRankNumber: 5, targetHated: false });
    expect(bribeCost({ servantLoyalty: 60, targetRankNumber: 5, targetHated: true })).toBe(full * HATED.bribeCostMultiplier);
    expect(bribeCost({ servantLoyalty: 30, targetRankNumber: 1, targetHated: true })).toBe(BRIBE.minimum);
  });

  it('is rounded down to whole taels', () => {
    expect(bribeCost({ servantLoyalty: 61, targetRankNumber: 1, targetHated: false })).toBe(Math.floor(61 / BRIBE.rankDivisor));
    expect(Number.isInteger(bribeCost({ servantLoyalty: 77, targetRankNumber: 3, targetHated: true }))).toBe(true);
  });

  it('uses the rank and standing of the servant’s own mistress', () => {
    const court = makeCourt({
      characters: [makeLady({ id: 'consort', rank: 'consort' }), makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      servants: [
        makeMaid({ id: 'consort_maid', servesId: 'consort', loyalty: 60 }),
        makeMaid({ id: 'lan_maid', servesId: 'lan', loyalty: 60 }),
        { ...makeMaid({ id: 'cook', servesId: 'lan' }), role: 'cook', servesId: null },
      ],
    });
    expect(bribeCostFor(court, 'consort_maid')).toBe(bribeCost({ servantLoyalty: 60, targetRankNumber: 5, targetHated: false }));
    expect(bribeCostFor(court, 'lan_maid')).toBe(bribeCost({ servantLoyalty: 60, targetRankNumber: 1, targetHated: false }));
    expect(bribeCostFor(court, 'cook')).toBeNull();
    expect(bribeCostFor(court, 'nobody')).toBeNull();
  });

  it('costs half against a hated lady in the court', () => {
    const below = RELATIONSHIP.hatedBelow - 1;
    const court = makeCourt({
      characters: [makeLady({ id: 'consort', rank: 'consort' }), makeLady({ id: 'lan' }), makeLady({ id: 'mei' })],
      servants: [makeMaid({ id: 'consort_maid', servesId: 'consort', loyalty: 60 })],
      relationships: [
        ['consort', 'lan', below],
        ['consort', 'mei', below],
      ],
    });
    expect(bribeCostFor(court, 'consort_maid')).toBe(bribeCost({ servantLoyalty: 60, targetRankNumber: 5, targetHated: true }));
  });

  it('cannot buy a servant whose Loyalty is above the refusal line, but can buy one exactly on it', () => {
    expect(servantRefusesBribe(SERVANT.refusesBribeAbove)).toBe(false);
    expect(servantRefusesBribe(SERVANT.refusesBribeAbove + 1)).toBe(true);
    expect(servantRefusesBribe(SERVANT.loyaltyMax)).toBe(true);
    expect(servantRefusesBribe(0)).toBe(false);
  });

  it('doubles to buy the servant’s silence at trial', () => {
    expect(silencedBribeCost(150)).toBe(150 * BRIBE.silenceMultiplier);
  });

  it('with the starting values: a spy costs 10, a gate guard 15, the Imperial Physician 60', () => {
    expect([BRIBE.spy, BRIBE.gateGuard, BRIBE.imperialPhysician]).toEqual([10, 15, 60]);
  });
});

describe('tipping her own servants', () => {
  const household = (silver = 100, loyalty = 50) =>
    makeCourt({
      characters: [makeLady({ id: 'lan', silver }), makeLady({ id: 'mei', silver: 100 })],
      servants: [makeMaid({ id: 'maid', servesId: 'lan', loyalty })],
    });
  const tip = { type: 'tip_servant', actorId: 'lan', servantId: 'maid' } as const;

  it('costs the tip and adds its Loyalty', () => {
    const result = tipServant(household(), tip);
    expect(silverOf(result.state, 'lan')).toBe(100 - TIP.cost);
    expect(result.state.servants['maid']?.loyalty).toBe(50 + TIP.loyaltyGain);
    expect(eventsOfType(result.events, 'servant_loyalty_changed')).toEqual([
      { type: 'servant_loyalty_changed', servantId: 'maid', from: 50, to: 50 + TIP.loyaltyGain, cause: 'tip' },
    ]);
    expect(result.state.ledger.at(-1)).toMatchObject({ reason: 'tip', amount: TIP.cost, otherId: 'maid', direction: 'out' });
  });

  it('stops adding Loyalty at the daily limit, and takes no silver for a refused tip', () => {
    let state = household();
    const tipsAllowed = TIP.maxLoyaltyPerDay / TIP.loyaltyGain;
    for (let count = 0; count < tipsAllowed; count++) state = tipServant(state, tip).state;
    expect(state.servants['maid']?.loyalty).toBe(50 + TIP.maxLoyaltyPerDay);
    const oneTooMany = tipServant(state, tip);
    expect(rejectionReasons(oneTooMany.events)).toEqual(['tip_limit_reached']);
    expect(oneTooMany.state.servants['maid']?.loyalty).toBe(50 + TIP.maxLoyaltyPerDay);
    expect(silverOf(oneTooMany.state, 'lan')).toBe(100 - tipsAllowed * TIP.cost);
  });

  it('can be done again the next game day', () => {
    let state = household();
    for (let count = 0; count < TIP.maxLoyaltyPerDay / TIP.loyaltyGain; count++) state = tipServant(state, tip).state;
    while (state.day === 1) state = advancePhase(state).state;
    const nextDay = tipServant(state, tip);
    expect(rejectionReasons(nextDay.events)).toEqual([]);
    expect(nextDay.state.servants['maid']?.loyalty).toBe(50 + TIP.maxLoyaltyPerDay + TIP.loyaltyGain);
  });

  it('never takes Loyalty above the top, and is refused when Loyalty is already full', () => {
    const nearlyFull = tipServant(household(100, SERVANT.loyaltyMax - 1), tip);
    expect(nearlyFull.state.servants['maid']?.loyalty).toBe(SERVANT.loyaltyMax);
    const full = tipServant(household(100, SERVANT.loyaltyMax), tip);
    expect(rejectionReasons(full.events)).toEqual(['loyalty_already_full']);
    expect(silverOf(full.state, 'lan')).toBe(100);
  });

  it('works with exactly the tip in her purse and is refused one tael short', () => {
    expect(silverOf(tipServant(household(TIP.cost), tip).state, 'lan')).toBe(0);
    expect(rejectionReasons(tipServant(household(TIP.cost - 1), tip).events)).toEqual(['not_enough_silver']);
  });

  it('is only for her own servants', () => {
    expect(rejectionReasons(tipServant(household(), { ...tip, actorId: 'mei' }).events)).toEqual(['not_her_servant']);
    expect(rejectionReasons(tipServant(household(), { ...tip, servantId: 'nobody' }).events)).toEqual(['unknown_servant']);
    expect(rejectionReasons(tipServant(household(), { ...tip, actorId: 'nobody' }).events)).toEqual(['unknown_character']);
  });

  it('never changes the state it was given', () => {
    const court = deepFreeze(household());
    expect(() => tipServant(court, tip)).not.toThrow();
    expect(court.servants['maid']?.loyalty).toBe(50);
  });
});

describe('giving silver', () => {
  const players = () =>
    makeCourt({
      characters: [
        makePlayerLady({ id: 'ann', silver: 500 }),
        makePlayerLady({ id: 'bea', silver: 500 }),
        makePlayerLady({ id: 'cat', silver: 0 }),
        makeLady({ id: 'npc', silver: 500 }),
      ],
    });

  it('moves the silver from one purse to the other and logs both sides', () => {
    const result = giveSilver(players(), { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: 20 });
    expect(silverOf(result.state, 'ann')).toBe(480);
    expect(silverOf(result.state, 'cat')).toBe(20);
    expect(result.events).toEqual([{ type: 'silver_given', fromId: 'ann', toId: 'cat', amount: 20 }]);
    expect(result.state.ledger).toMatchObject([
      { characterId: 'ann', direction: 'out', amount: 20, reason: 'transfer', otherId: 'cat' },
      { characterId: 'cat', direction: 'in', amount: 20, reason: 'transfer', otherId: 'ann' },
    ]);
  });

  it('lets one player send another exactly the daily cap, and not one tael more', () => {
    const atCap = giveSilver(players(), { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: CAP });
    expect(silverOf(atCap.state, 'cat')).toBe(CAP);
    const over = giveSilver(players(), { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: CAP + 1 });
    expect(rejectionReasons(over.events)).toEqual(['transfer_cap_reached']);
    expect(silverOf(over.state, 'cat')).toBe(0);
  });

  it('counts a player’s transfers through the day towards the cap', () => {
    const first = giveSilver(players(), { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: CAP - 10 });
    const second = giveSilver(first.state, { type: 'give_silver', actorId: 'ann', recipientId: 'bea', amount: 11 });
    expect(rejectionReasons(second.events)).toEqual(['transfer_cap_reached']);
    const third = giveSilver(first.state, { type: 'give_silver', actorId: 'ann', recipientId: 'bea', amount: 10 });
    expect(rejectionReasons(third.events)).toEqual([]);
  });

  it('stops several players feeding one lady past the cap', () => {
    const first = giveSilver(players(), { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: CAP });
    const second = giveSilver(first.state, { type: 'give_silver', actorId: 'bea', recipientId: 'cat', amount: 1 });
    expect(rejectionReasons(second.events)).toEqual(['transfer_cap_reached']);
    expect(silverOf(second.state, 'cat')).toBe(CAP);
  });

  it('starts counting afresh the next game day', () => {
    let state = giveSilver(players(), { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: CAP }).state;
    while (state.day === 1) state = advancePhase(state).state;
    const nextDay = giveSilver(state, { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: CAP });
    expect(rejectionReasons(nextDay.events)).toEqual([]);
  });

  it('does not cap silver that passes to or from an NPC', () => {
    const fromNpc = giveSilver(players(), { type: 'give_silver', actorId: 'npc', recipientId: 'cat', amount: CAP * 3 });
    expect(silverOf(fromNpc.state, 'cat')).toBe(CAP * 3);
    const toNpc = giveSilver(players(), { type: 'give_silver', actorId: 'ann', recipientId: 'npc', amount: CAP * 3 });
    expect(silverOf(toNpc.state, 'npc')).toBe(500 + CAP * 3);
    const stillFree = giveSilver(fromNpc.state, { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: CAP });
    expect(rejectionReasons(stillFree.events)).toEqual([]);
  });

  it('refuses more than she has, and allows giving everything she has', () => {
    const court = makeCourt({ characters: [makeLady({ id: 'lan', silver: 30 }), makeLady({ id: 'mei' })] });
    expect(rejectionReasons(giveSilver(court, { type: 'give_silver', actorId: 'lan', recipientId: 'mei', amount: 31 }).events)).toEqual([
      'not_enough_silver',
    ]);
    const all = giveSilver(court, { type: 'give_silver', actorId: 'lan', recipientId: 'mei', amount: 30 });
    expect(silverOf(all.state, 'lan')).toBe(0);
    expect(silverOf(all.state, 'mei')).toBe(30);
  });

  it('refuses nothing, negative amounts, part-taels, herself, and strangers to the court', () => {
    const give = (amount: number, recipientId = 'cat') =>
      rejectionReasons(giveSilver(players(), { type: 'give_silver', actorId: 'ann', recipientId, amount }).events);
    expect(give(0)).toEqual(['invalid_amount']);
    expect(give(-5)).toEqual(['invalid_amount']);
    expect(give(2.5)).toEqual(['invalid_amount']);
    expect(give(Number.NaN)).toEqual(['invalid_amount']);
    expect(give(5, 'ann')).toEqual(['cannot_target_self']);
    expect(give(5, 'nobody')).toEqual(['unknown_recipient']);
  });

  it('never creates or destroys silver', () => {
    const before = players();
    const after = giveSilver(before, { type: 'give_silver', actorId: 'ann', recipientId: 'bea', amount: 37 }).state;
    const total = (state: CourtState) => Object.values(state.characters).reduce((sum, character) => sum + character.silver, 0);
    expect(total(after)).toBe(total(before));
  });

  it('never changes the state it was given', () => {
    const court = deepFreeze(players());
    expect(() => giveSilver(court, { type: 'give_silver', actorId: 'ann', recipientId: 'cat', amount: 20 })).not.toThrow();
  });
});

describe('selling her own work', () => {
  it('pays the quality divided as the doc says, rounded down, and never less than nothing', () => {
    const perTael = SELLING.qualityPerTael;
    expect(saleValue(perTael * 12)).toBe(12);
    expect(saleValue(perTael * 12 + perTael - 1)).toBe(12);
    expect(saleValue(perTael - 1)).toBe(0);
    expect(saleValue(-8)).toBe(0);
  });

  it('with the starting values: a piece of quality 60 sells for 12 taels', () => {
    expect(saleValue(60)).toBe(12);
  });
});

describe('selling her own work through a eunuch', () => {
  const EVEN_ROLL = rollOf(GIFT_QUALITY.rollMin, GIFT_QUALITY.rollMax, 0);
  const maker = (talents: Partial<Lady['talents']>, overrides: Partial<Lady> = {}) =>
    makeLady({ id: 'lan', talents: { ...makeLady({ id: 'x' }).talents, ...talents }, ...overrides });
  const courtOf = (lan: Lady, phase: Phase = 'day', day = 1) => makeCourt({ phase, day, characters: [lan] });
  const sell = (work: 'sewing' | 'drawing' = 'sewing') => ({ type: 'sell_work', actorId: 'lan', work }) as const;

  it('pays the quality of the piece divided by the doc’s number, and costs the energy of a training action', () => {
    const result = sellWork(courtOf(maker({ sewing: 60 })), sell(), scriptedRng([EVEN_ROLL]));
    expect(silverOf(result.state, 'lan')).toBe(saleValue(60));
    expect(result.state.characters['lan']?.energy).toBe(ENERGY.perDay - ENERGY.training);
    expect(eventsOfType(result.events, 'work_sold')).toEqual([
      { type: 'work_sold', characterId: 'lan', work: 'sewing', quality: 60, price: saleValue(60) },
    ]);
  });

  it('rolls the quality like a homemade gift: her talent plus the roll', () => {
    const low = sellWork(courtOf(maker({ sewing: 50 })), sell(), scriptedRng([LOWEST_ROLL]));
    expect(eventsOfType(low.events, 'work_sold')[0]?.quality).toBe(50 + GIFT_QUALITY.rollMin);
    const high = sellWork(courtOf(maker({ sewing: 50 })), sell(), scriptedRng([HIGHEST_ROLL]));
    expect(eventsOfType(high.events, 'work_sold')[0]?.quality).toBe(50 + GIFT_QUALITY.rollMax);
  });

  it('sells sewing on Sewing and drawings on Drawing', () => {
    expect(SELLING_WORK.talent).toEqual({ sewing: 'sewing', drawing: 'drawing' });
    const lan = maker({ sewing: 20, drawing: 80 });
    const drawing = sellWork(courtOf(lan), sell('drawing'), scriptedRng([EVEN_ROLL]));
    expect(eventsOfType(drawing.events, 'work_sold')[0]).toMatchObject({ quality: 80, price: saleValue(80) });
    const sewing = sellWork(courtOf(lan), sell('sewing'), scriptedRng([EVEN_ROLL]));
    expect(eventsOfType(sewing.events, 'work_sold')[0]).toMatchObject({ quality: 20, price: saleValue(20) });
  });

  it('is written in the ledger as a sale', () => {
    const result = sellWork(courtOf(maker({ sewing: 60 })), sell(), scriptedRng([EVEN_ROLL]));
    expect(result.state.ledger).toMatchObject([
      { characterId: 'lan', direction: 'in', amount: saleValue(60), reason: 'sale', item: 'sewing' },
    ]);
  });

  it('earns nothing for a worthless piece, and still costs the energy', () => {
    const result = sellWork(courtOf(maker({ sewing: 0 })), sell(), scriptedRng([LOWEST_ROLL]));
    expect(silverOf(result.state, 'lan')).toBe(0);
    expect(result.state.ledger).toEqual([]);
    expect(result.state.characters['lan']?.energy).toBe(ENERGY.perDay - ENERGY.training);
  });

  it('is limited per game day, and allowed again the next day', () => {
    let state = courtOf(maker({ sewing: 60, drawing: 60 }));
    for (let sale = 0; sale < SELLING_WORK.salesPerDay; sale++) state = sellWork(state, sell(), createRng(sale)).state;
    const overLimit = sellWork(state, sell('drawing'), scriptedRng([]));
    expect(rejectionReasons(overLimit.events)).toEqual(['already_sold_today']);
    expect(overLimit.state).toBe(state);
    while (state.phase !== 'day' || state.day === 1) state = advancePhase(state).state;
    expect(rejectionReasons(sellWork(state, sell(), createRng(9)).events)).toEqual([]);
  });

  it('with the starting values: one piece a day', () => {
    expect(SELLING_WORK.salesPerDay).toBe(1);
  });

  it('is refused outside the Day phase, without the energy, from the Cold Palace, and to a guard', () => {
    const lan = maker({ sewing: 60 });
    for (const phase of ['morning', 'evening', 'night'] as const) {
      expect(rejectionReasons(sellWork(courtOf(lan, phase), sell(), scriptedRng([])).events)).toEqual(['wrong_phase']);
    }
    const tired = maker({ sewing: 60 }, { energy: ENERGY.training - 1 });
    expect(rejectionReasons(sellWork(courtOf(tired), sell(), scriptedRng([])).events)).toEqual(['not_enough_energy']);
    const exiled = maker({ sewing: 60 }, { exiledThroughDay: 3 });
    expect(rejectionReasons(sellWork(courtOf(exiled, 'day', 3), sell(), scriptedRng([])).events)).toEqual(['in_cold_palace']);
    const guards = makeCourt({ characters: [makeGuard({ id: 'lan' })] });
    expect(rejectionReasons(sellWork(guards, sell(), scriptedRng([])).events)).toEqual(['not_a_lady']);
    expect(rejectionReasons(sellWork(courtOf(lan), { ...sell(), actorId: 'nobody' }, scriptedRng([])).events)).toEqual([
      'unknown_character',
    ]);
  });

  it('gives the same result for the same seed, and never changes the state it was given', () => {
    const court = deepFreeze(courtOf(maker({ sewing: 55 })));
    expect(sellWork(court, sell(), createRng(4))).toEqual(sellWork(court, sell(), createRng(4)));
    expect(silverOf(court, 'lan')).toBe(0);
  });
});
