/**
 * Item 2. Training and stats: the activity spots, talent gains that shrink as the talent
 * rises, and dolling up. Section 3 of GAME_LOGIC.md.
 */
import {
  ACTIVITY_SPOT_RULES,
  DOLL_UP,
  ENERGY,
  SPOT_ATTRIBUTE_GAIN,
  STAT,
  STEPPING_ON_TOES,
  TRAINING,
} from '../balance';
import type { ActivitySpot, Character, CharacterId, CourtState, Lady, LadyTalent } from '../types';
import {
  andThen,
  clampStat,
  getCharacter,
  isExiled,
  isRightPhase,
  rejected,
  unchanged,
  withCharacter,
  type RuleResult,
} from './core';
import { changeRelationship, relationshipBetween } from './relationships';

export interface TrainIntent {
  readonly type: 'train';
  readonly actorId: CharacterId;
  readonly spot: ActivitySpot;
  /** Which talent to train. Only needed at a spot that trains two, such as the study. */
  readonly talent?: LadyTalent;
  /**
   * Filled in by the server, which knows who is standing where: the spot's regular, when she
   * is present. Null or left out when the regular is away or the spot has none.
   */
  readonly regularPresentId?: CharacterId | null;
  /** True when she asked the regular before using the spot. */
  readonly askedFirst?: boolean;
}

export interface DollUpIntent {
  readonly type: 'doll_up';
  readonly actorId: CharacterId;
  /** Filled in by the server, which knows where she is standing. */
  readonly inOwnRoom: boolean;
}

/**
 * How many points one training action adds to a talent that currently stands at `talent`.
 *
 * The doc says "1 to 3 points", that "gains shrink as the talent rises", and that "the last 20
 * points are slow". This reads those together as even steps: the largest gain at the bottom,
 * stepping down in equal bands, and the smallest gain for the slow last points.
 */
export function trainingGain(talent: number): number {
  const steps = TRAINING.maxGain - TRAINING.minGain;
  const slowFrom = STAT.max - TRAINING.slowLastPoints;
  if (steps <= 0 || talent >= slowFrom) return TRAINING.minGain;
  const bandWidth = (slowFrom - STAT.min) / steps;
  const stepsDown = Math.floor((Math.max(talent, STAT.min) - STAT.min) / bandWidth);
  return Math.max(TRAINING.minGain, TRAINING.maxGain - stepsDown);
}

/** One training action at an activity spot: costs energy, raises a talent and perhaps an attribute. */
export function train(state: CourtState, intent: TrainIntent): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  if (actor.path !== 'lady') return rejected(state, intent.type, intent.actorId, 'not_a_lady');
  if (!isRightPhase(state, 'train')) return rejected(state, intent.type, actor.id, 'wrong_phase');
  if (isExiled(actor, state.day)) return rejected(state, intent.type, actor.id, 'in_cold_palace');

  const rule = ACTIVITY_SPOT_RULES[intent.spot];
  const [onlyTalent] = rule.talents;
  const talent = intent.talent ?? (rule.talents.length === 1 ? onlyTalent : undefined) ?? null;
  if (talent !== null && !rule.talents.includes(talent)) {
    return rejected(state, intent.type, actor.id, 'spot_does_not_train_that_talent');
  }
  if (talent === null && rule.talents.length > 0) {
    return rejected(state, intent.type, actor.id, 'talent_not_chosen');
  }
  if (actor.energy < ENERGY.training) return rejected(state, intent.type, actor.id, 'not_enough_energy');

  let trained: Lady = { ...actor, energy: actor.energy - ENERGY.training };
  let talentGain = 0;
  if (talent !== null) {
    const before = actor.talents[talent];
    const after = clampStat(before + trainingGain(before));
    talentGain = after - before;
    trained = { ...trained, talents: { ...trained.talents, [talent]: after } };
  }
  let attributeGain = 0;
  if (rule.alsoRaises !== null) {
    const before = actor[rule.alsoRaises];
    const after = clampStat(before + SPOT_ATTRIBUTE_GAIN[rule.attributeGain]);
    attributeGain = after - before;
    trained = { ...trained, [rule.alsoRaises]: after };
  }

  const done: RuleResult = {
    state: withCharacter(state, trained),
    events: [
      {
        type: 'trained',
        characterId: actor.id,
        spot: intent.spot,
        talent,
        talentGain,
        attribute: rule.alsoRaises,
        attributeGain,
      },
    ],
  };
  return andThen(done, (current) => stepOnToes(current, intent));
}

/**
 * "Using it while she is present costs 2 relationship with her, unless the relationship is
 * already 50 or higher or the player asks first."
 */
function stepOnToes(state: CourtState, intent: TrainIntent): RuleResult {
  const regularId = intent.regularPresentId ?? null;
  if (regularId === null || regularId === intent.actorId || intent.askedFirst) return unchanged(state);
  if (!getCharacter(state, regularId)) return unchanged(state);
  if (relationshipBetween(state, intent.actorId, regularId) >= STEPPING_ON_TOES.safeFromRelationship) {
    return unchanged(state);
  }
  return changeRelationship(state, intent.actorId, regularId, -STEPPING_ON_TOES.relationshipLoss, 'used_her_activity_spot');
}

/** The Beauty bonus dolling up gives a lady with this much Makeup, before premium cosmetics. */
export function dollUpBonusFor(makeup: number): number {
  return Math.floor(makeup * DOLL_UP.makeupShare);
}

/** The Beauty bonus she has today: 0 unless she dolled up, doubled by premium cosmetics. */
export function dollUpBonusToday(lady: Lady): number {
  return lady.today.dollUpBonus * (lady.today.premiumCosmetics ? DOLL_UP.premiumCosmeticsMultiplier : 1);
}

/** Beauty as the court sees it today: her Beauty plus today's doll-up bonus, never above the top of the scale. */
export function effectiveBeauty(character: Character): number {
  const bonus = character.path === 'lady' ? dollUpBonusToday(character) : 0;
  return clampStat(character.beauty + bonus);
}

/** Dolling up in her own room: costs energy and gives a Beauty bonus that lasts for the game day. */
export function dollUp(state: CourtState, intent: DollUpIntent): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  if (actor.path !== 'lady') return rejected(state, intent.type, intent.actorId, 'not_a_lady');
  if (!isRightPhase(state, 'doll_up')) return rejected(state, intent.type, actor.id, 'wrong_phase');
  if (isExiled(actor, state.day)) return rejected(state, intent.type, actor.id, 'in_cold_palace');
  if (!intent.inOwnRoom) return rejected(state, intent.type, actor.id, 'not_in_own_room');
  if (actor.energy < DOLL_UP.energyCost) return rejected(state, intent.type, actor.id, 'not_enough_energy');

  const dolledUp: Lady = {
    ...actor,
    energy: actor.energy - DOLL_UP.energyCost,
    today: { ...actor.today, dollUpBonus: dollUpBonusFor(actor.talents.makeup) },
  };
  return {
    state: withCharacter(state, dolledUp),
    events: [{ type: 'dolled_up', characterId: actor.id, beautyBonus: dollUpBonusToday(dolledUp) }],
  };
}
