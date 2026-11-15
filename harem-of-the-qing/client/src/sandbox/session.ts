/**
 * One sandbox sitting: the court, the dice, and the history of what happened.
 *
 * This is a test bench. It runs the rules from /shared straight in the browser so they can be
 * tried without a server. The real game will not work this way: there the client only sends
 * intents and the server runs these same rules.
 */
import { POISON, TRIAL } from '../../../shared/balance';
import type { GameEvent } from '../../../shared/events';
import { createRng, type Rng } from '../../../shared/rng';
import { advancePhase } from '../../../shared/rules/clock';
import { andThen, type RuleResult } from '../../../shared/rules/core';
import { giveGift } from '../../../shared/rules/gifting';
import { buy, giveSilver, sellWork, tipServant } from '../../../shared/rules/money';
import { greet, npcsPayRespects, payRespects } from '../../../shared/rules/relationships';
import { dollUp, train } from '../../../shared/rules/training';
import type {
  ActivitySpot,
  CharacterId,
  CourtState,
  GiftKind,
  LadyTalent,
  SellableWork,
  ShopItem,
} from '../../../shared/types';
import {
  MAID_ID,
  REGULAR_ID,
  YOU,
  createDemoCourt,
  helperAddSilver,
  helperFallIll,
  helperLowerChildbearing,
  helperSendToColdPalace,
  helperSetRelationship,
  helperSetTalent,
} from './demoCourt';
import { describeEvents, type LogLine } from './describe';
import { CAUSE_TEXT, PHASE_NAME } from './labels';

export interface LogEntry {
  readonly number: number;
  readonly stamp: string;
  readonly title: string;
  readonly lines: readonly LogLine[];
  /** True for a test helper, which is not a game action. */
  readonly helper: boolean;
}

export const HELPER_SILVER = 50;

export class SandboxSession {
  court: CourtState;
  readonly seed: string;
  readonly log: LogEntry[] = [];
  private readonly rng: Rng;

  constructor(seed: string) {
    this.seed = seed;
    this.rng = createRng(seed);
    // The court opens in its first Morning, so the NPC ladies have already paid their respects.
    this.court = npcsPayRespects(createDemoCourt()).state;
  }

  get latest(): LogEntry | null {
    return this.log[this.log.length - 1] ?? null;
  }

  payRespects(): LogEntry {
    return this.apply('Pay Morning respects', payRespects(this.court, { type: 'pay_respects', actorId: YOU }));
  }

  train(spot: ActivitySpot, talent: LadyTalent | undefined, regularPresent: boolean, askedFirst: boolean): LogEntry {
    return this.apply(
      'Train',
      train(this.court, {
        type: 'train',
        actorId: YOU,
        spot,
        talent,
        regularPresentId: regularPresent ? REGULAR_ID : null,
        askedFirst,
      }),
    );
  }

  dollUp(inOwnRoom: boolean): LogEntry {
    return this.apply('Doll up', dollUp(this.court, { type: 'doll_up', actorId: YOU, inOwnRoom }));
  }

  greet(targetId: CharacterId): LogEntry {
    return this.apply('Greet', greet(this.court, { type: 'greet', actorId: YOU, targetId }));
  }

  giveGift(recipientId: CharacterId, gift: GiftKind): LogEntry {
    return this.apply('Give a gift', giveGift(this.court, { type: 'give_gift', actorId: YOU, recipientId, gift }, this.rng));
  }

  sellWork(work: SellableWork): LogEntry {
    return this.apply('Sell your work', sellWork(this.court, { type: 'sell_work', actorId: YOU, work }, this.rng));
  }

  buy(item: ShopItem): LogEntry {
    return this.apply('Buy', buy(this.court, { type: 'buy', actorId: YOU, item }));
  }

  tipMaid(): LogEntry {
    return this.apply('Tip your maid', tipServant(this.court, { type: 'tip_servant', actorId: YOU, servantId: MAID_ID }));
  }

  giveSilver(recipientId: CharacterId, amount: number): LogEntry {
    return this.apply('Give silver', giveSilver(this.court, { type: 'give_silver', actorId: YOU, recipientId, amount }));
  }

  /** Moves the clock on. Each Morning the NPC ladies pay their respects, as their routine says. */
  nextPhase(): LogEntry {
    let result = advancePhase(this.court);
    if (result.state.phase === 'morning') result = andThen(result, npcsPayRespects);
    return this.apply('The clock moves on', result);
  }

  helperAddSilver(): LogEntry {
    return this.applyHelper(`Test helper: ${HELPER_SILVER} taels added`, helperAddSilver(this.court, HELPER_SILVER));
  }

  helperSetTalent(talent: LadyTalent, value: number): LogEntry {
    return this.applyHelper('Test helper: talent set', helperSetTalent(this.court, talent, value));
  }

  helperFallIll(): LogEntry {
    return this.applyHelper(
      `Test helper: ill for ${POISON.illnessDays} game days`,
      helperFallIll(this.court, POISON.illnessDays),
    );
  }

  helperSendToColdPalace(): LogEntry {
    return this.applyHelper(
      `Test helper: sent to the Cold Palace for ${TRIAL.accusedColdPalaceDays} game days`,
      helperSendToColdPalace(this.court, TRIAL.accusedColdPalaceDays),
    );
  }

  helperLowerChildbearing(): LogEntry {
    return this.applyHelper(
      `Test helper: Childbearing lowered by ${POISON.fertilityLossMin}`,
      helperLowerChildbearing(this.court, POISON.fertilityLossMin),
    );
  }

  helperSetRelationship(targetId: CharacterId | 'everyone', value: number): LogEntry {
    const result = helperSetRelationship(this.court, targetId, value);
    const entry = this.record('Test helper: relationship set', result.state, result.events, true);
    // The helper borrows a real cause to move the score; the log should not claim it happened.
    const lines = entry.lines.map((line) => ({ ...line, text: line.text.replace(` (${CAUSE_TEXT.help})`, ' (test helper)') }));
    const relabelled = { ...entry, lines };
    this.log[this.log.length - 1] = relabelled;
    return relabelled;
  }

  private apply(title: string, result: RuleResult): LogEntry {
    return this.record(title, result.state, result.events, false);
  }

  private applyHelper(title: string, court: CourtState): LogEntry {
    return this.record(title, court, [], true);
  }

  private record(title: string, court: CourtState, events: readonly GameEvent[], helper: boolean): LogEntry {
    const stamp = `Day ${this.court.day} · ${PHASE_NAME[this.court.phase]}`;
    this.court = court;
    const entry: LogEntry = {
      number: this.log.length + 1,
      stamp,
      title,
      lines: describeEvents(events, court),
      helper,
    };
    this.log.push(entry);
    return entry;
  }
}
