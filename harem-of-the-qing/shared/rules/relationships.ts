/**
 * Item 3. Relationships: one score from 0 to 100 for every pair, every change in the
 * section 5 table, friends, the hated state, and the averages for the status panel.
 * Section 5 of GAME_LOGIC.md.
 */
import { ENERGY, HATED, MISTRESS_MIN_RANK, RELATIONSHIP, RELATIONSHIP_CHANGE, SERVANT } from '../balance';
import type { GameEvent, RelationshipCause } from '../events';
import type { Rng } from '../rng';
import {
  EMPRESS_DOWAGER_ID,
  LADY_RANKS,
  type CharacterId,
  type CourtState,
  type Lady,
  type PalaceId,
} from '../types';
import {
  allLadies,
  andThen,
  clamp,
  getCharacter,
  getLady,
  isExiled,
  isRightPhase,
  pairKey,
  rejected,
  unchanged,
  withCharacter,
  withServant,
  type RuleResult,
} from './core';

/** Whether this id can have relationship scores: any lady or guard in the court, or the Empress Dowager. */
export function hasRelationships(state: CourtState, id: CharacterId): boolean {
  return id === EMPRESS_DOWAGER_ID || getCharacter(state, id) !== null;
}

/** The score between two characters. Two who have never dealt with each other are strangers. */
export function relationshipBetween(state: CourtState, a: CharacterId, b: CharacterId): number {
  return state.relationships[pairKey(a, b)]?.score ?? RELATIONSHIP.strangers;
}

export function areFriends(state: CourtState, a: CharacterId, b: CharacterId): boolean {
  return a !== b && relationshipBetween(state, a, b) >= RELATIONSHIP.friendsFrom;
}

/** Every lady and guard in the court who is this character's friend. */
export function friendsOf(state: CourtState, id: CharacterId): CharacterId[] {
  return Object.keys(state.characters).filter((otherId) => areFriends(state, id, otherId));
}

/** The average of one character's scores with a group. Null when the group is empty. */
export function averageRelationship(state: CourtState, id: CharacterId, others: readonly CharacterId[]): number | null {
  const group = others.filter((otherId) => otherId !== id);
  if (group.length === 0) return null;
  const total = group.reduce((sum, otherId) => sum + relationshipBetween(state, id, otherId), 0);
  return total / group.length;
}

/** A lady's average score with every other lady of the harem. Null when she is the only lady. */
export function haremAverage(state: CourtState, id: CharacterId): number | null {
  return averageRelationship(
    state,
    id,
    allLadies(state).map((lady) => lady.id),
  );
}

/** "If a lady's average score across the harem falls below 15, she is hated." */
export function isHated(state: CourtState, id: CharacterId): boolean {
  if (!getLady(state, id)) return false;
  const average = haremAverage(state, id);
  return average !== null && average < RELATIONSHIP.hatedBelow;
}

/** The lady with the rank of Empress, when there is one. */
export function findEmpress(state: CourtState): Lady | null {
  return allLadies(state).find((lady) => lady.rank === 'empress') ?? null;
}

/**
 * The mistress of a palace: its highest-ranked resident, who must be an Imperial Concubine
 * or above. A lady away in the Cold Palace is not in residence.
 */
export function palaceMistress(state: CourtState, palaceId: PalaceId): Lady | null {
  const minRank = LADY_RANKS.indexOf(MISTRESS_MIN_RANK);
  const candidates = allLadies(state).filter(
    (lady) => lady.palaceId === palaceId && LADY_RANKS.indexOf(lady.rank) >= minRank && !isExiled(lady, state.day),
  );
  candidates.sort(
    (a, b) =>
      LADY_RANKS.indexOf(b.rank) - LADY_RANKS.indexOf(a.rank) || b.favor - a.favor || (a.id < b.id ? -1 : 1),
  );
  return candidates[0] ?? null;
}

export interface StatusPanelRelationships {
  readonly empressDowager: number;
  /** Null when there is no Empress, or she is the Empress herself. */
  readonly empress: number | null;
  /** Null when her palace has no mistress, or she is the mistress herself. */
  readonly palaceMistress: number | null;
  /** The average with the other ladies of her own palace, leaving out the mistress, who has her own row. */
  readonly ownPalaceLadies: number | null;
  /** The average with the ladies of every other palace, leaving out the Empress, who has her own row. */
  readonly otherPalaces: number | null;
}

/** The grouped relationship rows of the status panel. The grouped rows are averages, rounded to whole numbers. */
export function statusPanelRelationships(state: CourtState, id: CharacterId): StatusPanelRelationships | null {
  const lady = getLady(state, id);
  if (!lady) return null;
  const empress = findEmpress(state);
  const mistress = palaceMistress(state, lady.palaceId);
  const others = allLadies(state).filter((other) => other.id !== id);
  const rounded = (average: number | null) => (average === null ? null : Math.round(average));
  return {
    empressDowager: relationshipBetween(state, id, EMPRESS_DOWAGER_ID),
    empress: empress && empress.id !== id ? relationshipBetween(state, id, empress.id) : null,
    palaceMistress: mistress && mistress.id !== id ? relationshipBetween(state, id, mistress.id) : null,
    ownPalaceLadies: rounded(
      averageRelationship(
        state,
        id,
        others.filter((other) => other.palaceId === lady.palaceId && other.id !== mistress?.id).map((other) => other.id),
      ),
    ),
    otherPalaces: rounded(
      averageRelationship(
        state,
        id,
        others.filter((other) => other.palaceId !== lady.palaceId && other.id !== empress?.id).map((other) => other.id),
      ),
    ),
  };
}

/**
 * Moves the score between two characters by `change` and reports everything that follows:
 * the score never leaves 0 to 100, friendships begin and end, and a lady becomes hated or
 * stops being hated.
 */
export function changeRelationship(
  state: CourtState,
  a: CharacterId,
  b: CharacterId,
  change: number,
  cause: RelationshipCause,
): RuleResult {
  if (a === b) return unchanged(state);
  if (!hasRelationships(state, a) || !hasRelationships(state, b)) {
    throw new Error(`No relationship score exists between "${a}" and "${b}".`);
  }
  const from = relationshipBetween(state, a, b);
  const to = clamp(from + change, RELATIONSHIP.min, RELATIONSHIP.max);
  if (to === from) return unchanged(state);

  const between: readonly [CharacterId, CharacterId] = a < b ? [a, b] : [b, a];
  const changed: CourtState = {
    ...state,
    relationships: { ...state.relationships, [pairKey(a, b)]: { between, score: to } },
  };
  const events: GameEvent[] = [{ type: 'relationship_changed', between, from, to, cause }];
  if (from < RELATIONSHIP.friendsFrom && to >= RELATIONSHIP.friendsFrom) {
    events.push({ type: 'became_friends', between });
  }
  if (from >= RELATIONSHIP.friendsFrom && to < RELATIONSHIP.friendsFrom) {
    events.push({ type: 'friendship_ended', between });
  }

  let result: RuleResult = { state: changed, events };
  for (const id of between) {
    const wasHated = isHated(state, id);
    const nowHated = isHated(changed, id);
    if (!wasHated && nowHated) result = andThen(result, (current) => becomeHated(current, id));
    if (wasHated && !nowHated) {
      result = { state: result.state, events: [...result.events, { type: 'no_longer_hated', characterId: id }] };
    }
  }
  return result;
}

/** "Her servants' loyalty drops by 20." */
function becomeHated(state: CourtState, id: CharacterId): RuleResult {
  const events: GameEvent[] = [{ type: 'became_hated', characterId: id }];
  let next = state;
  for (const servant of Object.values(state.servants)) {
    if (servant.servesId !== id) continue;
    const loyalty = clamp(servant.loyalty - HATED.servantLoyaltyLoss, SERVANT.loyaltyMin, SERVANT.loyaltyMax);
    if (loyalty === servant.loyalty) continue;
    next = withServant(next, { ...servant, loyalty });
    events.push({
      type: 'servant_loyalty_changed',
      servantId: servant.id,
      from: servant.loyalty,
      to: loyalty,
      cause: 'mistress_became_hated',
    });
  }
  return { state: next, events };
}

export interface PayRespectsIntent {
  readonly type: 'pay_respects';
  readonly actorId: CharacterId;
}

/** Who a lady pays her Morning respects to: her palace mistress, or the Empress if she is a mistress herself. */
export function respectsGoTo(state: CourtState, lady: Lady): Lady | null {
  const mistress = palaceMistress(state, lady.palaceId);
  if (mistress && mistress.id !== lady.id) return mistress;
  if (mistress?.id === lady.id) {
    const empress = findEmpress(state);
    return empress && empress.id !== lady.id ? empress : null;
  }
  return null;
}

/** Morning respects: free, once a Morning, and worth a little with the lady she bows to. */
export function payRespects(state: CourtState, intent: PayRespectsIntent): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  if (actor.path !== 'lady') return rejected(state, intent.type, actor.id, 'not_a_lady');
  if (!isRightPhase(state, 'pay_respects')) return rejected(state, intent.type, actor.id, 'wrong_phase');
  if (actor.today.paidRespects) return rejected(state, intent.type, actor.id, 'already_paid_respects');
  const target = respectsGoTo(state, actor);
  if (!target) return rejected(state, intent.type, actor.id, 'nobody_to_pay_respects_to');

  const paid: RuleResult = {
    state: withCharacter(state, { ...actor, today: { ...actor.today, paidRespects: true } }),
    events: [{ type: 'respects_paid', characterId: actor.id, toId: target.id }],
  };
  return andThen(paid, (current) =>
    changeRelationship(current, actor.id, target.id, RELATIONSHIP_CHANGE.respectsOrGreeting, 'morning_respects'),
  );
}

export interface GreetIntent {
  readonly type: 'greet';
  readonly actorId: CharacterId;
  readonly targetId: CharacterId;
}

/** A greeting: socializing, so it costs the socializing energy, and is worth a little with the one greeted. */
export function greet(state: CourtState, intent: GreetIntent): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  if (intent.targetId === actor.id) return rejected(state, intent.type, actor.id, 'cannot_target_self');
  if (!hasRelationships(state, intent.targetId)) return rejected(state, intent.type, actor.id, 'unknown_recipient');
  if (!isRightPhase(state, 'greet')) return rejected(state, intent.type, actor.id, 'wrong_phase');
  if (actor.energy < ENERGY.socializing) return rejected(state, intent.type, actor.id, 'not_enough_energy');

  const greeted: RuleResult = {
    state: withCharacter(state, { ...actor, energy: actor.energy - ENERGY.socializing }),
    events: [{ type: 'greeted', characterId: actor.id, targetId: intent.targetId }],
  };
  return andThen(greeted, (current) =>
    changeRelationship(current, actor.id, intent.targetId, RELATIONSHIP_CHANGE.respectsOrGreeting, 'greeting'),
  );
}

/**
 * "Helping with her task, warning her of a plot: +3 to +10."
 * The relationship effect only. Other rules call this when a kindness has happened.
 */
export function applyKindness(
  state: CourtState,
  helperId: CharacterId,
  helpedId: CharacterId,
  cause: 'help' | 'warning_of_a_plot',
  rng: Rng,
): RuleResult {
  const gain = rng.int(RELATIONSHIP_CHANGE.helpMin, RELATIONSHIP_CHANGE.helpMax);
  return changeRelationship(state, helperId, helpedId, gain, cause);
}

/**
 * "Bearing witness against her: -40 with her, -15 with each of her friends."
 * Her friends are counted as they stand before the witness speaks.
 */
export function applyWitnessFallout(state: CourtState, witnessId: CharacterId, accusedId: CharacterId): RuleResult {
  const herFriends = friendsOf(state, accusedId).filter((friendId) => friendId !== witnessId);
  let result = changeRelationship(state, witnessId, accusedId, RELATIONSHIP_CHANGE.witnessAgainstHer, 'bore_witness_against_her');
  for (const friendId of herFriends) {
    result = andThen(result, (current) =>
      changeRelationship(
        current,
        witnessId,
        friendId,
        RELATIONSHIP_CHANGE.witnessAgainstHerFriends,
        'bore_witness_against_her_friend',
      ),
    );
  }
  return result;
}

/** "Caught sabotaging her: -60 with her, -10 with everyone in her palace." */
export function applyCaughtSabotagingFallout(state: CourtState, saboteurId: CharacterId, victimId: CharacterId): RuleResult {
  const victim = getLady(state, victimId);
  const herPalace = victim
    ? allLadies(state).filter(
        (lady) => lady.palaceId === victim.palaceId && lady.id !== victimId && lady.id !== saboteurId,
      )
    : [];
  let result = changeRelationship(state, saboteurId, victimId, RELATIONSHIP_CHANGE.caughtSabotagingHer, 'caught_sabotaging_her');
  for (const lady of herPalace) {
    result = andThen(result, (current) =>
      changeRelationship(
        current,
        saboteurId,
        lady.id,
        RELATIONSHIP_CHANGE.caughtSabotagingHerPalace,
        'caught_sabotaging_in_her_palace',
      ),
    );
  }
  return result;
}
