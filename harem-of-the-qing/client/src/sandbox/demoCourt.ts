/**
 * The small court the sandbox opens with, and the test helpers that edit it directly.
 * The NPC stats here are made-up test data. The player's lady starts with the values a new
 * character gets (STARTING in shared/balance.ts).
 */
import { CHILDBEARING, ENERGY, STARTING } from '../../../shared/balance';
import { clampStat, newDailyRecord, withCharacter, type RuleResult } from '../../../shared/rules/core';
import { changeRelationship, relationshipBetween } from '../../../shared/rules/relationships';
import {
  EMPRESS_DOWAGER_ID,
  LADY_TALENTS,
  type Character,
  type CharacterId,
  type Controller,
  type CourtState,
  type Guard,
  type Lady,
  type LadyRank,
  type LadyTalent,
  type Personality,
  type Servant,
} from '../../../shared/types';

export const YOU: CharacterId = 'you';
export const MAID_ID = 'xiu';
export const REGULAR_ID: CharacterId = 'mei';

export const HOME = 'home';
const NEIGHBOUR = 'neighbour';
const EMPRESS_PALACE = 'empress_palace';

function talents(level: number, extra: Partial<Record<LadyTalent, number>> = {}): Record<LadyTalent, number> {
  const all = Object.fromEntries(LADY_TALENTS.map((talent) => [talent, level])) as Record<LadyTalent, number>;
  return { ...all, ...extra };
}

function npc(personality: Personality): Controller {
  return { kind: 'npc', personality };
}

function player(online: boolean): Controller {
  return { kind: 'player', online, standingOrders: { payRespects: true, trainTalent: null, stayGuarded: true } };
}

interface LadyParts {
  readonly id: CharacterId;
  readonly name: string;
  readonly rank: LadyRank;
  readonly palaceId: string;
  readonly controller: Controller;
  readonly level?: number;
  readonly favor?: number;
}

function lady(parts: LadyParts): Lady {
  const level = parts.level ?? STARTING.beauty;
  return {
    path: 'lady',
    id: parts.id,
    name: parts.name,
    controller: parts.controller,
    palaceId: parts.palaceId,
    rank: parts.rank,
    favor: parts.favor ?? STARTING.favor,
    beauty: level,
    intelligence: level,
    obedience: level,
    childbearing: CHILDBEARING.start,
    energy: ENERGY.perDay,
    silver: STARTING.silver,
    noticed: false,
    illThroughDay: null,
    exiledThroughDay: null,
    inventory: { poisonIngredients: 0, fertilityPoisonIngredients: 0 },
    today: newDailyRecord(),
    talents: talents(parts.level === undefined ? STARTING.talent : parts.level),
  };
}

function gateGuard(): Guard {
  return {
    path: 'guard',
    id: 'bo',
    name: 'Guard Bo',
    controller: npc('dutiful'),
    palaceId: HOME,
    rank: 'blue_feather_guard',
    favor: STARTING.favor,
    beauty: STARTING.beauty,
    intelligence: STARTING.intelligence,
    loyalty: STARTING.guardLoyalty,
    martialSkill: STARTING.martialSkill,
    rumor: 0,
    energy: ENERGY.perDay,
    silver: STARTING.silver,
    noticed: false,
    illThroughDay: null,
    exiledThroughDay: null,
    inventory: { poisonIngredients: 0, fertilityPoisonIngredients: 0 },
    today: newDailyRecord(),
    talents: {
      swordsmanship: STARTING.talent,
      archery: STARTING.talent,
      riding: STARTING.talent,
      poetry: STARTING.talent,
      calligraphy: STARTING.talent,
      music: STARTING.talent,
      chess: STARTING.talent,
      plotting: STARTING.talent,
    },
  };
}

/** Day 1, Morning: you, your palace mistress, a few neighbours, the Empress, a guard and your maid. */
export function createDemoCourt(): CourtState {
  const characters: Character[] = [
    lady({ id: YOU, name: 'Lan', rank: 'second_class_attendant', palaceId: HOME, controller: player(true) }),
    lady({ id: 'mei', name: 'Consort Mei', rank: 'consort', palaceId: HOME, controller: npc('gentle'), level: 65, favor: 70 }),
    lady({ id: 'yu', name: 'Attendant Yu', rank: 'first_class_attendant', palaceId: HOME, controller: npc('ambitious'), level: 40, favor: 27 }),
    lady({ id: 'hua', name: 'Noble Lady Hua', rank: 'noble_lady', palaceId: NEIGHBOUR, controller: npc('jealous'), level: 50, favor: 44 }),
    lady({ id: 'qing', name: 'Qing', rank: 'second_class_attendant', palaceId: NEIGHBOUR, controller: player(false) }),
    lady({ id: 'empress', name: 'the Empress', rank: 'empress', palaceId: EMPRESS_PALACE, controller: npc('dutiful'), level: 80, favor: 100 }),
    gateGuard(),
  ];
  const maid: Servant = {
    id: MAID_ID,
    name: 'Xiu',
    role: 'personal_maid',
    loyalty: STARTING.maidLoyalty,
    servesId: YOU,
    palaceId: HOME,
    loyaltyFromTipsToday: 0,
  };
  return {
    id: 'sandbox_court',
    day: 1,
    phase: 'morning',
    characters: Object.fromEntries(characters.map((character) => [character.id, character])),
    servants: { [maid.id]: maid },
    palaces: {
      [HOME]: { id: HOME, name: 'Your palace' },
      [NEIGHBOUR]: { id: NEIGHBOUR, name: 'A neighbouring palace' },
      [EMPRESS_PALACE]: { id: EMPRESS_PALACE, name: "The Empress's palace" },
    },
    // The sandbox has no map. The playable palace adds its rooms in client/src/palace.
    places: {},
    whereabouts: {},
    children: {},
    relationships: {},
    clues: {},
    schemes: {},
    trials: {},
    ledger: [],
  };
}

/** Everyone you can have a relationship with, in the order the sandbox lists them. */
export function everyoneElse(court: CourtState): CharacterId[] {
  return [...Object.keys(court.characters).filter((id) => id !== YOU), EMPRESS_DOWAGER_ID];
}

function you(court: CourtState): Lady {
  const character = court.characters[YOU];
  if (character?.path !== 'lady') throw new Error('The sandbox court has lost its player.');
  return character;
}

// Test helpers. These edit the court directly so a tester can set up a situation quickly.
// They are not game rules and the real game has nothing like them.

export function helperAddSilver(court: CourtState, amount: number): CourtState {
  const lan = you(court);
  return withCharacter(court, { ...lan, silver: Math.max(0, lan.silver + amount) });
}

export function helperSetTalent(court: CourtState, talent: LadyTalent, value: number): CourtState {
  const lan = you(court);
  return withCharacter(court, { ...lan, talents: { ...lan.talents, [talent]: clampStat(Math.round(value)) } });
}

export function helperFallIll(court: CourtState, days: number): CourtState {
  return withCharacter(court, { ...you(court), illThroughDay: court.day + days - 1, energy: 0 });
}

export function helperSendToColdPalace(court: CourtState, days: number): CourtState {
  return withCharacter(court, { ...you(court), exiledThroughDay: court.day + days - 1 });
}

export function helperLowerChildbearing(court: CourtState, points: number): CourtState {
  const lan = you(court);
  return withCharacter(court, { ...lan, childbearing: clampStat(lan.childbearing - points) });
}

/** Moves your score with one person, or with everyone, to a value, through the real rule so its side effects show. */
export function helperSetRelationship(court: CourtState, targetId: CharacterId | 'everyone', value: number): RuleResult {
  const targets = targetId === 'everyone' ? everyoneElse(court) : [targetId];
  let result: RuleResult = { state: court, events: [] };
  for (const id of targets) {
    const change = Math.round(value) - relationshipBetween(result.state, YOU, id);
    const next = changeRelationship(result.state, YOU, id, change, 'help');
    result = { state: next.state, events: [...result.events, ...next.events] };
  }
  return result;
}
