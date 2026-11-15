import { describe, expect, it } from 'vitest';
import { ENERGY, GIFTS, RELATIONSHIP, STARTING, STAT, STIPEND, TRANSFER } from '../../../shared/balance';
import type { GameEvent, RejectionReason } from '../../../shared/events';
import { halvedForHigherRank } from '../../../shared/rules/gifting';
import { relationshipBetween } from '../../../shared/rules/relationships';
import { deepFreeze } from '../../../shared/testing/fixtures';
import { ACTIVITY_SPOTS, EMPRESS_DOWAGER_ID, type Lady } from '../../../shared/types';
import { MAID_ID, YOU, createDemoCourt, everyoneElse } from './demoCourt';
import { describeEvent } from './describe';
import { REJECTION_TEXT } from './labels';
import { SandboxSession } from './session';

function you(session: SandboxSession): Lady {
  const character = session.court.characters[YOU];
  if (character?.path !== 'lady') throw new Error('expected the player to be a lady');
  return character;
}

function texts(session: SandboxSession): string[] {
  return (session.latest?.lines ?? []).map((line) => line.text);
}

describe('the sandbox court', () => {
  it('opens on the Morning of day 1 with a new character’s starting values', () => {
    const court = createDemoCourt();
    expect([court.day, court.phase]).toEqual([1, 'morning']);
    expect(court.characters[YOU]).toMatchObject({
      rank: 'second_class_attendant',
      beauty: STARTING.beauty,
      intelligence: STARTING.intelligence,
      obedience: STARTING.obedience,
      silver: STARTING.silver,
      energy: ENERGY.perDay,
    });
    expect(court.servants[MAID_ID]).toMatchObject({ servesId: YOU, loyalty: STARTING.maidLoyalty });
  });

  it('keeps every stat of everyone inside the scale', () => {
    for (const character of Object.values(createDemoCourt().characters)) {
      for (const value of [character.beauty, character.intelligence, character.favor, ...Object.values(character.talents)]) {
        expect(value).toBeGreaterThanOrEqual(STAT.min);
        expect(value).toBeLessThanOrEqual(STAT.max);
      }
    }
  });

  it('lists everyone you can have a relationship with, the Empress Dowager included', () => {
    const others = everyoneElse(createDemoCourt());
    expect(others).not.toContain(YOU);
    expect(others).toContain(EMPRESS_DOWAGER_ID);
  });
});

describe('a sandbox sitting', () => {
  it('plays a first day: respects, training, a gift, a sale, then on to the next Morning', () => {
    const session = new SandboxSession('first-day');
    session.payRespects();
    expect(relationshipBetween(session.court, YOU, 'mei')).toBe(RELATIONSHIP.strangers + 1);

    session.nextPhase();
    expect(session.court.phase).toBe('day');
    session.train('kitchen', undefined, false, false);
    session.giveGift('yu', 'trinket');
    session.sellWork('sewing');
    expect(you(session).energy).toBe(ENERGY.perDay - 2 * ENERGY.training - ENERGY.socializing);
    // Yu outranks a new attendant, so a trinket is worth half to her.
    expect(relationshipBetween(session.court, YOU, 'yu')).toBe(
      RELATIONSHIP.strangers + halvedForHigherRank(GIFTS.trinket.relationship ?? 0),
    );

    const silverBefore = you(session).silver;
    session.nextPhase();
    session.nextPhase();
    expect(you(session).energy).toBe(0);
    session.nextPhase();
    expect([session.court.day, session.court.phase]).toEqual([2, 'morning']);
    expect(you(session).energy).toBe(ENERGY.perDay);
    expect(you(session).silver).toBe(silverBefore + STIPEND.second_class_attendant);
  });

  it('has the NPC ladies pay their respects each new Morning, so only a player can be marked down', () => {
    const session = new SandboxSession('npc-respects');
    expect(session.court.characters['yu']?.today.paidRespects).toBe(true);
    session.nextPhase();
    expect(texts(session).some((text) => text.startsWith('Attendant Yu skipped'))).toBe(false);
    for (let step = 0; step < 3; step++) session.nextPhase();
    expect(session.court.characters['yu']?.today.paidRespects).toBe(true);
    session.nextPhase();
    expect(texts(session).some((text) => text.startsWith('You skipped Morning respects'))).toBe(true);
    expect(texts(session).some((text) => text.startsWith('Attendant Yu skipped'))).toBe(false);
  });

  it('answers a refused action with the reason and changes nothing', () => {
    const session = new SandboxSession('refusals');
    const before = session.court;
    session.train('kitchen', undefined, false, false);
    expect(session.court).toBe(before);
    expect(texts(session)).toEqual([`Not allowed: ${REJECTION_TEXT.wrong_phase}`]);
  });

  it('caps silver given to the other player, and not silver given to an NPC', () => {
    const session = new SandboxSession('cap');
    for (let add = 0; add < 4; add++) session.helperAddSilver();
    session.giveSilver('qing', TRANSFER.playerToPlayerCapPerDay + 1);
    expect(texts(session)).toEqual([`Not allowed: ${REJECTION_TEXT.transfer_cap_reached}`]);
    session.giveSilver('yu', TRANSFER.playerToPlayerCapPerDay + 1);
    expect(texts(session)[0]).toContain('You gave Attendant Yu');
  });

  it('gives the same results for the same seed and the same clicks', () => {
    const play = (seed: string) => {
      const session = new SandboxSession(seed);
      session.nextPhase();
      session.helperSetTalent('cooking', 45);
      session.giveGift('mei', 'homemade_dish');
      session.sellWork('drawing');
      return session.log.map((entry) => entry.lines.map((line) => line.text));
    };
    expect(play('same')).toEqual(play('same'));
  });

  it('runs every button for thirty days without an error or a stat leaving the scale', () => {
    const session = new SandboxSession('long-run');
    const people = everyoneElse(session.court);
    for (let day = 0; day < 30; day++) {
      session.payRespects();
      session.nextPhase();
      session.dollUp(true);
      session.train(ACTIVITY_SPOTS[day % ACTIVITY_SPOTS.length] ?? 'kitchen', undefined, day % 2 === 0, false);
      session.train('study', day % 2 === 0 ? 'poetry' : 'drawing', false, false);
      session.greet(people[day % people.length] ?? 'mei');
      session.giveGift(people[(day + 1) % people.length] ?? 'mei', day % 3 === 0 ? 'homemade_dish' : 'trinket');
      session.sellWork(day % 2 === 0 ? 'sewing' : 'drawing');
      session.buy('premium_cosmetics');
      session.tipMaid();
      session.giveSilver('qing', 3);
      session.nextPhase();
      session.nextPhase();
      session.nextPhase();
      const lan = you(session);
      expect(lan.silver).toBeGreaterThanOrEqual(0);
      expect(lan.energy).toBe(ENERGY.perDay);
      for (const value of [lan.beauty, lan.intelligence, lan.obedience, ...Object.values(lan.talents)]) {
        expect(value).toBeGreaterThanOrEqual(STAT.min);
        expect(value).toBeLessThanOrEqual(STAT.max);
      }
    }
    expect(session.court.day).toBe(31);
  });

  it('never changes a court it has already shown', () => {
    const session = new SandboxSession('frozen');
    deepFreeze(session.court);
    expect(() => {
      session.payRespects();
      deepFreeze(session.court);
      session.nextPhase();
      deepFreeze(session.court);
      session.giveGift('mei', 'trinket');
      session.helperSetRelationship('everyone', 5);
    }).not.toThrow();
    expect(texts(session)).toContain('You became hated by the harem.');
    expect(texts(session)).toContain('You and Consort Mei: relationship 32 → 5 (test helper).');
    expect(texts(session)).toContain('Xiu the maid: Loyalty 50 → 30 (her mistress became hated).');
  });
});

describe('describing what happened', () => {
  it('has a sentence for every reason an action can be refused', () => {
    const court = createDemoCourt();
    for (const reason of Object.keys(REJECTION_TEXT) as RejectionReason[]) {
      const event: GameEvent = { type: 'rejected', intent: 'train', actorId: YOU, reason };
      expect(describeEvent(event, court)).toMatchObject({ tone: 'refused', about: [YOU] });
    }
  });

  it('says "You" for the player and uses names for everyone else', () => {
    const court = createDemoCourt();
    expect(describeEvent({ type: 'greeted', characterId: YOU, targetId: 'mei' }, court)?.text).toBe('You greeted Consort Mei.');
    expect(describeEvent({ type: 'greeted', characterId: 'mei', targetId: YOU }, court)?.text).toBe('Consort Mei greeted you.');
    expect(
      describeEvent({ type: 'relationship_changed', between: [EMPRESS_DOWAGER_ID, YOU], from: 30, to: 31, cause: 'greeting' }, court)?.text,
    ).toBe('You and the Empress Dowager: relationship 30 → 31 (a greeting).');
  });
});
