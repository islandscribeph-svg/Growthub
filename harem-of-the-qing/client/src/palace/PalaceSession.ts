/**
 * One sitting in the playable palace: the court, the dice, and the history of what happened.
 *
 * This stands where the server will stand. The page only ever hands it intents (`send`), and it
 * answers with what the rules decided. It runs the rules from /shared in the browser because
 * there is no server yet; when there is one, this class is what gets replaced.
 */
import { createRng, type Rng } from '../../../shared/rng';
import { act, type CourtIntent } from '../../../shared/rules/act';
import { advancePhase } from '../../../shared/rules/clock';
import { andThen, type RuleResult } from '../../../shared/rules/core';
import { stirCourt } from '../../../shared/rules/places';
import { npcsPayRespects } from '../../../shared/rules/relationships';
import type { CharacterId, CourtState, PlaceId } from '../../../shared/types';
import { helperAddSilver } from '../sandbox/demoCourt';
import { describeEvents, nameOf, type LogLine } from '../sandbox/describe';
import { PHASE_NAME } from '../sandbox/labels';
import { HELPER_SILVER, type LogEntry } from '../sandbox/session';
import { YOU, createPalaceCourt } from './palaceCourt';

type Listener = (entry: LogEntry) => void;

const INTENT_TITLE: Readonly<Record<CourtIntent['type'], string>> = {
  enter_place: 'You walk on',
  pay_respects: 'Morning respects',
  greet: 'A greeting',
  give_gift: 'A gift',
  give_silver: 'Silver changes hands',
  train: 'Practice',
  doll_up: 'At the dressing table',
  sell_work: 'Work to sell',
  buy: 'An errand',
  tip_servant: 'A tip',
};

export class PalaceSession {
  court: CourtState;
  readonly seed: string;
  readonly log: LogEntry[] = [];
  /** The spot regular she has asked, and where. Forgotten when she leaves the room. */
  private asked: { readonly placeId: PlaceId; readonly regularId: CharacterId } | null = null;
  private readonly rng: Rng;
  private readonly listeners: Listener[] = [];

  constructor(seed: string) {
    this.seed = seed;
    this.rng = createRng(seed);
    // The court opens in its first Morning: everyone is in their place and the NPC ladies have bowed.
    const opened = andThen(stirCourt(createPalaceCourt(), this.rng), npcsPayRespects);
    this.court = opened.state;
  }

  onChange(listener: Listener): void {
    this.listeners.push(listener);
  }

  get placeId(): PlaceId | null {
    return this.court.whereabouts[YOU] ?? null;
  }

  /** Hands one intent to the rules and reports what they decided. */
  send(intent: CourtIntent): LogEntry {
    const entry = this.record(INTENT_TITLE[intent.type], act(this.court, intent, this.rng));
    if (this.asked && this.asked.placeId !== this.placeId) this.asked = null;
    return entry;
  }

  /** Moves the clock on. Everyone goes where the new phase finds them, and NPC ladies bow each Morning. */
  nextPhase(): LogEntry {
    let result = andThen(advancePhase(this.court), (court) => stirCourt(court, this.rng));
    if (result.state.phase === 'morning') result = andThen(result, npcsPayRespects);
    return this.record('The clock moves on', result);
  }

  /** A little time passes within the phase: the NPCs and servants move about. */
  stir(): LogEntry {
    return this.record('A little time passes', stirCourt(this.court, this.rng));
  }

  hasAsked(regularId: CharacterId): boolean {
    return this.asked !== null && this.asked.placeId === this.placeId && this.asked.regularId === regularId;
  }

  /** Asking the regular before using her spot. Free; it is remembered until she leaves the room. */
  askRegular(regularId: CharacterId): LogEntry {
    const placeId = this.placeId;
    if (placeId !== null) this.asked = { placeId, regularId };
    const name = nameOf(this.court, regularId);
    const line: LogLine = {
      text: `You asked ${name} if you might practise here. She nods.`,
      tone: 'good',
      about: [YOU, regularId],
    };
    return this.push('Asking first', [line], false);
  }

  helperAddSilver(): LogEntry {
    this.court = helperAddSilver(this.court, HELPER_SILVER);
    return this.push(`Test helper: ${HELPER_SILVER} taels added`, [], true);
  }

  private record(title: string, result: RuleResult): LogEntry {
    const stamp = this.stamp();
    this.court = result.state;
    return this.push(title, describeEvents(result.events, result.state), false, stamp);
  }

  private stamp(): string {
    return `Day ${this.court.day} · ${PHASE_NAME[this.court.phase]}`;
  }

  private push(title: string, lines: readonly LogLine[], helper: boolean, stamp = this.stamp()): LogEntry {
    const entry: LogEntry = { number: this.log.length + 1, stamp, title, lines, helper };
    // Walking from room to room usually has nothing to report, and would bury the history.
    if (lines.length > 0 || helper) this.log.push(entry);
    for (const listener of this.listeners) listener(entry);
    return entry;
  }
}
