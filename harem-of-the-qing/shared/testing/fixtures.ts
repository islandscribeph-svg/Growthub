/**
 * Helpers for tests: quick ways to build a lady, a guard, a servant and a court, to freeze a
 * state so a test proves a rule never changes it, and to script exact dice rolls.
 * The stat values here are test data, not game rules.
 */
import { rngFromSource, type Rng } from '../rng';
import type { GameEvent, GameEventType } from '../events';
import { newDailyRecord, pairKey } from '../rules/core';
import type {
  Character,
  CharacterId,
  Child,
  CourtState,
  Guard,
  Lady,
  Palace,
  Phase,
  Relationship,
  Servant,
} from '../types';

export const HOME_PALACE = 'palace_1';

export function makeLady(overrides: Partial<Lady> & { id: CharacterId }): Lady {
  return {
    path: 'lady',
    name: overrides.id,
    controller: { kind: 'npc', personality: null },
    palaceId: HOME_PALACE,
    rank: 'second_class_attendant',
    favor: 0,
    beauty: 20,
    intelligence: 20,
    obedience: 20,
    childbearing: 100,
    energy: 10,
    silver: 0,
    noticed: false,
    illThroughDay: null,
    exiledThroughDay: null,
    inventory: { poisonIngredients: 0, fertilityPoisonIngredients: 0 },
    today: newDailyRecord(),
    talents: {
      makeup: 0,
      poetry: 0,
      drawing: 0,
      instruments: 0,
      singing: 0,
      dancing: 0,
      sewing: 0,
      cooking: 0,
      plotting: 0,
    },
    ...overrides,
  };
}

export function makePlayerLady(overrides: Partial<Lady> & { id: CharacterId }): Lady {
  return makeLady({
    controller: {
      kind: 'player',
      online: true,
      standingOrders: { payRespects: true, trainTalent: null, stayGuarded: true },
    },
    ...overrides,
  });
}

export function makeGuard(overrides: Partial<Guard> & { id: CharacterId }): Guard {
  return {
    path: 'guard',
    name: overrides.id,
    controller: { kind: 'npc', personality: null },
    palaceId: HOME_PALACE,
    rank: 'blue_feather_guard',
    favor: 0,
    beauty: 20,
    intelligence: 20,
    loyalty: 20,
    martialSkill: 100,
    rumor: 0,
    energy: 10,
    silver: 0,
    noticed: false,
    illThroughDay: null,
    exiledThroughDay: null,
    inventory: { poisonIngredients: 0, fertilityPoisonIngredients: 0 },
    today: newDailyRecord(),
    talents: {
      swordsmanship: 0,
      archery: 0,
      riding: 0,
      poetry: 0,
      calligraphy: 0,
      music: 0,
      chess: 0,
      plotting: 0,
    },
    ...overrides,
  };
}

export function makeMaid(overrides: Partial<Servant> & { id: string; servesId: CharacterId }): Servant {
  return {
    name: overrides.id,
    role: 'personal_maid',
    loyalty: 50,
    palaceId: HOME_PALACE,
    loyaltyFromTipsToday: 0,
    ...overrides,
  };
}

export interface CourtParts {
  readonly day?: number;
  readonly phase?: Phase;
  readonly characters?: readonly Character[];
  readonly servants?: readonly Servant[];
  readonly palaces?: readonly Palace[];
  readonly children?: readonly Child[];
  /** Relationship scores to start with, as [one id, the other id, score]. */
  readonly relationships?: readonly (readonly [CharacterId, CharacterId, number])[];
}

export function makeCourt(parts: CourtParts = {}): CourtState {
  const characters = parts.characters ?? [];
  const palaceIds = new Set([HOME_PALACE, ...characters.map((character) => character.palaceId)]);
  const palaces = parts.palaces ?? [...palaceIds].map((id) => ({ id, name: id }));
  const relationships: Record<string, Relationship> = {};
  for (const [a, b, score] of parts.relationships ?? []) {
    relationships[pairKey(a, b)] = { between: a < b ? [a, b] : [b, a], score };
  }
  return {
    id: 'test_court',
    day: parts.day ?? 1,
    phase: parts.phase ?? 'day',
    characters: Object.fromEntries(characters.map((character) => [character.id, character])),
    servants: Object.fromEntries((parts.servants ?? []).map((servant) => [servant.id, servant])),
    palaces: Object.fromEntries(palaces.map((palace) => [palace.id, palace])),
    children: Object.fromEntries((parts.children ?? []).map((child) => [child.id, child])),
    relationships,
    clues: {},
    schemes: {},
    trials: {},
    ledger: [],
  };
}

/** Freezes a value all the way down, so any attempt to change it throws. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** A generator that returns exactly these fractions, in order, and throws when it runs out. */
export function scriptedRng(fractions: readonly number[]): Rng {
  let used = 0;
  return rngFromSource(
    () => {
      const fraction = fractions[used];
      if (fraction === undefined) throw new Error(`scriptedRng ran out after ${used} rolls`);
      used += 1;
      return fraction;
    },
    () => used,
  );
}

/** The fraction that makes rng.int(min, max) come out as exactly `value`. */
export function rollOf(min: number, max: number, value: number): number {
  return (value - min + 0.5) / (max - min + 1);
}

/** The lowest and highest fractions a generator can give. */
export const LOWEST_ROLL = 0;
export const HIGHEST_ROLL = 0.999999;

export function eventsOfType<T extends GameEventType>(
  events: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}

export function rejectionReasons(events: readonly GameEvent[]): string[] {
  return eventsOfType(events, 'rejected').map((event) => event.reason);
}
