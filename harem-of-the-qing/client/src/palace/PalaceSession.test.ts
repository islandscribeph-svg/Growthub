import { describe, expect, it } from 'vitest';
import { ENERGY, PRIVATE_ROOM, STARTING, TIP } from '../../../shared/balance';
import type { RejectionReason } from '../../../shared/events';
import { relationshipBetween } from '../../../shared/rules/relationships';
import { trainingGain } from '../../../shared/rules/training';
import { PHASES, type Lady } from '../../../shared/types';
import { REJECTION_TEXT } from '../sandbox/labels';
import { HELPER_SILVER } from '../sandbox/session';
import { COOK_ID, EUNUCH_ID, GUARD_ID, MAID_ID, MISTRESS_ID, NEIGHBOUR_ID, YOU } from './palaceCourt';
import { PalaceSession } from './PalaceSession';

const MOST_STIRS = 60;

function you(session: PalaceSession): Lady {
  const character = session.court.characters[YOU];
  if (character?.path !== 'lady') throw new Error('expected the player to be a lady');
  return character;
}

function where(session: PalaceSession, id: string): string | undefined {
  return session.court.whereabouts[id];
}

function walkTo(session: PalaceSession, placeId: string | null): string[] {
  return session.send({ type: 'enter_place', actorId: YOU, placeId }).lines.map((line) => line.text);
}

function refusal(reason: RejectionReason): string {
  return `Not allowed: ${REJECTION_TEXT[reason]}`;
}

/** Lets a little time pass, again and again, until someone is in the room the test needs them in. */
function waitUntil(session: PalaceSession, id: string, placeId: string): void {
  for (let stirs = 0; stirs < MOST_STIRS && where(session, id) !== placeId; stirs++) session.stir();
  expect(where(session, id), `${id} never went to ${placeId}`).toBe(placeId);
}

function withMistress(session: PalaceSession): number {
  return relationshipBetween(session.court, YOU, MISTRESS_ID);
}

describe('the palace when it opens', () => {
  it('is the Morning of day 1, with everyone in their Morning place', () => {
    const session = new PalaceSession('opening');
    expect([session.court.day, session.court.phase]).toEqual([1, 'morning']);
    expect(where(session, MISTRESS_ID)).toBe('main_hall');
    expect(where(session, NEIGHBOUR_ID)).toBe('main_hall');
    expect(where(session, MAID_ID)).toBe('side_room_1');
    expect(where(session, COOK_ID)).toBe('kitchen');
    expect(where(session, EUNUCH_ID)).toBe('courtyard');
    expect(where(session, GUARD_ID)).toBe('palace_gate');
  });

  it('has not placed the player: the page says where she is standing', () => {
    const session = new PalaceSession('opening');
    expect(session.placeId).toBeNull();
    walkTo(session, 'side_room_1');
    expect(session.placeId).toBe('side_room_1');
  });

  it('leaves the ladies of other palaces out of reach', () => {
    const session = new PalaceSession('opening');
    expect(where(session, 'empress')).toBeUndefined();
    expect(where(session, 'hua')).toBeUndefined();
  });

  it('starts with an empty history', () => {
    expect(new PalaceSession('opening').log).toEqual([]);
  });
});

describe('a day lived by walking about', () => {
  it('goes from the maid, to the mistress, to the cook, to bed', () => {
    const session = new PalaceSession('a day');
    const cookingBefore = you(session).talents.cooking;

    walkTo(session, 'side_room_1');
    session.send({ type: 'tip_servant', actorId: YOU, servantId: MAID_ID });
    expect(session.court.servants[MAID_ID]?.loyalty).toBe(STARTING.maidLoyalty + TIP.loyaltyGain);
    expect(you(session).silver).toBe(STARTING.silver - TIP.cost);

    walkTo(session, 'courtyard');
    walkTo(session, 'main_hall');
    const bow = session.send({ type: 'pay_respects', actorId: YOU });
    expect(bow.lines[0]?.text).toBe('You paid Morning respects to Consort Mei.');
    expect(withMistress(session)).toBe(31);

    session.nextPhase();
    expect(session.court.phase).toBe('day');
    walkTo(session, 'courtyard');
    walkTo(session, 'kitchen');
    waitUntil(session, COOK_ID, 'kitchen');
    session.send({ type: 'train', actorId: YOU, spot: 'kitchen' });
    expect(you(session).talents.cooking).toBe(cookingBefore + trainingGain(cookingBefore));
    expect(you(session).energy).toBe(ENERGY.perDay - ENERGY.training);

    session.nextPhase();
    session.nextPhase();
    expect(session.court.phase).toBe('night');
    expect(where(session, MISTRESS_ID)).toBe('mistress_room');
    expect(where(session, NEIGHBOUR_ID)).toBe('side_room_2');
    expect(where(session, COOK_ID)).toBe('servants_quarters');

    session.nextPhase();
    expect([session.court.day, session.court.phase]).toEqual([2, 'morning']);
    expect(where(session, MISTRESS_ID)).toBe('main_hall');
    expect(you(session).energy).toBe(ENERGY.perDay);
  });

  it('never moves the player when the court stirs or the clock moves', () => {
    const session = new PalaceSession('stay put');
    walkTo(session, 'study');
    for (let step = 0; step < PHASES.length * 2; step++) {
      session.stir();
      session.nextPhase();
      expect(session.placeId).toBe('study');
    }
  });
});

describe('doing things in the wrong place', () => {
  it('refuses respects from her own room, and a greeting across the palace', () => {
    const session = new PalaceSession('wrong place');
    walkTo(session, 'side_room_1');
    expect(session.send({ type: 'pay_respects', actorId: YOU }).lines[0]?.text).toBe(refusal('not_with_that_person'));
    session.nextPhase();
    expect(session.send({ type: 'greet', actorId: YOU, targetId: GUARD_ID }).lines[0]?.text).toBe(refusal('not_with_that_person'));
    expect(you(session).energy).toBe(ENERGY.perDay);
  });

  it('refuses cooking anywhere but the kitchen', () => {
    const session = new PalaceSession('wrong place');
    session.nextPhase();
    walkTo(session, 'study');
    expect(session.send({ type: 'train', actorId: YOU, spot: 'kitchen' }).lines[0]?.text).toBe(refusal('not_in_the_right_place'));
    walkTo(session, 'kitchen');
    expect(session.send({ type: 'train', actorId: YOU, spot: 'kitchen' }).lines[0]?.text).toBe('You trained (Kitchen): Cooking +3.');
  });

  it('refuses an errand when the maid is not with her', () => {
    const session = new PalaceSession('wrong place');
    walkTo(session, 'main_hall');
    expect(session.send({ type: 'buy', actorId: YOU, item: 'premium_cosmetics' }).lines[0]?.text).toBe(refusal('maid_not_here'));
    expect(you(session).silver).toBe(STARTING.silver);
  });
});

describe('the mistress in her own room', () => {
  function sessionWithMistressInHerRoom(): PalaceSession {
    const session = new PalaceSession('her room');
    session.nextPhase();
    walkTo(session, 'main_hall');
    waitUntil(session, MISTRESS_ID, 'mistress_room');
    return session;
  }

  it('costs relationship points to walk in on her', () => {
    const session = sessionWithMistressInHerRoom();
    const before = withMistress(session);
    const lines = walkTo(session, 'mistress_room');
    expect(lines[0]).toBe('You walked in on Consort Mei in her own room.');
    expect(withMistress(session)).toBe(before - PRIVATE_ROOM.relationshipLoss);
  });

  it('refuses a greeting there, and spends no energy on it', () => {
    const session = sessionWithMistressInHerRoom();
    walkTo(session, 'mistress_room');
    const greeting = session.send({ type: 'greet', actorId: YOU, targetId: MISTRESS_ID });
    expect(greeting.lines[0]?.text).toBe(refusal('she_is_in_her_own_room'));
    expect(you(session).energy).toBe(ENERGY.perDay);
  });

  it('only counts once in a day, and counts again the next day', () => {
    const session = sessionWithMistressInHerRoom();
    walkTo(session, 'mistress_room');
    const afterFirst = withMistress(session);
    walkTo(session, 'main_hall');
    expect(walkTo(session, 'mistress_room')[0]).toContain('again');
    expect(withMistress(session)).toBe(afterFirst);

    walkTo(session, 'main_hall');
    while (session.court.day === 1 || session.court.phase !== 'day') session.nextPhase();
    waitUntil(session, MISTRESS_ID, 'mistress_room');
    const nextDay = withMistress(session);
    walkTo(session, 'mistress_room');
    expect(withMistress(session)).toBe(nextDay - PRIVATE_ROOM.relationshipLoss);
  });

  it('costs nothing to walk through her room while she is out', () => {
    const session = new PalaceSession('her room');
    const before = withMistress(session);
    expect(where(session, MISTRESS_ID)).toBe('main_hall');
    expect(walkTo(session, 'mistress_room')).toEqual([]);
    expect(withMistress(session)).toBe(before);
  });

  it('lets her be greeted once she comes out to the main hall or the courtyard', () => {
    const session = sessionWithMistressInHerRoom();
    for (let stirs = 0; stirs < MOST_STIRS && where(session, MISTRESS_ID) === 'mistress_room'; stirs++) session.stir();
    const meetingPlace = where(session, MISTRESS_ID);
    expect(['main_hall', 'courtyard']).toContain(meetingPlace);
    walkTo(session, meetingPlace ?? null);
    const before = withMistress(session);
    session.send({ type: 'greet', actorId: YOU, targetId: MISTRESS_ID });
    expect(withMistress(session)).toBe(before + 1);
  });
});

describe('asking a regular first', () => {
  it('is remembered while she stays in the room, and forgotten when she leaves', () => {
    const session = new PalaceSession('asking');
    walkTo(session, 'music_pavilion');
    expect(session.hasAsked(NEIGHBOUR_ID)).toBe(false);
    const entry = session.askRegular(NEIGHBOUR_ID);
    expect(entry.lines[0]?.text).toBe('You asked Attendant Yu if you might practise here. She nods.');
    expect(session.hasAsked(NEIGHBOUR_ID)).toBe(true);
    expect(session.hasAsked(MISTRESS_ID)).toBe(false);

    walkTo(session, 'courtyard');
    walkTo(session, 'music_pavilion');
    expect(session.hasAsked(NEIGHBOUR_ID)).toBe(false);
  });

  it('cannot be done from outside every room', () => {
    const session = new PalaceSession('asking');
    session.askRegular(NEIGHBOUR_ID);
    expect(session.hasAsked(NEIGHBOUR_ID)).toBe(false);
  });
});

describe('the history and the dice', () => {
  it('keeps plain walking out of the history, but still tells the page', () => {
    const session = new PalaceSession('history');
    let told = 0;
    session.onChange(() => (told += 1));
    walkTo(session, 'courtyard');
    walkTo(session, 'study');
    expect(session.log).toEqual([]);
    expect(told).toBe(2);
    session.nextPhase();
    expect(session.log).toHaveLength(1);
    expect(session.log[0]?.stamp).toBe('Day 1 · Morning');
    expect(told).toBe(3);
  });

  it('records the test helper that adds silver', () => {
    const session = new PalaceSession('history');
    const entry = session.helperAddSilver();
    expect(entry.helper).toBe(true);
    expect(you(session).silver).toBe(STARTING.silver + HELPER_SILVER);
    expect(session.log).toHaveLength(1);
  });

  it('plays out the same way from the same seed', () => {
    const story = (seed: string): string[] => {
      const session = new PalaceSession(seed);
      const told: string[] = [];
      for (let step = 0; step < PHASES.length * 3; step++) {
        session.stir();
        session.nextPhase();
        told.push(JSON.stringify(session.court.whereabouts));
      }
      return told;
    };
    expect(story('same')).toEqual(story('same'));
    expect(story('same')).not.toEqual(story('other'));
  });
});
