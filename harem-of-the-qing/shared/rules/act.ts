/**
 * The one door every player action comes through. Section 13.11 of GAME_LOGIC.md: each action
 * is done somewhere, with someone. `act` checks that the character is standing in the right
 * place with the right person, fills in what the server knows about who is where, and then
 * runs the rule itself.
 */
import { SELLING_WORK } from '../balance';
import type { RejectionReason } from '../events';
import type { Rng } from '../rng';
import type { ActivitySpot, CharacterId, CourtState, LadyTalent, Servant, ServantRole } from '../types';
import { getCharacter, rejected, wasRejected, type RuleResult } from './core';
import { giveGift, type GiveGiftIntent } from './gifting';
import {
  buy,
  giveSilver,
  sellWork,
  tipServant,
  type BuyIntent,
  type GiveSilverIntent,
  type SellWorkIntent,
  type TipServantIntent,
} from './money';
import {
  areTogether,
  enterPlace,
  isInOwnRoom,
  isWelcomeInRoomOf,
  peopleIn,
  placeOf,
  regularPresent,
  type EnterPlaceIntent,
} from './places';
import { greet, payRespects, respectsGoTo, type GreetIntent, type PayRespectsIntent } from './relationships';
import { dollUp, train } from './training';

/** Training as a player asks for it. Who else is in the room is worked out here, not sent. */
export interface TrainHereIntent {
  readonly type: 'train';
  readonly actorId: CharacterId;
  readonly spot: ActivitySpot;
  readonly talent?: LadyTalent;
  /** True when she asked the spot's regular before using it. */
  readonly askedFirst?: boolean;
}

export interface DollUpHereIntent {
  readonly type: 'doll_up';
  readonly actorId: CharacterId;
}

/** A gift or silver is handed over in person, unless her maid carries it. */
export interface Carried {
  readonly sentWithMaid?: boolean;
}

export type CourtIntent =
  | EnterPlaceIntent
  | PayRespectsIntent
  | GreetIntent
  | (GiveGiftIntent & Carried)
  | (GiveSilverIntent & Carried)
  | TrainHereIntent
  | DollUpHereIntent
  | SellWorkIntent
  | BuyIntent
  | TipServantIntent;

/** Her own personal maid, when the maid is standing with her. */
export function maidWith(state: CourtState, ladyId: CharacterId): Servant | null {
  return (
    Object.values(state.servants).find(
      (servant) => servant.role === 'personal_maid' && servant.servesId === ladyId && areTogether(state, ladyId, servant.id),
    ) ?? null
  );
}

/**
 * Why she cannot speak to or hand something to this person right now, or null when she can.
 * They must be in the same place, and a lady in her own room only receives those welcome there.
 */
export function whyCannotApproach(state: CourtState, actorId: CharacterId, targetId: CharacterId): RejectionReason | null {
  if (!areTogether(state, actorId, targetId)) return 'not_with_that_person';
  const actor = getCharacter(state, actorId);
  const place = placeOf(state, targetId);
  if (!actor || !place) return 'not_with_that_person';
  if (place.kind === 'private_room' && place.ownerId === targetId && !isWelcomeInRoomOf(state, actor, targetId)) {
    return 'she_is_in_her_own_room';
  }
  return null;
}

/** 13.11 The spots where the work is done alongside a servant: she has to be there to do it with. */
export const SPOT_LED_BY: Readonly<Partial<Record<ActivitySpot, ServantRole>>> = {
  kitchen: 'cook',
  courtyard_chores: 'eunuch',
};

/** Why she cannot train at this spot where she stands, or null when she can. */
export function whyCannotTrainHere(state: CourtState, actorId: CharacterId, spot: ActivitySpot): RejectionReason | null {
  const place = placeOf(state, actorId);
  if (!place) return 'not_in_the_right_place';
  const servantsHere = peopleIn(state, place.id).flatMap((id) => state.servants[id] ?? []);
  if (spot === 'servants_gossip') return servantsHere.length > 0 ? null : 'no_servant_here';
  if (!place.spots.includes(spot)) return 'not_in_the_right_place';
  const leader = SPOT_LED_BY[spot];
  if (leader && !servantsHere.some((servant) => servant.role === leader)) return 'no_servant_here';
  return null;
}

function sendMaid(
  state: CourtState,
  intentType: string,
  actorId: CharacterId,
  errand: 'gift' | 'silver' | 'shopping',
  run: () => RuleResult,
): RuleResult {
  const maid = maidWith(state, actorId);
  if (!maid) return rejected(state, intentType, actorId, 'maid_not_here');
  const result = run();
  if (wasRejected(result)) return result;
  return {
    state: result.state,
    events: [{ type: 'maid_sent', characterId: actorId, servantId: maid.id, errand }, ...result.events],
  };
}

/** Runs one player action, after checking she is in the right place with the right person. */
export function act(state: CourtState, intent: CourtIntent, rng: Rng): RuleResult {
  const refuse = (reason: RejectionReason): RuleResult => rejected(state, intent.type, intent.actorId, reason);
  switch (intent.type) {
    case 'enter_place':
      return enterPlace(state, intent);
    case 'pay_respects': {
      const actor = getCharacter(state, intent.actorId);
      const target = actor?.path === 'lady' ? respectsGoTo(state, actor) : null;
      if (target && !areTogether(state, intent.actorId, target.id)) return refuse('not_with_that_person');
      return payRespects(state, intent);
    }
    case 'greet': {
      const problem = whyCannotApproach(state, intent.actorId, intent.targetId);
      return problem ? refuse(problem) : greet(state, intent);
    }
    case 'give_gift': {
      if (intent.sentWithMaid) {
        return sendMaid(state, intent.type, intent.actorId, 'gift', () => giveGift(state, intent, rng));
      }
      const problem = whyCannotApproach(state, intent.actorId, intent.recipientId);
      return problem ? refuse(problem) : giveGift(state, intent, rng);
    }
    case 'give_silver': {
      if (intent.sentWithMaid) {
        return sendMaid(state, intent.type, intent.actorId, 'silver', () => giveSilver(state, intent));
      }
      const problem = whyCannotApproach(state, intent.actorId, intent.recipientId);
      return problem ? refuse(problem) : giveSilver(state, intent);
    }
    case 'train': {
      const problem = whyCannotTrainHere(state, intent.actorId, intent.spot);
      if (problem) return refuse(problem);
      const place = placeOf(state, intent.actorId);
      const regular = place ? regularPresent(state, place, intent.spot, intent.actorId) : null;
      return train(state, { ...intent, regularPresentId: regular?.id ?? null });
    }
    case 'doll_up':
      return dollUp(state, { ...intent, inOwnRoom: isInOwnRoom(state, intent.actorId) });
    case 'sell_work': {
      const problem = whyCannotTrainHere(state, intent.actorId, SELLING_WORK.madeAt[intent.work]);
      return problem ? refuse(problem) : sellWork(state, intent, rng);
    }
    case 'buy':
      return sendMaid(state, intent.type, intent.actorId, 'shopping', () => buy(state, intent));
    case 'tip_servant': {
      const known = state.servants[intent.servantId] !== undefined;
      if (known && !areTogether(state, intent.actorId, intent.servantId)) return refuse('not_with_that_person');
      return tipServant(state, intent);
    }
    default: {
      const unknown: never = intent;
      throw new Error(`Unknown intent: ${JSON.stringify(unknown)}`);
    }
  }
}
