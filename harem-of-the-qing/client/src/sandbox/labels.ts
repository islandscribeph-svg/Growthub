/** Plain-language names for everything the sandbox shows. Words only; no rules live here. */
import type { RejectionReason, RelationshipCause } from '../../../shared/events';
import type {
  ActivitySpot,
  GiftKind,
  GuardRank,
  LadyRank,
  LadyTalent,
  Phase,
  SellableWork,
  ShopItem,
  TrainableAttribute,
} from '../../../shared/types';

export const RANK_NAME: Readonly<Record<LadyRank | GuardRank, string>> = {
  second_class_attendant: 'Second Class Attendant',
  first_class_attendant: 'First Class Attendant',
  noble_lady: 'Noble Lady',
  imperial_concubine: 'Imperial Concubine',
  consort: 'Consort',
  noble_consort: 'Noble Consort',
  imperial_noble_consort: 'Imperial Noble Consort',
  empress: 'Empress',
  blue_feather_guard: 'Blue Feather Guard',
  third_class_guard: 'Third Class Guard',
  second_class_guard: 'Second Class Guard',
  first_class_guard: 'First Class Guard',
  guard_of_the_imperial_presence: 'Guard of the Imperial Presence',
  emperors_favorite: "The Emperor's Favorite",
};

export const TALENT_NAME: Readonly<Record<LadyTalent, string>> = {
  makeup: 'Makeup',
  poetry: 'Poetry',
  drawing: 'Drawing',
  instruments: 'Instruments',
  singing: 'Singing',
  dancing: 'Dancing',
  sewing: 'Sewing',
  cooking: 'Cooking',
  plotting: 'Plotting',
};

export const ATTRIBUTE_NAME: Readonly<Record<TrainableAttribute, string>> = {
  beauty: 'Beauty',
  intelligence: 'Intelligence',
  obedience: 'Obedience',
};

export const SPOT_NAME: Readonly<Record<ActivitySpot, string>> = {
  dressing_room: 'Dressing room',
  study: 'Study',
  music_pavilion: 'Music pavilion',
  dance_terrace: 'Dance terrace',
  sewing_room: 'Sewing room',
  kitchen: 'Kitchen',
  courtyard_chores: 'Courtyard chores',
  servants_gossip: 'Gossiping with servants',
};

export const GIFT_NAME: Readonly<Record<GiftKind, string>> = {
  homemade_dish: 'Homemade dish',
  homemade_sewn_item: 'Homemade sewn item',
  trinket: 'Trinket',
  fine_jewelry: 'Fine jewelry',
  rare_treasure: 'Rare treasure',
};

export const ITEM_NAME: Readonly<Record<ShopItem, string>> = {
  poison_ingredients: 'Poison ingredients',
  fertility_poison_ingredients: 'Fertility poison ingredients',
  physician_cure: 'Physician visit (cures illness)',
  childbearing_restoration: 'Restore Childbearing',
  premium_cosmetics: 'Premium cosmetics',
};

/** The same things as they read inside a sentence. */
export const GIFT_PHRASE: Readonly<Record<GiftKind, string>> = {
  homemade_dish: 'a homemade dish',
  homemade_sewn_item: 'a homemade sewn item',
  trinket: 'a trinket',
  fine_jewelry: 'fine jewelry',
  rare_treasure: 'a rare treasure',
};

export const ITEM_PHRASE: Readonly<Record<ShopItem, string>> = {
  poison_ingredients: 'poison ingredients',
  fertility_poison_ingredients: 'fertility poison ingredients',
  physician_cure: 'a physician visit',
  childbearing_restoration: 'a Childbearing treatment',
  premium_cosmetics: 'premium cosmetics',
};

export const WORK_PHRASE: Readonly<Record<SellableWork, string>> = {
  sewing: 'a piece of sewing',
  drawing: 'a drawing',
};

export const WORK_NAME: Readonly<Record<SellableWork, string>> = {
  sewing: 'A piece of sewing',
  drawing: 'A drawing',
};

export const PHASE_NAME: Readonly<Record<Phase, string>> = {
  morning: 'Morning',
  day: 'Day',
  evening: 'Evening',
  night: 'Night',
};

export const PHASE_HINT: Readonly<Record<Phase, string>> = {
  morning: 'Pay your respects now. It is free, and skipping it costs a little.',
  day: 'Train, doll up, greet, give gifts and sell your work. Each costs energy.',
  evening: 'The Emperor chooses one person. That rule is not built yet.',
  night: 'Unspent energy is gone. Hidden things resolve here once rules 6 to 13 exist.',
};

export const CAUSE_TEXT: Readonly<Record<RelationshipCause, string>> = {
  morning_respects: 'Morning respects',
  skipped_morning_respects: 'skipped Morning respects',
  greeting: 'a greeting',
  gift: 'a gift',
  help: 'help with a task',
  warning_of_a_plot: 'a warning of a plot',
  used_her_activity_spot: 'used her activity spot uninvited',
  walked_in_on_her: 'walked in on her in her own room',
  bore_witness_against_her: 'bore witness against her',
  bore_witness_against_her_friend: 'bore witness against her friend',
  caught_sabotaging_her: 'caught sabotaging her',
  caught_sabotaging_in_her_palace: 'caught sabotaging someone in her palace',
};

/** Why an action was refused. In the sandbox the one acting is always the tester, so these say "you". */
export const REJECTION_TEXT: Readonly<Record<RejectionReason, string>> = {
  unknown_character: 'that person is not in this court.',
  unknown_recipient: 'that person cannot receive this.',
  unknown_servant: 'that servant is not in this court.',
  not_a_lady: 'only a lady can do this.',
  wrong_phase: 'this is the wrong time of day for it.',
  not_enough_energy: 'you do not have enough energy left today.',
  not_enough_silver: 'you do not have enough silver.',
  in_cold_palace: 'you cannot do this from the Cold Palace.',
  spot_does_not_train_that_talent: 'that spot does not train that talent.',
  talent_not_chosen: 'this spot trains two talents, so one has to be chosen.',
  not_in_own_room: 'you can only doll up in your own room.',
  already_paid_respects: 'you have already paid your respects this Morning.',
  nobody_to_pay_respects_to: 'there is nobody for you to pay respects to.',
  cannot_target_self: 'you cannot do this to yourself.',
  not_her_servant: 'that servant does not serve you.',
  loyalty_already_full: "the servant's Loyalty is already at the top.",
  tip_limit_reached: "you have reached today's tipping limit for this servant.",
  invalid_amount: 'the amount has to be a whole number above zero.',
  transfer_cap_reached: 'that would go over the daily cap on silver between players.',
  not_ill: 'you are not ill, so there is nothing to cure.',
  childbearing_already_full: 'your Childbearing is already at the top.',
  already_bought_today: 'you have already bought this today.',
  already_greeted_today: 'you have already greeted this person today.',
  already_sold_today: 'the eunuch has already taken a piece from you today.',
  recipient_has_no_relationship_score: 'that person has no relationship score.',
  unknown_place: 'that place is not on the map.',
  not_in_the_right_place: 'you are not in the right place for this.',
  not_with_that_person: 'you are not standing with that person.',
  she_is_in_her_own_room: 'she is in her own room and does not wish to be disturbed.',
  no_servant_here: 'there is no servant here to gossip with.',
  maid_not_here: 'your maid is not with you.',
};
