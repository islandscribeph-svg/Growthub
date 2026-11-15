/**
 * Item 5. Gifting: homemade gifts that roll on a talent, bought gifts with a fixed effect,
 * one counted gift per recipient per game day, and the half-value rule for higher ranks.
 * Sections 3 and 9 of GAME_LOGIC.md.
 */
import { ENERGY, GIFTING, GIFTS, GIFT_QUALITY } from '../balance';
import type { GiftBand } from '../events';
import type { Rng } from '../rng';
import { EMPRESS_DOWAGER_ID, type Character, type CharacterId, type CourtState, type GiftKind } from '../types';
import { andThen, getCharacter, isExiled, isRightPhase, rankNumber, rejected, withCharacter, type RuleResult } from './core';
import { spendSilver } from './money';
import { changeRelationship, hasRelationships } from './relationships';

export interface GiveGiftIntent {
  readonly type: 'give_gift';
  readonly actorId: CharacterId;
  readonly recipientId: CharacterId;
  readonly gift: GiftKind;
}

/** "A cooked dish or sewn item rolls its quality as the maker's talent plus a random number from -10 to +10." */
export function rollGiftQuality(talent: number, rng: Rng): number {
  return talent + rng.int(GIFT_QUALITY.rollMin, GIFT_QUALITY.rollMax);
}

export function giftBand(quality: number): GiftBand {
  if (quality >= GIFT_QUALITY.goodFrom) return 'good';
  if (quality >= GIFT_QUALITY.fairFrom) return 'fair';
  return 'bad';
}

/** The relationship effect of a homemade gift of this quality, rolled inside its band. */
export function rollHomemadeEffect(band: GiftBand, rng: Rng): number {
  switch (band) {
    case 'good':
      return rng.int(GIFT_QUALITY.goodMin, GIFT_QUALITY.goodMax);
    case 'fair':
      return rng.int(GIFT_QUALITY.fairMin, GIFT_QUALITY.fairMax);
    case 'bad':
      return rng.int(GIFT_QUALITY.badMin, GIFT_QUALITY.badMax);
    default: {
      const unknown: never = band;
      throw new Error(`Unknown gift band: ${String(unknown)}`);
    }
  }
}

/**
 * Whether the recipient is ranked above the giver. Ranks are compared lady to lady and guard
 * to guard. The Empress Dowager stands above everyone.
 */
export function isRankedAbove(state: CourtState, recipientId: CharacterId, giver: Character): boolean {
  if (recipientId === EMPRESS_DOWAGER_ID) return true;
  const recipient = getCharacter(state, recipientId);
  return recipient !== null && recipient.path === giver.path && rankNumber(recipient) > rankNumber(giver);
}

/** "A gift to someone ranked above her is worth half unless it is jewelry or better." Rounded down. */
export function halvedForHigherRank(effect: number): number {
  return effect > 0 ? Math.floor(effect * GIFTING.higherRankMultiplier) : effect;
}

/** Giving a gift: socializing, so it costs the socializing energy, plus the price of the gift. */
export function giveGift(state: CourtState, intent: GiveGiftIntent, rng: Rng): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  if (intent.recipientId === actor.id) return rejected(state, intent.type, actor.id, 'cannot_target_self');
  if (!hasRelationships(state, intent.recipientId)) return rejected(state, intent.type, actor.id, 'unknown_recipient');
  if (!isRightPhase(state, 'give_gift')) return rejected(state, intent.type, actor.id, 'wrong_phase');
  if (isExiled(actor, state.day)) return rejected(state, intent.type, actor.id, 'in_cold_palace');

  const rule = GIFTS[intent.gift];
  if (rule.rolledOn !== null && actor.path !== 'lady') return rejected(state, intent.type, actor.id, 'not_a_lady');
  if (actor.energy < ENERGY.socializing) return rejected(state, intent.type, actor.id, 'not_enough_energy');
  if (actor.silver < rule.cost) return rejected(state, intent.type, actor.id, 'not_enough_silver');

  const alreadyGiven = actor.today.giftedTo.filter((id) => id === intent.recipientId).length;
  const counted = alreadyGiven < GIFTING.countedPerRecipientPerDay;

  let quality: number | null = null;
  let band: GiftBand | null = null;
  let effect = 0;
  if (counted) {
    if (rule.rolledOn !== null && actor.path === 'lady') {
      quality = rollGiftQuality(actor.talents[rule.rolledOn], rng);
      band = giftBand(quality);
      effect = rollHomemadeEffect(band, rng);
    } else {
      effect = rule.relationship ?? 0;
    }
  }
  const halved = counted && !rule.fullValueToHigherRanks && effect > 0 && isRankedAbove(state, intent.recipientId, actor);
  const relationshipChange = halved ? halvedForHigherRank(effect) : effect;

  const given = withCharacter(state, {
    ...actor,
    energy: actor.energy - ENERGY.socializing,
    today: { ...actor.today, giftedTo: [...actor.today.giftedTo, intent.recipientId] },
  });
  const paid = spendSilver(given, actor.id, rule.cost, {
    reason: 'gift',
    item: intent.gift,
    otherId: intent.recipientId,
    leavesTrail: false,
  });
  if (!paid) return rejected(state, intent.type, actor.id, 'not_enough_silver');

  const result: RuleResult = {
    state: paid,
    events: [
      {
        type: 'gift_given',
        giverId: actor.id,
        recipientId: intent.recipientId,
        gift: intent.gift,
        cost: rule.cost,
        quality,
        band,
        counted,
        halved,
        relationshipChange,
      },
    ],
  };
  return andThen(result, (current) => changeRelationship(current, actor.id, intent.recipientId, relationshipChange, 'gift'));
}
