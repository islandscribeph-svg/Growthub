/**
 * balance.ts: the one place for every number in docs/GAME_LOGIC.md (thresholds, costs,
 * percentages, durations, weights). Tune the game here; the rule logic never needs to change.
 *
 * - Every value is copied from docs/GAME_LOGIC.md. The section it comes from is named above it.
 * - Chances are written as fractions: 0.15 means 15%.
 * - Nothing here is invented. Numbers the doc does not give are listed, empty, at the bottom
 *   under NOT_IN_THE_DOC, and the effects that need them are switched off until they are filled.
 */
import type {
  ActivitySpot,
  GiftKind,
  GuardRank,
  LadyRank,
  LadyTalent,
  Phase,
  ShopItem,
  TrainableAttribute,
} from './types';

// ---------------------------------------------------------------------------------------------
// Section 1. Core loop
// ---------------------------------------------------------------------------------------------

export const CLOCK = {
  /** "One game day lasts 2 real hours." */
  gameDayRealHours: 2,
} as const;

export const ENERGY = {
  perDay: 10,
  training: 2,
  socializing: 1,
  /** "A scheme 3 to 4." */
  schemeMin: 3,
  schemeMax: 4,
} as const;

/** The phase each action belongs to, from the phase table in section 1. */
export const ACTION_PHASE = {
  pay_respects: 'morning',
  train: 'day',
  doll_up: 'day',
  give_gift: 'day',
  greet: 'day',
} as const satisfies Record<string, Phase>;

// ---------------------------------------------------------------------------------------------
// Section 2. World and movement
// ---------------------------------------------------------------------------------------------

export const WORLD = {
  consortPalaces: 12,
} as const;

export const DAY_PASS = {
  /** Granted when the relationship with the mistress is this or higher... */
  minMistressRelationship: 40,
  /** ...and her Obedience is this or higher. */
  minObedience: 20,
} as const;

export const SNEAKING_OUT = {
  caughtObedienceLoss: 10,
  caughtMistressRelationshipLoss: 10,
} as const;

// ---------------------------------------------------------------------------------------------
// Section 3. Stats and skill training
// ---------------------------------------------------------------------------------------------

/** "All stats run 0 to 100." */
export const STAT = {
  min: 0,
  max: 100,
} as const;

export type AttributeGainSize = 'normal' | 'small';

export interface ActivitySpotRule {
  /** The talents this spot can raise. A lady picks one when there are two. */
  readonly talents: readonly LadyTalent[];
  /** The attribute it also raises, or null for "none". */
  readonly alsoRaises: TrainableAttribute | null;
  /** 'small' for the rows the doc marks "(small)". */
  readonly attributeGain: AttributeGainSize;
}

/** The activity spot table. */
export const ACTIVITY_SPOT_RULES: Readonly<Record<ActivitySpot, ActivitySpotRule>> = {
  dressing_room: { talents: ['makeup'], alsoRaises: 'beauty', attributeGain: 'normal' },
  study: { talents: ['poetry', 'drawing'], alsoRaises: 'intelligence', attributeGain: 'normal' },
  music_pavilion: { talents: ['instruments', 'singing'], alsoRaises: 'beauty', attributeGain: 'small' },
  dance_terrace: { talents: ['dancing'], alsoRaises: 'beauty', attributeGain: 'normal' },
  sewing_room: { talents: ['sewing'], alsoRaises: 'obedience', attributeGain: 'small' },
  kitchen: { talents: ['cooking'], alsoRaises: null, attributeGain: 'normal' },
  courtyard_chores: { talents: [], alsoRaises: 'obedience', attributeGain: 'normal' },
  servants_gossip: { talents: ['plotting'], alsoRaises: null, attributeGain: 'normal' },
};

export const TRAINING = {
  /** "Adds 1 to 3 points to the talent." */
  minGain: 1,
  maxGain: 3,
  /** "The last 20 points are slow." */
  slowLastPoints: 20,
} as const;

export const DOLL_UP = {
  energyCost: 1,
  /** "A quarter of her Makeup." */
  makeupShare: 0.25,
  /** Premium cosmetics double that day's bonus (section 9). */
  premiumCosmeticsMultiplier: 2,
} as const;

export const CHILDBEARING = {
  start: 100,
} as const;

export const GIFT_QUALITY = {
  /** "The maker's talent plus a random number from -10 to +10." */
  rollMin: -10,
  rollMax: 10,
  /** "60 or higher: +5 to +8." */
  goodFrom: 60,
  goodMin: 5,
  goodMax: 8,
  /** "30 to 59: +1 to +3." */
  fairFrom: 30,
  fairMin: 1,
  fairMax: 3,
  /** "Below 30: -3 to -5." */
  badMin: -5,
  badMax: -3,
} as const;

export const STEPPING_ON_TOES = {
  relationshipLoss: 2,
  /** No loss when the relationship is already this or higher. */
  safeFromRelationship: 50,
} as const;

// ---------------------------------------------------------------------------------------------
// Section 4. Emperor's Favor and promotion
// ---------------------------------------------------------------------------------------------

/** weight = Beauty x 0.4 + best talent x 0.2 + Favor x 0.2 + Intelligence x 0.1 + Obedience x 0.1 */
export const EVENING_WEIGHT = {
  beauty: 0.4,
  bestTalent: 0.2,
  favor: 0.2,
  intelligence: 0.1,
  obedience: 0.1,
} as const;

export const CHOSEN = {
  favorGainMin: 5,
  favorGainMax: 10,
  /** "15% times her Childbearing divided by 100." */
  conceptionChance: 0.15,
  /** "The Emperor's reward after he chooses her: 10 to 30 taels" (section 9). */
  rewardMin: 10,
  rewardMax: 30,
} as const;

export const BIRTH = {
  princeFavor: 25,
  princessFavor: 15,
  /** "The mother of a prince also gains 10 relationship with the Empress Dowager" (section 11). */
  princeDowagerRelationship: 10,
} as const;

export const FAVOR_DECAY = {
  perDay: 1,
  /** "Her favor decays at double speed" in the Cold Palace (section 7). */
  coldPalaceMultiplier: 2,
} as const;

/** Favor needed for each rank. The starting rank needs none. */
export const FAVOR_NEEDED: Readonly<Record<LadyRank, number>> = {
  second_class_attendant: 0,
  first_class_attendant: 25,
  noble_lady: 40,
  imperial_concubine: 55,
  consort: 68,
  noble_consort: 80,
  imperial_noble_consort: 90,
  empress: 100,
};

/** Seats at each rank. Null means no limit. */
export const LADY_SEATS: Readonly<Record<LadyRank, number | null>> = {
  second_class_attendant: null,
  first_class_attendant: null,
  noble_lady: null,
  imperial_concubine: 6,
  consort: 4,
  noble_consort: 2,
  imperial_noble_consort: 1,
  empress: 1,
};

export const RANK_REVIEW = {
  everyDays: 7,
  /** A challenger needs at least this much more favor than the weakest seat-holder. */
  favorLead: 15,
} as const;

export const EMPRESS_SEAT = {
  minDowagerRelationship: 70,
  minHaremAverage: 30,
} as const;

// ---------------------------------------------------------------------------------------------
// Section 5. Relationships
// ---------------------------------------------------------------------------------------------

export const RELATIONSHIP = {
  min: 0,
  max: 100,
  /** "Starting at 30 for strangers." */
  strangers: 30,
  /** "Two characters are friends when their score is 70 or higher." */
  friendsFrom: 70,
  /** "If a lady's average score across the harem falls below 15, she is hated." */
  hatedBelow: 15,
  /** "Mistress at 40 or higher: day passes, and she may recommend the lady." */
  mistressFavorsFrom: 40,
  /** "Any lady at 70 or higher: she shares gossip and clues." */
  sharesGossipFrom: 70,
  /** "Empress Dowager at 70 or higher: required for the Empress seat, can overturn a verdict." */
  dowagerBacksFrom: 70,
} as const;

/** The relationship table. */
export const RELATIONSHIP_CHANGE = {
  respectsOrGreeting: 1,
  helpMin: 3,
  helpMax: 10,
  witnessAgainstHer: -40,
  witnessAgainstHerFriends: -15,
  caughtSabotagingHer: -60,
  caughtSabotagingHerPalace: -10,
} as const;

export const HATED = {
  servantLoyaltyLoss: 20,
  /** "Bribing them against her costs half." */
  bribeCostMultiplier: 0.5,
  /** Section 7: the defender gets "-15 if she is hated". */
  defencePenalty: 15,
} as const;

// ---------------------------------------------------------------------------------------------
// Section 6. NPCs
// ---------------------------------------------------------------------------------------------

export const SERVANT = {
  loyaltyMin: 0,
  loyaltyMax: 100,
  /** Bribing "fails outright above 80". */
  refusesBribeAbove: 80,
} as const;

// ---------------------------------------------------------------------------------------------
// Section 7. Sabotage, detection and trials
// ---------------------------------------------------------------------------------------------

export const POISON = {
  illnessDays: 4,
  missedSummonsFavorLoss: 10,
  fertilityLossMin: 20,
  fertilityLossMax: 40,
} as const;

export const BURN_BELONGINGS = {
  noDollUpDays: 3,
} as const;

export const RUMOR_SCHEME = {
  favorLoss: 5,
} as const;

/**
 * attacker = Plotting + random(1 to 50)
 * defender = target Plotting / 2 + maid Loyalty / 2 + 20
 */
export const SCHEME_ROLL = {
  attackerRollMin: 1,
  attackerRollMax: 50,
  defenderPlottingShare: 0.5,
  defenderMaidLoyaltyShare: 0.5,
  defenderBase: 20,
  warnedByFriendBonus: 15,
  /** Section 8: "Her defense against schemes is +20 while offline." */
  offlineBonus: 20,
} as const;

export const DETECTION = {
  failedSchemeTracedChance: 0.6,
  /** "30% minus a quarter of the attacker's Plotting, and never less than 5%." */
  workedSchemeTracedBase: 0.3,
  attackerPlottingShare: 0.25,
  workedSchemeTracedMin: 0.05,
  clueLastsDays: 3,
} as const;

/** score = Favor + Intelligence / 2 + Plotting / 2 + 10 per friend testifying + evidence */
export const TRIAL = {
  intelligenceShare: 0.5,
  plottingShare: 0.5,
  perFriendTestifying: 10,
  realEvidence: 30,
  fabricatedEvidence: 15,
  fabricatedExposedChance: 0.25,
  accusedLosesFavor: 30,
  accusedColdPalaceDays: 6,
  accusedDemotedRanks: 1,
  witnessWinsFavor: 15,
  witnessLosesFavor: 20,
  witnessLosesObedience: 10,
  /** "The loser of a trial is fined 20% of her silver" (section 9). */
  loserFineShare: 0.2,
  /** "A bribed servant questioned at trial confesses with a chance equal to half her Loyalty" (section 9). */
  bribedServantConfessLoyaltyShare: 0.5,
  dowagerOverturns: 1,
} as const;

// ---------------------------------------------------------------------------------------------
// Section 8. Multiplayer
// ---------------------------------------------------------------------------------------------

export const COURT = {
  maxPlayers: 30,
  playersPerPalaceMin: 2,
  playersPerPalaceMax: 3,
} as const;

export const OFFLINE = {
  maxSuccessfulSchemesPerDay: 1,
  /** "The trial waits 12 game days (one real day) for the player." */
  trialWaitsDays: 12,
} as const;

// ---------------------------------------------------------------------------------------------
// Section 9. Money
// ---------------------------------------------------------------------------------------------

/** Stipend per game day, in taels. */
export const STIPEND: Readonly<Record<LadyRank, number>> = {
  second_class_attendant: 5,
  first_class_attendant: 8,
  noble_lady: 12,
  imperial_concubine: 20,
  consort: 30,
  noble_consort: 45,
  imperial_noble_consort: 60,
  empress: 100,
};

export const SELLING = {
  /** "Quality divided by 5, in taels." */
  qualityPerTael: 5,
} as const;

export interface GiftRule {
  readonly cost: number;
  /** The talent a homemade gift is rolled on, or null for a bought gift. */
  readonly rolledOn: LadyTalent | null;
  /** The fixed relationship effect of a bought gift, or null for a homemade one. */
  readonly relationship: number | null;
  /** "A gift to someone ranked above her is worth half unless it is jewelry or better." */
  readonly fullValueToHigherRanks: boolean;
}

/** The gift table. */
export const GIFTS: Readonly<Record<GiftKind, GiftRule>> = {
  homemade_dish: { cost: 3, rolledOn: 'cooking', relationship: null, fullValueToHigherRanks: false },
  homemade_sewn_item: { cost: 5, rolledOn: 'sewing', relationship: null, fullValueToHigherRanks: false },
  trinket: { cost: 10, rolledOn: null, relationship: 2, fullValueToHigherRanks: false },
  fine_jewelry: { cost: 40, rolledOn: null, relationship: 5, fullValueToHigherRanks: true },
  rare_treasure: { cost: 120, rolledOn: null, relationship: 10, fullValueToHigherRanks: true },
};

export const GIFTING = {
  /** "One gift per recipient per game day counts." */
  countedPerRecipientPerDay: 1,
  higherRankMultiplier: 0.5,
} as const;

/** bribe cost = servant Loyalty x target's rank number (1 to 8) / 2, minimum 10 taels */
export const BRIBE = {
  rankDivisor: 2,
  minimum: 10,
  spy: 10,
  gateGuard: 15,
  imperialPhysician: 60,
  /** "Paying double the bribe cost removes that risk" of a confession. */
  silenceMultiplier: 2,
} as const;

export const TIP = {
  cost: 5,
  loyaltyGain: 2,
  maxLoyaltyPerDay: 6,
} as const;

/** The "other costs" table, in taels. */
export const SHOP_PRICE: Readonly<Record<ShopItem, number>> = {
  poison_ingredients: 25,
  fertility_poison_ingredients: 40,
  physician_cure: 15,
  childbearing_restoration: 30,
  premium_cosmetics: 5,
};

export const CHILDBEARING_RESTORATION = {
  /** "Restoring 10 points of Childbearing" costs the price above. */
  points: 10,
} as const;

export const TRANSFER = {
  /** "Player-to-player transfers are capped at 50 taels per game day." */
  playerToPlayerCapPerDay: 50,
} as const;

// ---------------------------------------------------------------------------------------------
// Section 11. Children
// ---------------------------------------------------------------------------------------------

export const BOND = {
  min: 0,
  max: 100,
  start: 50,
  visitEnergyCost: 1,
  visitGain: 5,
  lossPerDayWithoutVisit: 5,
  /** "While Bond is 50 or higher, the mother gains 1 favor per game day." */
  favorBonusFrom: 50,
  favorPerDay: 1,
} as const;

export const CUSTODY = {
  /** "Evidence of neglect (Bond below 30)." */
  neglectBelowBond: 30,
  motherLosesFavor: 10,
  /** "The foster mother gains 1 favor every second game day." */
  fosterFavor: 1,
  fosterFavorEveryDays: 2,
  /** "After 12 game days the mother can petition in return." */
  petitionBackAfterDays: 12,
  /** She wins automatically at this relationship with the Empress Dowager or higher. */
  autoWinDowagerRelationship: 70,
} as const;

/** "A rival ranked Imperial Concubine or above can petition." */
export const CUSTODY_MIN_RANK: LadyRank = 'imperial_concubine';

// ---------------------------------------------------------------------------------------------
// Section 12. The male path
// ---------------------------------------------------------------------------------------------

/** Seats at each guard rank. Null means no limit. */
export const GUARD_SEATS: Readonly<Record<GuardRank, number | null>> = {
  blue_feather_guard: null,
  third_class_guard: null,
  second_class_guard: null,
  first_class_guard: 6,
  guard_of_the_imperial_presence: 2,
  emperors_favorite: 1,
};

/** "From Guard of the Imperial Presence upward he ... is always noticed." */
export const GUARD_ALWAYS_NOTICED_FROM: GuardRank = 'guard_of_the_imperial_presence';

export const GUARD_SPEAKS = {
  everyDays: 7,
  favorMoved: 5,
} as const;

export const FRONTIER = {
  days: 6,
  demotedRanks: 1,
} as const;

// ---------------------------------------------------------------------------------------------
// Unit conversions. These are facts, not game numbers, and are not for tuning.
// ---------------------------------------------------------------------------------------------

export const MS_PER_HOUR = 3_600_000;
export const HOURS_PER_REAL_DAY = 24;

// ---------------------------------------------------------------------------------------------
// NOT IN THE DOC
//
// The doc names these effects but gives no number for them. They are left empty (null) rather
// than invented, and each effect is switched off until Peps fills in a number here.
// ---------------------------------------------------------------------------------------------

export const NOT_IN_THE_DOC: {
  readonly spotAttributeGain: number | null;
  readonly spotAttributeGainSmall: number | null;
} = {
  /** Section 3, "Also raises": how many points of Beauty, Intelligence or Obedience per training action. */
  spotAttributeGain: null,
  /** Section 3, the rows marked "(small)": how many points. */
  spotAttributeGainSmall: null,
};
