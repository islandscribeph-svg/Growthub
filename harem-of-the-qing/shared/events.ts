/**
 * What a rule reports back. Every rule returns the new state plus a list of these, so the
 * server can tell each player what happened and write the Night report.
 */
import type {
  ActivitySpot,
  CharacterId,
  GiftKind,
  LadyTalent,
  Phase,
  SellableWork,
  ServantId,
  ShopItem,
  TrainableAttribute,
} from './types';

/** Why an action was refused. Nothing changes when an action is refused. */
export type RejectionReason =
  | 'unknown_character'
  | 'unknown_recipient'
  | 'unknown_servant'
  | 'not_a_lady'
  | 'wrong_phase'
  | 'not_enough_energy'
  | 'not_enough_silver'
  | 'in_cold_palace'
  | 'spot_does_not_train_that_talent'
  | 'talent_not_chosen'
  | 'not_in_own_room'
  | 'already_paid_respects'
  | 'nobody_to_pay_respects_to'
  | 'cannot_target_self'
  | 'not_her_servant'
  | 'loyalty_already_full'
  | 'tip_limit_reached'
  | 'invalid_amount'
  | 'transfer_cap_reached'
  | 'not_ill'
  | 'childbearing_already_full'
  | 'already_bought_today'
  | 'already_greeted_today'
  | 'already_sold_today'
  | 'recipient_has_no_relationship_score';

export type RelationshipCause =
  | 'morning_respects'
  | 'skipped_morning_respects'
  | 'greeting'
  | 'gift'
  | 'help'
  | 'warning_of_a_plot'
  | 'used_her_activity_spot'
  | 'bore_witness_against_her'
  | 'bore_witness_against_her_friend'
  | 'caught_sabotaging_her'
  | 'caught_sabotaging_in_her_palace';

export type GiftBand = 'good' | 'fair' | 'bad';

export type GameEvent =
  | { readonly type: 'rejected'; readonly intent: string; readonly actorId: CharacterId | null; readonly reason: RejectionReason }
  | { readonly type: 'phase_changed'; readonly day: number; readonly phase: Phase }
  | { readonly type: 'day_started'; readonly day: number }
  | { readonly type: 'energy_lost'; readonly characterId: CharacterId; readonly amount: number }
  | { readonly type: 'energy_restored'; readonly characterId: CharacterId; readonly energy: number }
  | { readonly type: 'stipend_paid'; readonly characterId: CharacterId; readonly amount: number }
  | {
      readonly type: 'trained';
      readonly characterId: CharacterId;
      readonly spot: ActivitySpot;
      readonly talent: LadyTalent | null;
      readonly talentGain: number;
      readonly attribute: TrainableAttribute | null;
      readonly attributeGain: number;
    }
  | { readonly type: 'dolled_up'; readonly characterId: CharacterId; readonly beautyBonus: number }
  | {
      readonly type: 'relationship_changed';
      readonly between: readonly [CharacterId, CharacterId];
      readonly from: number;
      readonly to: number;
      readonly cause: RelationshipCause;
    }
  | { readonly type: 'became_friends'; readonly between: readonly [CharacterId, CharacterId] }
  | { readonly type: 'friendship_ended'; readonly between: readonly [CharacterId, CharacterId] }
  | { readonly type: 'became_hated'; readonly characterId: CharacterId }
  | { readonly type: 'no_longer_hated'; readonly characterId: CharacterId }
  | {
      readonly type: 'servant_loyalty_changed';
      readonly servantId: ServantId;
      readonly from: number;
      readonly to: number;
      readonly cause: 'tip' | 'mistress_became_hated';
    }
  | { readonly type: 'respects_paid'; readonly characterId: CharacterId; readonly toId: CharacterId }
  | {
      readonly type: 'respects_skipped';
      readonly characterId: CharacterId;
      readonly toId: CharacterId;
      readonly obedienceFrom: number;
      readonly obedienceTo: number;
    }
  | { readonly type: 'greeted'; readonly characterId: CharacterId; readonly targetId: CharacterId }
  | { readonly type: 'purchased'; readonly characterId: CharacterId; readonly item: ShopItem; readonly cost: number }
  | { readonly type: 'illness_cured'; readonly characterId: CharacterId }
  | { readonly type: 'childbearing_restored'; readonly characterId: CharacterId; readonly from: number; readonly to: number }
  | { readonly type: 'servant_tipped'; readonly characterId: CharacterId; readonly servantId: ServantId; readonly cost: number }
  | {
      readonly type: 'work_sold';
      readonly characterId: CharacterId;
      readonly work: SellableWork;
      readonly quality: number;
      readonly price: number;
    }
  | { readonly type: 'silver_given'; readonly fromId: CharacterId; readonly toId: CharacterId; readonly amount: number }
  | {
      readonly type: 'gift_given';
      readonly giverId: CharacterId;
      readonly recipientId: CharacterId;
      readonly gift: GiftKind;
      readonly cost: number;
      /** The rolled quality of a homemade gift, or null for a bought one. */
      readonly quality: number | null;
      readonly band: GiftBand | null;
      /** False when she had already given this recipient a gift today, so this one did nothing. */
      readonly counted: boolean;
      /** True when the gift was worth half because the recipient outranks the giver. */
      readonly halved: boolean;
      readonly relationshipChange: number;
    };

export type GameEventType = GameEvent['type'];
