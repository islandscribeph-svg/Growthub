/**
 * Item 1. The clock: a 2-hour game day in four phases, and the energy every character gets
 * each day. Section 1 of GAME_LOGIC.md.
 */
import { CLOCK, ENERGY, HOURS_PER_REAL_DAY, MS_PER_HOUR } from '../balance';
import type { GameEvent } from '../events';
import { PHASES, type Character, type CourtState, type Phase } from '../types';
import { andThen, isIll, newDailyRecord, type RuleResult } from './core';

/** The phase that follows this one. Night is followed by the next Morning. */
export function nextPhase(phase: Phase): Phase {
  switch (phase) {
    case 'morning':
      return 'day';
    case 'day':
      return 'evening';
    case 'evening':
      return 'night';
    case 'night':
      return 'morning';
    default: {
      const unknown: never = phase;
      throw new Error(`Unknown phase: ${String(unknown)}`);
    }
  }
}

/**
 * Moves the court to its next phase.
 * - Entering Night: unspent energy is lost.
 * - Entering Morning: a new game day starts, yesterday's daily records are wiped and energy is restored.
 */
export function advancePhase(state: CourtState): RuleResult {
  const phase = nextPhase(state.phase);
  const day = phase === 'morning' ? state.day + 1 : state.day;
  const moved: RuleResult = {
    state: { ...state, day, phase },
    events: [{ type: 'phase_changed', day, phase }],
  };
  switch (phase) {
    case 'morning':
      return andThen(moved, startDay);
    case 'night':
      return andThen(moved, loseUnspentEnergy);
    case 'day':
    case 'evening':
      return moved;
    default: {
      const unknown: never = phase;
      throw new Error(`Unknown phase: ${String(unknown)}`);
    }
  }
}

/** The energy a character wakes up with. An ill character has none. */
export function morningEnergy(character: Character, day: number): number {
  return isIll(character, day) ? 0 : ENERGY.perDay;
}

function startDay(state: CourtState): RuleResult {
  const events: GameEvent[] = [{ type: 'day_started', day: state.day }];
  const characters: Record<string, Character> = {};
  for (const character of Object.values(state.characters)) {
    const energy = morningEnergy(character, state.day);
    characters[character.id] = { ...character, energy, today: newDailyRecord() };
    events.push({ type: 'energy_restored', characterId: character.id, energy });
  }
  const servants = Object.fromEntries(
    Object.values(state.servants).map((servant) => [servant.id, { ...servant, loyaltyFromTipsToday: 0 }]),
  );
  const children = Object.fromEntries(
    Object.values(state.children).map((child) => [child.id, { ...child, visitedToday: false }]),
  );
  return { state: { ...state, characters, servants, children }, events };
}

function loseUnspentEnergy(state: CourtState): RuleResult {
  const events: GameEvent[] = [];
  const characters: Record<string, Character> = {};
  for (const character of Object.values(state.characters)) {
    if (character.energy > 0) {
      events.push({ type: 'energy_lost', characterId: character.id, amount: character.energy });
    }
    characters[character.id] = { ...character, energy: 0 };
  }
  return { state: { ...state, characters }, events };
}

/** How long one game day lasts in real time, in milliseconds. */
export function gameDayMs(): number {
  return CLOCK.gameDayRealHours * MS_PER_HOUR;
}

/** How long one phase lasts in real time. The four phases share the game day equally. */
export function phaseMs(): number {
  return gameDayMs() / PHASES.length;
}

export function gameDaysPerRealDay(): number {
  return HOURS_PER_REAL_DAY / CLOCK.gameDayRealHours;
}

export interface ClockReading {
  /** The game day, counted from 1. */
  readonly day: number;
  readonly phase: Phase;
  readonly msUntilNextPhase: number;
}

/** Where the clock stands a given real time after the court's first Morning began. */
export function clockAt(elapsedMs: number): ClockReading {
  const elapsed = Math.max(0, elapsedMs);
  const intoDay = elapsed % gameDayMs();
  const phaseIndex = Math.min(PHASES.length - 1, Math.floor(intoDay / phaseMs()));
  const phase = PHASES[phaseIndex] ?? PHASES[0];
  return {
    day: Math.floor(elapsed / gameDayMs()) + 1,
    phase,
    msUntilNextPhase: (phaseIndex + 1) * phaseMs() - intoDay,
  };
}
