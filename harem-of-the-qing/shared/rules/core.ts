/** Small building blocks every rule shares. */
import { ACTION_PHASE, STAT } from '../balance';
import type { GameEvent, RejectionReason } from '../events';
import {
  GUARD_RANKS,
  LADY_RANKS,
  type Character,
  type CharacterId,
  type CourtState,
  type DailyRecord,
  type Lady,
  type LedgerEntry,
  type Servant,
} from '../types';

/** What every rule returns: the new state, and what happened. The state given in is never changed. */
export interface RuleResult {
  readonly state: CourtState;
  readonly events: readonly GameEvent[];
}

export function unchanged(state: CourtState): RuleResult {
  return { state, events: [] };
}

/** Refuses an action: the state comes back as it was, with one event saying why. */
export function rejected(
  state: CourtState,
  intent: string,
  actorId: CharacterId | null,
  reason: RejectionReason,
): RuleResult {
  return { state, events: [{ type: 'rejected', intent, actorId, reason }] };
}

export function wasRejected(result: RuleResult): boolean {
  return result.events.some((event) => event.type === 'rejected');
}

/** Runs the next step on the result so far and keeps the events of both. */
export function andThen(result: RuleResult, step: (state: CourtState) => RuleResult): RuleResult {
  const next = step(result.state);
  return { state: next.state, events: [...result.events, ...next.events] };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Keeps a stat inside the range all stats run in. */
export function clampStat(value: number): number {
  return clamp(value, STAT.min, STAT.max);
}

export function getCharacter(state: CourtState, id: CharacterId): Character | null {
  return state.characters[id] ?? null;
}

export function getLady(state: CourtState, id: CharacterId): Lady | null {
  const character = getCharacter(state, id);
  return character?.path === 'lady' ? character : null;
}

export function allLadies(state: CourtState): Lady[] {
  return Object.values(state.characters).filter((character): character is Lady => character.path === 'lady');
}

export function withCharacter(state: CourtState, character: Character): CourtState {
  return { ...state, characters: { ...state.characters, [character.id]: character } };
}

export function withServant(state: CourtState, servant: Servant): CourtState {
  return { ...state, servants: { ...state.servants, [servant.id]: servant } };
}

export function withLedgerEntry(state: CourtState, entry: Omit<LedgerEntry, 'day' | 'phase'>): CourtState {
  return { ...state, ledger: [...state.ledger, { day: state.day, phase: state.phase, ...entry }] };
}

/** A character's rank number: 1 to 8 for a lady, 1 to 6 for a guard. */
export function rankNumber(character: Character): number {
  return character.path === 'lady'
    ? LADY_RANKS.indexOf(character.rank) + 1
    : GUARD_RANKS.indexOf(character.rank) + 1;
}

/** In the Cold Palace (a lady) or posted to the frontier (a guard) on this game day. */
export function isExiled(character: Character, day: number): boolean {
  return character.exiledThroughDay !== null && day <= character.exiledThroughDay;
}

export function isIll(character: Character, day: number): boolean {
  return character.illThroughDay !== null && day <= character.illThroughDay;
}

/** Whether the court is in the phase this action belongs to. */
export function isRightPhase(state: CourtState, action: keyof typeof ACTION_PHASE): boolean {
  return state.phase === ACTION_PHASE[action];
}

/** A clean slate for a new game day. */
export function newDailyRecord(): DailyRecord {
  return {
    paidRespects: false,
    dollUpBonus: 0,
    premiumCosmetics: false,
    giftedTo: [],
    greeted: [],
    workSold: 0,
    silverSentToPlayers: 0,
    silverReceivedFromPlayers: 0,
    walkedInOn: [],
  };
}

/** The key a pair's relationship is stored under. The order of the two ids does not matter. */
export function pairKey(a: CharacterId, b: CharacterId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
