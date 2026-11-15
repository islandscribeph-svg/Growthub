/**
 * Item 4. Money: stipends, the shop, the bribe formula, tipping servants, giving silver, and
 * the ledger. Silver can never go below zero. Section 9 of GAME_LOGIC.md.
 */
import {
  BRIBE,
  CHILDBEARING_RESTORATION,
  ENERGY,
  GIFT_QUALITY,
  GUARD_STIPEND,
  HATED,
  SELLING,
  SELLING_WORK,
  SERVANT,
  SHOP_PRICE,
  STIPEND,
  TIP,
  TRANSFER,
} from '../balance';
import type { GameEvent } from '../events';
import type { Rng } from '../rng';
import type { Character, CharacterId, CourtState, LedgerEntry, SellableWork, ServantId, ShopItem } from '../types';
import {
  clamp,
  clampStat,
  getCharacter,
  isExiled,
  isIll,
  isRightPhase,
  rankNumber,
  rejected,
  withCharacter,
  withLedgerEntry,
  withServant,
  type RuleResult,
} from './core';
import { isHated } from './relationships';

type LedgerDetails = Pick<LedgerEntry, 'reason' | 'item' | 'otherId' | 'leavesTrail'>;

/**
 * Takes silver from a character and writes it in the ledger.
 * Returns null, changing nothing, when she does not have enough: silver never goes below zero.
 */
export function spendSilver(
  state: CourtState,
  characterId: CharacterId,
  amount: number,
  details: LedgerDetails,
): CourtState | null {
  const character = getCharacter(state, characterId);
  if (!character || amount < 0 || character.silver < amount) return null;
  const paid = withCharacter(state, { ...character, silver: character.silver - amount });
  return withLedgerEntry(paid, { characterId, direction: 'out', amount, ...details });
}

/** Gives silver to a character and writes it in the ledger. */
export function receiveSilver(
  state: CourtState,
  characterId: CharacterId,
  amount: number,
  details: LedgerDetails,
): CourtState {
  const character = getCharacter(state, characterId);
  if (!character || amount <= 0) return state;
  const paid = withCharacter(state, { ...character, silver: character.silver + amount });
  return withLedgerEntry(paid, { characterId, direction: 'in', amount, ...details });
}

/** The stipend a character is due this Morning. None in the Cold Palace or at the frontier. */
export function stipendFor(character: Character, day: number): number {
  if (isExiled(character, day)) return 0;
  return character.path === 'lady' ? STIPEND[character.rank] : GUARD_STIPEND[character.rank];
}

/** "The stipend arrives each Morning", scaled by rank. */
export function payStipends(state: CourtState): RuleResult {
  const events: GameEvent[] = [];
  let next = state;
  for (const character of Object.values(state.characters)) {
    const amount = stipendFor(character, state.day);
    if (amount <= 0) continue;
    next = receiveSilver(next, character.id, amount, { reason: 'stipend', item: null, otherId: null, leavesTrail: false });
    events.push({ type: 'stipend_paid', characterId: character.id, amount });
  }
  return { state: next, events };
}

export interface BribeCostInput {
  readonly servantLoyalty: number;
  /** The rank number of the servant's mistress, the target of the bribe. */
  readonly targetRankNumber: number;
  readonly targetHated: boolean;
}

/**
 * bribe cost = servant Loyalty x target's rank number / 2, minimum 10 taels.
 * Halved when the target is hated. Rounded down to whole taels, and the minimum applies last.
 */
export function bribeCost(input: BribeCostInput): number {
  const full = (input.servantLoyalty * input.targetRankNumber) / BRIBE.rankDivisor;
  const cost = input.targetHated ? full * HATED.bribeCostMultiplier : full;
  return Math.max(BRIBE.minimum, Math.floor(cost));
}

/** The bribe cost of a servant in the court, from her Loyalty and her mistress's rank. Null for palace staff. */
export function bribeCostFor(state: CourtState, servantId: ServantId): number | null {
  const servant = state.servants[servantId];
  const mistress = servant?.servesId ? getCharacter(state, servant.servesId) : null;
  if (!servant || !mistress) return null;
  return bribeCost({
    servantLoyalty: servant.loyalty,
    targetRankNumber: rankNumber(mistress),
    targetHated: isHated(state, mistress.id),
  });
}

/** "A servant with Loyalty above 80 refuses and reports the attempt to her mistress." */
export function servantRefusesBribe(loyalty: number): boolean {
  return loyalty > SERVANT.refusesBribeAbove;
}

/** "Paying double the bribe cost removes that risk" of the servant confessing at trial. */
export function silencedBribeCost(cost: number): number {
  return cost * BRIBE.silenceMultiplier;
}

/** What her own sewing or drawing sells for: "quality divided by 5, in taels", rounded down. */
export function saleValue(quality: number): number {
  return Math.max(0, Math.floor(quality / SELLING.qualityPerTael));
}

export interface BuyIntent {
  readonly type: 'buy';
  readonly actorId: CharacterId;
  readonly item: ShopItem;
}

/** Buying from the "other costs" table. Every purchase is logged; poison ingredients leave a trail. */
export function buy(state: CourtState, intent: BuyIntent): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  const cost = SHOP_PRICE[intent.item];
  const events: GameEvent[] = [{ type: 'purchased', characterId: actor.id, item: intent.item, cost }];
  let bought: Character;
  let leavesTrail = false;

  switch (intent.item) {
    case 'poison_ingredients':
      bought = { ...actor, inventory: { ...actor.inventory, poisonIngredients: actor.inventory.poisonIngredients + 1 } };
      leavesTrail = true;
      break;
    case 'fertility_poison_ingredients':
      bought = {
        ...actor,
        inventory: { ...actor.inventory, fertilityPoisonIngredients: actor.inventory.fertilityPoisonIngredients + 1 },
      };
      leavesTrail = true;
      break;
    case 'physician_cure':
      if (!isIll(actor, state.day)) return rejected(state, intent.type, actor.id, 'not_ill');
      bought = { ...actor, illThroughDay: null };
      events.push({ type: 'illness_cured', characterId: actor.id });
      break;
    case 'childbearing_restoration': {
      if (actor.path !== 'lady') return rejected(state, intent.type, actor.id, 'not_a_lady');
      const restored = clampStat(actor.childbearing + CHILDBEARING_RESTORATION.points);
      if (restored === actor.childbearing) return rejected(state, intent.type, actor.id, 'childbearing_already_full');
      bought = { ...actor, childbearing: restored };
      events.push({ type: 'childbearing_restored', characterId: actor.id, from: actor.childbearing, to: restored });
      break;
    }
    case 'premium_cosmetics':
      if (actor.path !== 'lady') return rejected(state, intent.type, actor.id, 'not_a_lady');
      if (actor.today.premiumCosmetics) return rejected(state, intent.type, actor.id, 'already_bought_today');
      bought = { ...actor, today: { ...actor.today, premiumCosmetics: true } };
      break;
    default: {
      const unknown: never = intent.item;
      throw new Error(`Unknown shop item: ${String(unknown)}`);
    }
  }

  const paid = spendSilver(withCharacter(state, bought), actor.id, cost, {
    reason: 'purchase',
    item: intent.item,
    otherId: null,
    leavesTrail,
  });
  if (!paid) return rejected(state, intent.type, actor.id, 'not_enough_silver');
  return { state: paid, events };
}

export interface TipServantIntent {
  readonly type: 'tip_servant';
  readonly actorId: CharacterId;
  readonly servantId: ServantId;
}

/** "A lady can tip her own servants: 5 taels adds 2 Loyalty, up to 6 Loyalty per game day." */
export function tipServant(state: CourtState, intent: TipServantIntent): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  const servant = state.servants[intent.servantId];
  if (!servant) return rejected(state, intent.type, actor.id, 'unknown_servant');
  if (servant.servesId !== actor.id) return rejected(state, intent.type, actor.id, 'not_her_servant');
  if (servant.loyalty >= SERVANT.loyaltyMax) return rejected(state, intent.type, actor.id, 'loyalty_already_full');
  const leftToday = TIP.maxLoyaltyPerDay - servant.loyaltyFromTipsToday;
  if (leftToday <= 0) return rejected(state, intent.type, actor.id, 'tip_limit_reached');

  const paid = spendSilver(state, actor.id, TIP.cost, { reason: 'tip', item: null, otherId: servant.id, leavesTrail: false });
  if (!paid) return rejected(state, intent.type, actor.id, 'not_enough_silver');

  const loyalty = clamp(servant.loyalty + Math.min(TIP.loyaltyGain, leftToday), SERVANT.loyaltyMin, SERVANT.loyaltyMax);
  const tipped = {
    ...servant,
    loyalty,
    loyaltyFromTipsToday: servant.loyaltyFromTipsToday + (loyalty - servant.loyalty),
  };
  return {
    state: withServant(paid, tipped),
    events: [
      { type: 'servant_tipped', characterId: actor.id, servantId: servant.id, cost: TIP.cost },
      { type: 'servant_loyalty_changed', servantId: servant.id, from: servant.loyalty, to: loyalty, cause: 'tip' },
    ],
  };
}

export interface GiveSilverIntent {
  readonly type: 'give_silver';
  readonly actorId: CharacterId;
  readonly recipientId: CharacterId;
  readonly amount: number;
}

/**
 * Silver given by one character to another, including a mistress's allowance to a resident.
 * Between two players it is capped per game day, both in what one may send and in what one may receive.
 */
export function giveSilver(state: CourtState, intent: GiveSilverIntent): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  if (intent.recipientId === actor.id) return rejected(state, intent.type, actor.id, 'cannot_target_self');
  const recipient = getCharacter(state, intent.recipientId);
  if (!recipient) return rejected(state, intent.type, actor.id, 'unknown_recipient');
  if (!Number.isInteger(intent.amount) || intent.amount <= 0) return rejected(state, intent.type, actor.id, 'invalid_amount');
  if (actor.silver < intent.amount) return rejected(state, intent.type, actor.id, 'not_enough_silver');

  const betweenPlayers = actor.controller.kind === 'player' && recipient.controller.kind === 'player';
  if (betweenPlayers) {
    const sent = actor.today.silverSentToPlayers + intent.amount;
    const received = recipient.today.silverReceivedFromPlayers + intent.amount;
    if (sent > TRANSFER.playerToPlayerCapPerDay || received > TRANSFER.playerToPlayerCapPerDay) {
      return rejected(state, intent.type, actor.id, 'transfer_cap_reached');
    }
  }

  const details = { reason: 'transfer', item: null, leavesTrail: false } as const;
  const taken = spendSilver(state, actor.id, intent.amount, { ...details, otherId: recipient.id });
  if (!taken) return rejected(state, intent.type, actor.id, 'not_enough_silver');
  let next = receiveSilver(taken, recipient.id, intent.amount, { ...details, otherId: actor.id });
  if (betweenPlayers) {
    const sender = next.characters[actor.id];
    const receiver = next.characters[recipient.id];
    if (sender && receiver) {
      next = withCharacter(next, {
        ...sender,
        today: { ...sender.today, silverSentToPlayers: sender.today.silverSentToPlayers + intent.amount },
      });
      next = withCharacter(next, {
        ...receiver,
        today: { ...receiver.today, silverReceivedFromPlayers: receiver.today.silverReceivedFromPlayers + intent.amount },
      });
    }
  }
  return {
    state: next,
    events: [{ type: 'silver_given', fromId: actor.id, toId: recipient.id, amount: intent.amount }],
  };
}

export interface SellWorkIntent {
  readonly type: 'sell_work';
  readonly actorId: CharacterId;
  readonly work: SellableWork;
}

/**
 * "Selling her own sewing or drawings through a eunuch: quality divided by 5, in taels."
 * She makes one piece, which costs the energy of a training action, and its quality is rolled
 * like a homemade gift. The eunuch takes a limited number of pieces a day.
 */
export function sellWork(state: CourtState, intent: SellWorkIntent, rng: Rng): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  if (actor.path !== 'lady') return rejected(state, intent.type, actor.id, 'not_a_lady');
  if (!isRightPhase(state, 'sell_work')) return rejected(state, intent.type, actor.id, 'wrong_phase');
  if (isExiled(actor, state.day)) return rejected(state, intent.type, actor.id, 'in_cold_palace');
  if (actor.today.workSold >= SELLING_WORK.salesPerDay) return rejected(state, intent.type, actor.id, 'already_sold_today');
  if (actor.energy < ENERGY.training) return rejected(state, intent.type, actor.id, 'not_enough_energy');

  const talent = actor.talents[SELLING_WORK.talent[intent.work]];
  const quality = talent + rng.int(GIFT_QUALITY.rollMin, GIFT_QUALITY.rollMax);
  const price = saleValue(quality);
  const made = withCharacter(state, {
    ...actor,
    energy: actor.energy - ENERGY.training,
    today: { ...actor.today, workSold: actor.today.workSold + 1 },
  });
  const sold = receiveSilver(made, actor.id, price, { reason: 'sale', item: intent.work, otherId: null, leavesTrail: false });
  return { state: sold, events: [{ type: 'work_sold', characterId: actor.id, work: intent.work, quality, price }] };
}
