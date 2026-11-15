import { describe, expect, it } from 'vitest';
import { ENERGY, GIFTING, GIFTS, GIFT_QUALITY, RELATIONSHIP } from '../balance';
import { createRng } from '../rng';
import {
  HIGHEST_ROLL,
  LOWEST_ROLL,
  deepFreeze,
  eventsOfType,
  makeCourt,
  makeGuard,
  makeLady,
  rejectionReasons,
  rollOf,
  scriptedRng,
} from '../testing/fixtures';
import { EMPEROR_ID, EMPRESS_DOWAGER_ID, type CourtState, type GiftKind, type Lady, type Phase } from '../types';
import { advancePhase } from './clock';
import { giftBand, giveGift, halvedForHigherRank, isRankedAbove, rollGiftQuality, rollHomemadeEffect } from './gifting';
import { relationshipBetween } from './relationships';

const GIFT_KINDS = Object.keys(GIFTS) as GiftKind[];
const BOUGHT: GiftKind[] = ['trinket', 'fine_jewelry', 'rare_treasure'];
const STRANGERS = RELATIONSHIP.strangers;
/** A roll that adds nothing to the maker's talent. */
const EVEN_ROLL = rollOf(GIFT_QUALITY.rollMin, GIFT_QUALITY.rollMax, 0);
const NO_ROLLS = () => scriptedRng([]);

function giver(overrides: Partial<Lady> = {}): Lady {
  return makeLady({ id: 'lan', silver: 1000, ...overrides });
}

function cook(cooking: number, overrides: Partial<Lady> = {}): Lady {
  return giver({ talents: { ...makeLady({ id: 'x' }).talents, cooking }, ...overrides });
}

function courtOf(lan: Lady, extra: Partial<Parameters<typeof makeCourt>[0]> = {}): CourtState {
  return makeCourt({ characters: [lan, makeLady({ id: 'mei' }), makeLady({ id: 'yu' })], ...extra });
}

function gift(kind: GiftKind, recipientId = 'mei') {
  return { type: 'give_gift', actorId: 'lan', recipientId, gift: kind } as const;
}

describe('the quality of a homemade gift', () => {
  it('is the maker’s talent plus the lowest roll at worst and the highest roll at best', () => {
    expect(rollGiftQuality(50, scriptedRng([LOWEST_ROLL]))).toBe(50 + GIFT_QUALITY.rollMin);
    expect(rollGiftQuality(50, scriptedRng([HIGHEST_ROLL]))).toBe(50 + GIFT_QUALITY.rollMax);
    expect(rollGiftQuality(50, scriptedRng([EVEN_ROLL]))).toBe(50);
  });

  it('always stays within the roll range of her talent', () => {
    const rng = createRng(21);
    for (let roll = 0; roll < 2000; roll++) {
      const quality = rollGiftQuality(40, rng);
      expect(quality).toBeGreaterThanOrEqual(40 + GIFT_QUALITY.rollMin);
      expect(quality).toBeLessThanOrEqual(40 + GIFT_QUALITY.rollMax);
    }
  });

  it('is good exactly from the good line, fair exactly from the fair line, and bad below it', () => {
    expect(giftBand(GIFT_QUALITY.goodFrom)).toBe('good');
    expect(giftBand(GIFT_QUALITY.goodFrom - 1)).toBe('fair');
    expect(giftBand(GIFT_QUALITY.fairFrom)).toBe('fair');
    expect(giftBand(GIFT_QUALITY.fairFrom - 1)).toBe('bad');
    expect(giftBand(-10)).toBe('bad');
    expect(giftBand(110)).toBe('good');
  });

  it('changes the relationship by an amount inside its band', () => {
    expect(rollHomemadeEffect('good', scriptedRng([LOWEST_ROLL]))).toBe(GIFT_QUALITY.goodMin);
    expect(rollHomemadeEffect('good', scriptedRng([HIGHEST_ROLL]))).toBe(GIFT_QUALITY.goodMax);
    expect(rollHomemadeEffect('fair', scriptedRng([LOWEST_ROLL]))).toBe(GIFT_QUALITY.fairMin);
    expect(rollHomemadeEffect('fair', scriptedRng([HIGHEST_ROLL]))).toBe(GIFT_QUALITY.fairMax);
    expect(rollHomemadeEffect('bad', scriptedRng([LOWEST_ROLL]))).toBe(GIFT_QUALITY.badMin);
    expect(rollHomemadeEffect('bad', scriptedRng([HIGHEST_ROLL]))).toBe(GIFT_QUALITY.badMax);
  });

  it('with the starting values: good is +5 to +8, fair is +1 to +3, bad is -3 to -5', () => {
    expect([GIFT_QUALITY.goodFrom, GIFT_QUALITY.goodMin, GIFT_QUALITY.goodMax]).toEqual([60, 5, 8]);
    expect([GIFT_QUALITY.fairFrom, GIFT_QUALITY.fairMin, GIFT_QUALITY.fairMax]).toEqual([30, 1, 3]);
    expect([GIFT_QUALITY.badMin, GIFT_QUALITY.badMax]).toEqual([-5, -3]);
    expect([GIFT_QUALITY.rollMin, GIFT_QUALITY.rollMax]).toEqual([-10, 10]);
  });
});

describe('giving a homemade gift', () => {
  it('rolls a dish on Cooking and a sewn item on Sewing', () => {
    expect(GIFTS.homemade_dish.rolledOn).toBe('cooking');
    expect(GIFTS.homemade_sewn_item.rolledOn).toBe('sewing');
    const lan = giver({ talents: { ...makeLady({ id: 'x' }).talents, cooking: 80, sewing: 10 } });
    const dish = giveGift(courtOf(lan), gift('homemade_dish'), scriptedRng([EVEN_ROLL, LOWEST_ROLL]));
    expect(eventsOfType(dish.events, 'gift_given')[0]).toMatchObject({ quality: 80, band: 'good' });
    const sewn = giveGift(courtOf(lan), gift('homemade_sewn_item'), scriptedRng([EVEN_ROLL, LOWEST_ROLL]));
    expect(eventsOfType(sewn.events, 'gift_given')[0]).toMatchObject({ quality: 10, band: 'bad' });
  });

  it('pleases the recipient when it is good', () => {
    const result = giveGift(courtOf(cook(GIFT_QUALITY.goodFrom)), gift('homemade_dish'), scriptedRng([EVEN_ROLL, HIGHEST_ROLL]));
    expect(relationshipBetween(result.state, 'lan', 'mei')).toBe(STRANGERS + GIFT_QUALITY.goodMax);
    expect(eventsOfType(result.events, 'relationship_changed')[0]?.cause).toBe('gift');
  });

  it('helps a little when it is fair', () => {
    const result = giveGift(courtOf(cook(GIFT_QUALITY.goodFrom - 1)), gift('homemade_dish'), scriptedRng([EVEN_ROLL, LOWEST_ROLL]));
    expect(relationshipBetween(result.state, 'lan', 'mei')).toBe(STRANGERS + GIFT_QUALITY.fairMin);
  });

  it('is an insult when it is bad', () => {
    const result = giveGift(courtOf(cook(GIFT_QUALITY.fairFrom - 1)), gift('homemade_dish'), scriptedRng([EVEN_ROLL, LOWEST_ROLL]));
    expect(relationshipBetween(result.state, 'lan', 'mei')).toBe(STRANGERS + GIFT_QUALITY.badMin);
    expect(eventsOfType(result.events, 'gift_given')[0]).toMatchObject({ band: 'bad', relationshipChange: GIFT_QUALITY.badMin });
  });

  it('can be lifted into a better band, or dropped into a worse one, by the roll', () => {
    const justShort = cook(GIFT_QUALITY.goodFrom - GIFT_QUALITY.rollMax);
    const lucky = giveGift(courtOf(justShort), gift('homemade_dish'), scriptedRng([HIGHEST_ROLL, LOWEST_ROLL]));
    expect(eventsOfType(lucky.events, 'gift_given')[0]?.band).toBe('good');
    const justOver = cook(GIFT_QUALITY.fairFrom - GIFT_QUALITY.rollMin - 1);
    const unlucky = giveGift(courtOf(justOver), gift('homemade_dish'), scriptedRng([LOWEST_ROLL, LOWEST_ROLL]));
    expect(eventsOfType(unlucky.events, 'gift_given')[0]?.band).toBe('bad');
  });

  it('cannot be made by a guard, who has no Cooking or Sewing', () => {
    const court = makeCourt({ characters: [makeGuard({ id: 'bo', silver: 100 }), makeLady({ id: 'mei' })] });
    const result = giveGift(court, { type: 'give_gift', actorId: 'bo', recipientId: 'mei', gift: 'homemade_dish' }, NO_ROLLS());
    expect(rejectionReasons(result.events)).toEqual(['not_a_lady']);
  });
});

describe('giving a bought gift', () => {
  it('has the fixed effect in the gift table and needs no roll', () => {
    for (const kind of BOUGHT) {
      const result = giveGift(courtOf(giver()), gift(kind), NO_ROLLS());
      expect(relationshipBetween(result.state, 'lan', 'mei')).toBe(STRANGERS + (GIFTS[kind].relationship ?? 0));
      expect(eventsOfType(result.events, 'gift_given')[0]).toMatchObject({ quality: null, band: null, counted: true });
    }
  });

  it('with the starting values: costs 3, 5, 10, 40 and 120 taels; a trinket is +2, jewelry +5, a treasure +10', () => {
    expect(GIFT_KINDS.map((kind) => GIFTS[kind].cost)).toEqual([3, 5, 10, 40, 120]);
    expect(BOUGHT.map((kind) => GIFTS[kind].relationship)).toEqual([2, 5, 10]);
  });

  it('can be given by a guard, and to a guard or the Empress Dowager', () => {
    const court = makeCourt({ characters: [makeGuard({ id: 'bo', silver: 100 }), giver(), makeLady({ id: 'mei' })] });
    const fromGuard = giveGift(court, { type: 'give_gift', actorId: 'bo', recipientId: 'mei', gift: 'trinket' }, NO_ROLLS());
    expect(relationshipBetween(fromGuard.state, 'bo', 'mei')).toBe(STRANGERS + (GIFTS.trinket.relationship ?? 0));
    const toGuard = giveGift(court, gift('fine_jewelry', 'bo'), NO_ROLLS());
    expect(relationshipBetween(toGuard.state, 'lan', 'bo')).toBe(STRANGERS + (GIFTS.fine_jewelry.relationship ?? 0));
    const toDowager = giveGift(court, gift('rare_treasure', EMPRESS_DOWAGER_ID), NO_ROLLS());
    expect(relationshipBetween(toDowager.state, 'lan', EMPRESS_DOWAGER_ID)).toBe(STRANGERS + (GIFTS.rare_treasure.relationship ?? 0));
  });
});

describe('what every gift costs', () => {
  it('takes the price of the gift and the socializing energy from the giver only', () => {
    for (const kind of GIFT_KINDS) {
      const result = giveGift(courtOf(cook(50, { silver: 500 })), gift(kind), createRng(1));
      expect(result.state.characters['lan']?.silver).toBe(500 - GIFTS[kind].cost);
      expect(result.state.characters['lan']?.energy).toBe(ENERGY.perDay - ENERGY.socializing);
      expect(result.state.characters['mei']?.silver).toBe(0);
      expect(result.state.characters['mei']?.energy).toBe(ENERGY.perDay);
    }
  });

  it('is written in the ledger', () => {
    const result = giveGift(courtOf(giver()), gift('trinket'), NO_ROLLS());
    expect(result.state.ledger).toMatchObject([
      { characterId: 'lan', direction: 'out', amount: GIFTS.trinket.cost, reason: 'gift', item: 'trinket', otherId: 'mei' },
    ]);
  });

  it('can be paid with exactly enough silver, and is refused one tael short', () => {
    for (const kind of GIFT_KINDS) {
      const enough = giveGift(courtOf(cook(50, { silver: GIFTS[kind].cost })), gift(kind), createRng(1));
      expect(enough.state.characters['lan']?.silver).toBe(0);
      const court = courtOf(cook(50, { silver: GIFTS[kind].cost - 1 }));
      const short = giveGift(court, gift(kind), NO_ROLLS());
      expect(rejectionReasons(short.events)).toEqual(['not_enough_silver']);
      expect(short.state).toBe(court);
    }
  });

  it('is refused with no silver and with no energy', () => {
    expect(rejectionReasons(giveGift(courtOf(giver({ silver: 0 })), gift('trinket'), NO_ROLLS()).events)).toEqual(['not_enough_silver']);
    expect(rejectionReasons(giveGift(courtOf(giver({ energy: 0 })), gift('trinket'), NO_ROLLS()).events)).toEqual(['not_enough_energy']);
  });
});

describe('one gift per recipient per game day', () => {
  it('counts the first gift and not the second, which still costs silver and energy', () => {
    const first = giveGift(courtOf(giver()), gift('trinket'), NO_ROLLS());
    const second = giveGift(first.state, gift('rare_treasure'), NO_ROLLS());
    expect(relationshipBetween(second.state, 'lan', 'mei')).toBe(STRANGERS + (GIFTS.trinket.relationship ?? 0));
    expect(eventsOfType(second.events, 'gift_given')[0]).toMatchObject({ counted: false, relationshipChange: 0 });
    expect(eventsOfType(second.events, 'relationship_changed')).toEqual([]);
    expect(second.state.characters['lan']?.silver).toBe(1000 - GIFTS.trinket.cost - GIFTS.rare_treasure.cost);
    expect(second.state.characters['lan']?.energy).toBe(ENERGY.perDay - 2 * ENERGY.socializing);
  });

  it('does not roll for a homemade gift that will not count', () => {
    const first = giveGift(courtOf(cook(80)), gift('trinket'), NO_ROLLS());
    expect(() => giveGift(first.state, gift('homemade_dish'), NO_ROLLS())).not.toThrow();
  });

  it('counts a bad gift as the day’s gift too', () => {
    const first = giveGift(courtOf(cook(0)), gift('homemade_dish'), scriptedRng([EVEN_ROLL, LOWEST_ROLL]));
    const second = giveGift(first.state, gift('rare_treasure'), NO_ROLLS());
    expect(relationshipBetween(second.state, 'lan', 'mei')).toBe(STRANGERS + GIFT_QUALITY.badMin);
  });

  it('counts a gift to each different recipient', () => {
    const first = giveGift(courtOf(giver()), gift('trinket', 'mei'), NO_ROLLS());
    const second = giveGift(first.state, gift('trinket', 'yu'), NO_ROLLS());
    expect(relationshipBetween(second.state, 'lan', 'yu')).toBe(STRANGERS + (GIFTS.trinket.relationship ?? 0));
  });

  it('is counted for each giver separately', () => {
    const court = makeCourt({ characters: [giver(), makeLady({ id: 'mei' }), makeLady({ id: 'yu', silver: 100 })] });
    const first = giveGift(court, gift('trinket', 'mei'), NO_ROLLS());
    const second = giveGift(first.state, { type: 'give_gift', actorId: 'yu', recipientId: 'mei', gift: 'trinket' }, NO_ROLLS());
    expect(eventsOfType(second.events, 'gift_given')[0]?.counted).toBe(true);
  });

  it('counts again the next game day', () => {
    let state = giveGift(courtOf(giver()), gift('trinket'), NO_ROLLS()).state;
    while (state.phase !== 'day' || state.day === 1) state = advancePhase(state).state;
    const nextDay = giveGift(state, gift('trinket'), NO_ROLLS());
    expect(eventsOfType(nextDay.events, 'gift_given')[0]?.counted).toBe(true);
    expect(relationshipBetween(nextDay.state, 'lan', 'mei')).toBe(STRANGERS + 2 * (GIFTS.trinket.relationship ?? 0));
  });

  it('allows as many counted gifts per recipient per day as the doc says', () => {
    expect(GIFTING.countedPerRecipientPerDay).toBe(1);
  });
});

describe('a gift to someone ranked above her', () => {
  const upward = (lan: Lady) =>
    makeCourt({
      characters: [
        lan,
        makeLady({ id: 'consort', rank: 'consort' }),
        makeLady({ id: 'equal', rank: lan.rank }),
        makeLady({ id: 'lower', rank: 'second_class_attendant' }),
        makeGuard({ id: 'senior_guard', rank: 'first_class_guard' }),
      ],
    });
  const attendant = (overrides: Partial<Lady> = {}) => giver({ rank: 'first_class_attendant', ...overrides });

  it('is worth half when it is a trinket', () => {
    const result = giveGift(upward(attendant()), gift('trinket', 'consort'), NO_ROLLS());
    const full = GIFTS.trinket.relationship ?? 0;
    expect(relationshipBetween(result.state, 'lan', 'consort')).toBe(STRANGERS + Math.floor(full * GIFTING.higherRankMultiplier));
    expect(eventsOfType(result.events, 'gift_given')[0]?.halved).toBe(true);
  });

  it('keeps its full worth when it is jewelry or better', () => {
    for (const kind of ['fine_jewelry', 'rare_treasure'] as const) {
      const result = giveGift(upward(attendant()), gift(kind, 'consort'), NO_ROLLS());
      expect(relationshipBetween(result.state, 'lan', 'consort')).toBe(STRANGERS + (GIFTS[kind].relationship ?? 0));
      expect(eventsOfType(result.events, 'gift_given')[0]?.halved).toBe(false);
    }
  });

  it('is worth half, rounded down, when it is a good homemade gift', () => {
    const lan = attendant({ talents: { ...makeLady({ id: 'x' }).talents, cooking: 90 } });
    const low = giveGift(upward(lan), gift('homemade_dish', 'consort'), scriptedRng([EVEN_ROLL, LOWEST_ROLL]));
    expect(relationshipBetween(low.state, 'lan', 'consort')).toBe(STRANGERS + halvedForHigherRank(GIFT_QUALITY.goodMin));
    const high = giveGift(upward(lan), gift('homemade_dish', 'consort'), scriptedRng([EVEN_ROLL, HIGHEST_ROLL]));
    expect(relationshipBetween(high.state, 'lan', 'consort')).toBe(STRANGERS + halvedForHigherRank(GIFT_QUALITY.goodMax));
  });

  it('with the starting values: +2 becomes +1, +5 becomes +2, +8 becomes +4, and +1 becomes nothing', () => {
    expect([2, 5, 8, 1].map(halvedForHigherRank)).toEqual([1, 2, 4, 0]);
  });

  it('is still a full insult when it is bad', () => {
    const lan = attendant({ talents: { ...makeLady({ id: 'x' }).talents, cooking: 0 } });
    const result = giveGift(upward(lan), gift('homemade_dish', 'consort'), scriptedRng([EVEN_ROLL, LOWEST_ROLL]));
    expect(relationshipBetween(result.state, 'lan', 'consort')).toBe(STRANGERS + GIFT_QUALITY.badMin);
    expect(eventsOfType(result.events, 'gift_given')[0]?.halved).toBe(false);
  });

  it('keeps its full worth to a lady of the same rank or a lower one', () => {
    for (const recipientId of ['equal', 'lower']) {
      const result = giveGift(upward(attendant()), gift('trinket', recipientId), NO_ROLLS());
      expect(relationshipBetween(result.state, 'lan', recipientId)).toBe(STRANGERS + (GIFTS.trinket.relationship ?? 0));
    }
  });

  it('treats the Empress Dowager as ranked above everyone, even the Empress', () => {
    const empress = giver({ rank: 'empress' });
    expect(isRankedAbove(upward(empress), EMPRESS_DOWAGER_ID, empress)).toBe(true);
    const result = giveGift(upward(empress), gift('trinket', EMPRESS_DOWAGER_ID), NO_ROLLS());
    expect(eventsOfType(result.events, 'gift_given')[0]?.halved).toBe(true);
  });

  it('does not compare a lady’s rank with a guard’s', () => {
    const lan = attendant();
    expect(isRankedAbove(upward(lan), 'senior_guard', lan)).toBe(false);
    const result = giveGift(upward(lan), gift('trinket', 'senior_guard'), NO_ROLLS());
    expect(eventsOfType(result.events, 'gift_given')[0]?.halved).toBe(false);
  });
});

describe('when a gift cannot be given', () => {
  it('cannot be given from the Cold Palace, and can again the day after she leaves', () => {
    const lan = giver({ exiledThroughDay: 4 });
    const inside = courtOf(lan, { day: 4 });
    expect(rejectionReasons(giveGift(inside, gift('trinket'), NO_ROLLS()).events)).toEqual(['in_cold_palace']);
    expect(rejectionReasons(giveGift(courtOf(lan, { day: 5 }), gift('trinket'), NO_ROLLS()).events)).toEqual([]);
  });

  it('can only be given in the Day phase', () => {
    const wrongPhases: Phase[] = ['morning', 'evening', 'night'];
    for (const phase of wrongPhases) {
      expect(rejectionReasons(giveGift(courtOf(giver(), { phase }), gift('trinket'), NO_ROLLS()).events)).toEqual(['wrong_phase']);
    }
  });

  it('cannot be given to herself, to the Emperor, or to someone who is not in the court', () => {
    expect(rejectionReasons(giveGift(courtOf(giver()), gift('trinket', 'lan'), NO_ROLLS()).events)).toEqual(['cannot_target_self']);
    expect(rejectionReasons(giveGift(courtOf(giver()), gift('trinket', EMPEROR_ID), NO_ROLLS()).events)).toEqual(['unknown_recipient']);
    expect(rejectionReasons(giveGift(courtOf(giver()), gift('trinket', 'nobody'), NO_ROLLS()).events)).toEqual(['unknown_recipient']);
    expect(
      rejectionReasons(giveGift(courtOf(giver()), { type: 'give_gift', actorId: 'nobody', recipientId: 'mei', gift: 'trinket' }, NO_ROLLS()).events),
    ).toEqual(['unknown_character']);
  });

  it('changes nothing and uses no roll when it is refused', () => {
    const court = courtOf(cook(80, { energy: 0 }));
    const result = giveGift(court, gift('homemade_dish'), NO_ROLLS());
    expect(result.state).toBe(court);
  });
});

describe('gifting as a whole', () => {
  it('gives the same result for the same seed', () => {
    const court = courtOf(cook(55));
    const first = giveGift(court, gift('homemade_dish'), createRng(77));
    const second = giveGift(court, gift('homemade_dish'), createRng(77));
    expect(second).toEqual(first);
  });

  it('keeps every homemade outcome inside the doc’s ranges over many seeds', () => {
    for (let seed = 0; seed < 300; seed++) {
      const talent = seed % 101;
      const result = giveGift(courtOf(cook(talent)), gift('homemade_dish'), createRng(seed));
      const event = eventsOfType(result.events, 'gift_given')[0];
      if (!event || event.quality === null) throw new Error('expected a rolled gift');
      expect(Math.abs(event.quality - talent)).toBeLessThanOrEqual(GIFT_QUALITY.rollMax);
      expect(event.band).toBe(giftBand(event.quality));
      const [min, max] =
        event.band === 'good'
          ? [GIFT_QUALITY.goodMin, GIFT_QUALITY.goodMax]
          : event.band === 'fair'
            ? [GIFT_QUALITY.fairMin, GIFT_QUALITY.fairMax]
            : [GIFT_QUALITY.badMin, GIFT_QUALITY.badMax];
      expect(event.relationshipChange).toBeGreaterThanOrEqual(min);
      expect(event.relationshipChange).toBeLessThanOrEqual(max);
      expect(relationshipBetween(result.state, 'lan', 'mei')).toBe(STRANGERS + event.relationshipChange);
    }
  });

  it('never changes the state it was given', () => {
    const court = deepFreeze(courtOf(cook(70)));
    for (const kind of GIFT_KINDS) expect(() => giveGift(court, gift(kind), createRng(3))).not.toThrow();
    expect(court.characters['lan']?.silver).toBe(1000);
  });
});
