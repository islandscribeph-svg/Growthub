import { describe, expect, it } from 'vitest';
import {
  ENERGY,
  GIFTS,
  PRIVATE_ROOM,
  RELATIONSHIP,
  RELATIONSHIP_CHANGE,
  SHOP_PRICE,
  STEPPING_ON_TOES,
  TIP,
} from '../balance';
import { createRng } from '../rng';
import { deepFreeze, eventsOfType, makeLady, rejectionReasons } from '../testing/fixtures';
import { BO, COOK, EUNUCH, LAN, MAID, MEI, YU, makePalaceCourt, type PalaceParts } from '../testing/palaceFixture';
import type { CourtState } from '../types';
import { act, maidWith, whyCannotApproach, whyCannotTrainHere, type CourtIntent } from './act';
import { relationshipBetween } from './relationships';

const rng = () => createRng('act');

function run(parts: PalaceParts, intent: CourtIntent) {
  const court = makePalaceCourt(parts);
  return { court, result: act(court, intent, rng()) };
}

function expectRefused(parts: PalaceParts, intent: CourtIntent, reason: string): void {
  const { court, result } = run(parts, intent);
  expect(rejectionReasons(result.events)).toEqual([reason]);
  expect(result.state).toBe(court);
}

function silverOf(state: CourtState, id: string): number {
  return state.characters[id]?.silver ?? 0;
}

describe('Morning respects are paid where the mistress is', () => {
  const intent: CourtIntent = { type: 'pay_respects', actorId: LAN };

  it('works when she stands with her mistress', () => {
    const { result } = run({ phase: 'morning', whereabouts: [[LAN, 'hall'], [MEI, 'hall']] }, intent);
    expect(eventsOfType(result.events, 'respects_paid')).toHaveLength(1);
    expect(relationshipBetween(result.state, LAN, MEI)).toBe(RELATIONSHIP.strangers + RELATIONSHIP_CHANGE.respectsOrGreeting);
  });

  it('cannot be paid from another room, or from off the map', () => {
    expectRefused({ phase: 'morning', whereabouts: [[LAN, 'lan_room'], [MEI, 'hall']] }, intent, 'not_with_that_person');
    expectRefused({ phase: 'morning', whereabouts: [[MEI, 'hall']] }, intent, 'not_with_that_person');
  });

  it('still answers with the rule\'s own reason when she has nobody to bow to', () => {
    expectRefused({ phase: 'morning' }, { type: 'pay_respects', actorId: MEI }, 'nobody_to_pay_respects_to');
    expectRefused({ phase: 'morning' }, { type: 'pay_respects', actorId: BO }, 'not_a_lady');
  });
});

describe('greeting, and handing over a gift or silver, happen face to face', () => {
  const greetMei: CourtIntent = { type: 'greet', actorId: LAN, targetId: MEI };

  it('works when they are in the same place', () => {
    const { result } = run({ whereabouts: [[LAN, 'yard'], [MEI, 'yard']] }, greetMei);
    expect(eventsOfType(result.events, 'greeted')).toHaveLength(1);
  });

  it('cannot be done from somewhere else', () => {
    expectRefused({ whereabouts: [[LAN, 'yard'], [MEI, 'hall']] }, greetMei, 'not_with_that_person');
    expectRefused({ whereabouts: [[LAN, 'yard']] }, greetMei, 'not_with_that_person');
    expectRefused({ whereabouts: [[MEI, 'hall']] }, greetMei, 'not_with_that_person');
  });

  it('cannot be done to a lady in her own room, unless the visitor is welcome there', () => {
    const inHerRoom = [[LAN, 'mei_room'], [MEI, 'mei_room']] as const;
    expectRefused({ whereabouts: inHerRoom }, greetMei, 'she_is_in_her_own_room');
    expectRefused(
      { whereabouts: inHerRoom, relationships: [[LAN, MEI, PRIVATE_ROOM.welcomeFromRelationship - 1]] },
      greetMei,
      'she_is_in_her_own_room',
    );
    const welcome = run({ whereabouts: inHerRoom, relationships: [[LAN, MEI, PRIVATE_ROOM.welcomeFromRelationship]] }, greetMei);
    expect(eventsOfType(welcome.result.events, 'greeted')).toHaveLength(1);
  });

  it('can be done to a lady who is visiting someone else\'s room', () => {
    const court = makePalaceCourt({ whereabouts: [[LAN, 'lan_room'], [YU, 'lan_room']] });
    expect(whyCannotApproach(court, LAN, YU)).toBeNull();
    const reversed = makePalaceCourt({ whereabouts: [[LAN, 'yu_room'], [YU, 'yu_room']] });
    expect(whyCannotApproach(reversed, LAN, YU)).toBe('she_is_in_her_own_room');
  });

  it('lets a lady who outranks her speak to her in her room', () => {
    const court = makePalaceCourt({ whereabouts: [[MEI, 'yu_room'], [YU, 'yu_room']] });
    expect(whyCannotApproach(court, MEI, YU)).toBeNull();
  });

  it('applies to gifts and silver handed over in person', () => {
    const gift: CourtIntent = { type: 'give_gift', actorId: LAN, recipientId: MEI, gift: 'trinket' };
    const silver: CourtIntent = { type: 'give_silver', actorId: LAN, recipientId: MEI, amount: 5 };
    expectRefused({ whereabouts: [[LAN, 'yard'], [MEI, 'hall']] }, gift, 'not_with_that_person');
    expectRefused({ whereabouts: [[LAN, 'yard'], [MEI, 'hall']] }, silver, 'not_with_that_person');
    expectRefused({ whereabouts: [[LAN, 'mei_room'], [MEI, 'mei_room']] }, gift, 'she_is_in_her_own_room');

    const together = { whereabouts: [[LAN, 'hall'], [MEI, 'hall']] } as const;
    expect(eventsOfType(run(together, gift).result.events, 'gift_given')).toHaveLength(1);
    expect(silverOf(run(together, silver).result.state, MEI)).toBe(5);
  });
});

describe('her maid carries gifts and silver, and runs to the shops', () => {
  const withMaid = [[LAN, 'lan_room'], [MAID, 'lan_room'], [MEI, 'hall']] as const;

  it('delivers a gift to someone who is not there', () => {
    const { result } = run({ whereabouts: withMaid }, { type: 'give_gift', actorId: LAN, recipientId: MEI, gift: 'trinket', sentWithMaid: true });
    expect(result.events[0]).toEqual({ type: 'maid_sent', characterId: LAN, servantId: MAID, errand: 'gift' });
    expect(eventsOfType(result.events, 'gift_given')).toHaveLength(1);
    expect(silverOf(result.state, LAN)).toBe(500 - GIFTS.trinket.cost);
  });

  it('delivers to a lady in her own room, and to someone off the map', () => {
    const toHerRoom = run(
      { whereabouts: [[LAN, 'lan_room'], [MAID, 'lan_room'], [MEI, 'mei_room']] },
      { type: 'give_gift', actorId: LAN, recipientId: MEI, gift: 'trinket', sentWithMaid: true },
    );
    expect(eventsOfType(toHerRoom.result.events, 'gift_given')).toHaveLength(1);
    const offMap = run(
      { whereabouts: [[LAN, 'lan_room'], [MAID, 'lan_room']] },
      { type: 'give_silver', actorId: LAN, recipientId: BO, amount: 7, sentWithMaid: true },
    );
    expect(offMap.result.events[0]).toEqual({ type: 'maid_sent', characterId: LAN, servantId: MAID, errand: 'silver' });
    expect(silverOf(offMap.result.state, BO)).toBe(7);
  });

  it('cannot be sent when the maid is not with her', () => {
    const apart = [[LAN, 'yard'], [MAID, 'lan_room'], [MEI, 'hall']] as const;
    expectRefused({ whereabouts: apart }, { type: 'give_gift', actorId: LAN, recipientId: MEI, gift: 'trinket', sentWithMaid: true }, 'maid_not_here');
    expectRefused({ whereabouts: apart }, { type: 'give_silver', actorId: LAN, recipientId: MEI, amount: 5, sentWithMaid: true }, 'maid_not_here');
    expectRefused({ whereabouts: apart }, { type: 'buy', actorId: LAN, item: 'premium_cosmetics' }, 'maid_not_here');
  });

  it('is only her own personal maid: another servant in the room does not count', () => {
    const court = makePalaceCourt({ whereabouts: [[LAN, 'kitchen'], [COOK, 'kitchen'], [MAID, 'lan_room']] });
    expect(maidWith(court, LAN)).toBeNull();
    expect(maidWith(makePalaceCourt({ whereabouts: withMaid }), LAN)?.id).toBe(MAID);
    expect(maidWith(makePalaceCourt({ whereabouts: [[MEI, 'lan_room'], [MAID, 'lan_room']] }), MEI)).toBeNull();
  });

  it('buys from the shop for her', () => {
    const { result } = run({ whereabouts: withMaid }, { type: 'buy', actorId: LAN, item: 'premium_cosmetics' });
    expect(result.events[0]).toEqual({ type: 'maid_sent', characterId: LAN, servantId: MAID, errand: 'shopping' });
    expect(silverOf(result.state, LAN)).toBe(500 - SHOP_PRICE.premium_cosmetics);
  });

  it('is not sent at all when the rule refuses the errand', () => {
    const poor = run({ whereabouts: withMaid, lan: { silver: 0 } }, { type: 'buy', actorId: LAN, item: 'premium_cosmetics' });
    expect(rejectionReasons(poor.result.events)).toEqual(['not_enough_silver']);
    expect(eventsOfType(poor.result.events, 'maid_sent')).toEqual([]);
    expect(poor.result.state).toBe(poor.court);
  });
});

describe('training happens at the spot', () => {
  it('trains cooking in the kitchen alongside the cook, and nowhere else', () => {
    const cook: CourtIntent = { type: 'train', actorId: LAN, spot: 'kitchen' };
    const { result } = run({ whereabouts: [[LAN, 'kitchen'], [COOK, 'kitchen']] }, cook);
    expect(eventsOfType(result.events, 'trained')[0]?.talent).toBe('cooking');
    expectRefused({ whereabouts: [[LAN, 'yard'], [COOK, 'yard']] }, cook, 'not_in_the_right_place');
    expectRefused({}, cook, 'not_in_the_right_place');
  });

  it('cannot train cooking while the cook is away, even with another servant in the kitchen', () => {
    const cook: CourtIntent = { type: 'train', actorId: LAN, spot: 'kitchen' };
    expectRefused({ whereabouts: [[LAN, 'kitchen']] }, cook, 'no_servant_here');
    expectRefused({ whereabouts: [[LAN, 'kitchen'], [COOK, 'quarters']] }, cook, 'no_servant_here');
    expectRefused({ whereabouts: [[LAN, 'kitchen'], [EUNUCH, 'kitchen'], [MAID, 'kitchen']] }, cook, 'no_servant_here');
  });

  it('does the courtyard chores in the courtyard alongside the eunuch', () => {
    const chores: CourtIntent = { type: 'train', actorId: LAN, spot: 'courtyard_chores' };
    const withEunuch = run({ whereabouts: [[LAN, 'yard'], [EUNUCH, 'yard']] }, chores);
    expect(eventsOfType(withEunuch.result.events, 'trained')).toHaveLength(1);
    expectRefused({ whereabouts: [[LAN, 'study'], [EUNUCH, 'study']] }, chores, 'not_in_the_right_place');
    expectRefused({ whereabouts: [[LAN, 'yard']] }, chores, 'no_servant_here');
    expectRefused({ whereabouts: [[LAN, 'yard'], [COOK, 'yard']] }, chores, 'no_servant_here');
  });

  it('needs no servant for the spots a lady works at alone', () => {
    const read: CourtIntent = { type: 'train', actorId: LAN, spot: 'study', talent: 'poetry' };
    expect(eventsOfType(run({ whereabouts: [[LAN, 'study']] }, read).result.events, 'trained')).toHaveLength(1);
  });

  it('gossips wherever a servant is, and not where there is none', () => {
    const gossip: CourtIntent = { type: 'train', actorId: LAN, spot: 'servants_gossip' };
    const { result } = run({ whereabouts: [[LAN, 'kitchen'], [COOK, 'kitchen']] }, gossip);
    expect(eventsOfType(result.events, 'trained')[0]?.talent).toBe('plotting');
    expectRefused({ whereabouts: [[LAN, 'kitchen'], [MEI, 'kitchen']] }, gossip, 'no_servant_here');
    expectRefused({}, gossip, 'not_in_the_right_place');
    const court = makePalaceCourt({ whereabouts: [[LAN, 'lan_room'], [MAID, 'lan_room']] });
    expect(whyCannotTrainHere(court, LAN, 'servants_gossip')).toBeNull();
  });

  it('steps on the regular\'s toes only when she is in the room', () => {
    const sing: CourtIntent = { type: 'train', actorId: LAN, spot: 'music_pavilion', talent: 'singing' };
    const present = run({ whereabouts: [[LAN, 'music'], [YU, 'music']] }, sing);
    expect(relationshipBetween(present.result.state, LAN, YU)).toBe(RELATIONSHIP.strangers - STEPPING_ON_TOES.relationshipLoss);
    const away = run({ whereabouts: [[LAN, 'music'], [YU, 'yard']] }, sing);
    expect(relationshipBetween(away.result.state, LAN, YU)).toBe(RELATIONSHIP.strangers);
  });

  it('costs nothing with the regular when she asks first', () => {
    const { result } = run(
      { whereabouts: [[LAN, 'music'], [YU, 'music']] },
      { type: 'train', actorId: LAN, spot: 'music_pavilion', talent: 'singing', askedFirst: true },
    );
    expect(relationshipBetween(result.state, LAN, YU)).toBe(RELATIONSHIP.strangers);
    expect(eventsOfType(result.events, 'trained')).toHaveLength(1);
  });

  it('does not count a lady who is in the room but is not its regular', () => {
    const { result } = run(
      { whereabouts: [[LAN, 'music'], [MEI, 'music']] },
      { type: 'train', actorId: LAN, spot: 'music_pavilion', talent: 'singing' },
    );
    expect(relationshipBetween(result.state, LAN, MEI)).toBe(RELATIONSHIP.strangers);
  });

  it('never makes the regular step on her own toes', () => {
    const { result } = run({ whereabouts: [[YU, 'music']] }, { type: 'train', actorId: YU, spot: 'music_pavilion', talent: 'singing' });
    expect(eventsOfType(result.events, 'relationship_changed')).toEqual([]);
  });
});

describe('dolling up, selling work and tipping happen in the right place', () => {
  it('dolls up only in her own room', () => {
    const dollUp: CourtIntent = { type: 'doll_up', actorId: LAN };
    expect(eventsOfType(run({ whereabouts: [[LAN, 'lan_room']] }, dollUp).result.events, 'dolled_up')).toHaveLength(1);
    expectRefused({ whereabouts: [[LAN, 'yu_room']] }, dollUp, 'not_in_own_room');
    expectRefused({}, dollUp, 'not_in_own_room');
  });

  it('makes sewing to sell in the sewing room and drawings in the study', () => {
    const lan = { talents: { ...makeLady({ id: 'x' }).talents, sewing: 50, drawing: 50 } };
    const sewing: CourtIntent = { type: 'sell_work', actorId: LAN, work: 'sewing' };
    const drawing: CourtIntent = { type: 'sell_work', actorId: LAN, work: 'drawing' };
    expect(eventsOfType(run({ lan, whereabouts: [[LAN, 'sewing']] }, sewing).result.events, 'work_sold')).toHaveLength(1);
    expect(eventsOfType(run({ lan, whereabouts: [[LAN, 'study']] }, drawing).result.events, 'work_sold')).toHaveLength(1);
    expectRefused({ lan, whereabouts: [[LAN, 'study']] }, sewing, 'not_in_the_right_place');
    expectRefused({ lan, whereabouts: [[LAN, 'sewing']] }, drawing, 'not_in_the_right_place');
  });

  it('tips her maid only when the maid is with her', () => {
    const tip: CourtIntent = { type: 'tip_servant', actorId: LAN, servantId: MAID };
    const { result } = run({ whereabouts: [[LAN, 'lan_room'], [MAID, 'lan_room']] }, tip);
    expect(result.state.servants[MAID]?.loyalty).toBe(50 + TIP.loyaltyGain);
    expectRefused({ whereabouts: [[LAN, 'yard'], [MAID, 'lan_room']] }, tip, 'not_with_that_person');
    expectRefused({}, { type: 'tip_servant', actorId: LAN, servantId: 'nobody' }, 'unknown_servant');
    expectRefused({ whereabouts: [[LAN, 'kitchen'], [COOK, 'kitchen']] }, { type: 'tip_servant', actorId: LAN, servantId: COOK }, 'not_her_servant');
  });
});

describe('the one door', () => {
  it('lets her walk in, and charges for walking in on someone', () => {
    const { result } = run({ whereabouts: [[MEI, 'mei_room']] }, { type: 'enter_place', actorId: LAN, placeId: 'mei_room' });
    expect(relationshipBetween(result.state, LAN, MEI)).toBe(RELATIONSHIP.strangers - PRIVATE_ROOM.relationshipLoss);
  });

  it('keeps every other reason the rules already give', () => {
    const inKitchen: PalaceParts['whereabouts'] = [[LAN, 'kitchen'], [COOK, 'kitchen']];
    expectRefused({ phase: 'night', whereabouts: inKitchen }, { type: 'train', actorId: LAN, spot: 'kitchen' }, 'wrong_phase');
    expectRefused({ lan: { energy: ENERGY.training - 1 }, whereabouts: inKitchen }, { type: 'train', actorId: LAN, spot: 'kitchen' }, 'not_enough_energy');
    expectRefused({ phase: 'evening', whereabouts: [[LAN, 'yard'], [MEI, 'yard']] }, { type: 'greet', actorId: LAN, targetId: MEI }, 'wrong_phase');
  });

  it('never changes the court it is given', () => {
    const court = deepFreeze(
      makePalaceCourt({ whereabouts: [[LAN, 'lan_room'], [MAID, 'lan_room'], [MEI, 'hall'], [YU, 'music'], [COOK, 'kitchen']] }),
    );
    const intents: CourtIntent[] = [
      { type: 'enter_place', actorId: LAN, placeId: 'music' },
      { type: 'doll_up', actorId: LAN },
      { type: 'tip_servant', actorId: LAN, servantId: MAID },
      { type: 'buy', actorId: LAN, item: 'premium_cosmetics' },
      { type: 'give_gift', actorId: LAN, recipientId: MEI, gift: 'homemade_dish', sentWithMaid: true },
      { type: 'give_silver', actorId: LAN, recipientId: YU, amount: 3, sentWithMaid: true },
      { type: 'train', actorId: LAN, spot: 'servants_gossip' },
      { type: 'greet', actorId: LAN, targetId: MEI },
      { type: 'sell_work', actorId: LAN, work: 'sewing' },
      { type: 'pay_respects', actorId: LAN },
    ];
    for (const intent of intents) expect(() => act(court, intent, rng())).not.toThrow();
  });
});
