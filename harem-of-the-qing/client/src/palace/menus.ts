/**
 * What the player is offered when she talks to someone or uses a room. Each option only names
 * an intent; whether it is allowed is always decided by the rules when the intent is sent.
 * Options are offered even when the rules will refuse them, so the refusal can be read.
 */
import {
  DOLL_UP,
  ENERGY,
  GIFTING,
  GIFTS,
  PRIVATE_ROOM,
  RELATIONSHIP_CHANGE,
  SELLING_WORK,
  SHOP_PRICE,
  SPOT_ATTRIBUTE_GAIN,
  ACTIVITY_SPOT_RULES,
  STEPPING_ON_TOES,
  TIP,
  TRANSFER,
} from '../../../shared/balance';
import { SPOT_LED_BY, maidWith, whyCannotApproach, type CourtIntent } from '../../../shared/rules/act';
import { isRankedAbove } from '../../../shared/rules/gifting';
import { areTogether, peopleIn, placeOf, regularPresent } from '../../../shared/rules/places';
import { relationshipBetween, respectsGoTo } from '../../../shared/rules/relationships';
import { dollUpBonusFor, trainingGain } from '../../../shared/rules/training';
import type {
  ActivitySpot,
  CharacterId,
  CourtState,
  GiftKind,
  Lady,
  LadyTalent,
  Place,
  SellableWork,
  ServantRole,
  ShopItem,
} from '../../../shared/types';
import { everyoneElse } from '../sandbox/demoCourt';
import { nameOf } from '../sandbox/describe';
import { ATTRIBUTE_NAME, GIFT_NAME, ITEM_NAME, RANK_NAME, TALENT_NAME } from '../sandbox/labels';
import { YOU } from './palaceCourt';

export interface MenuOption {
  readonly label: string;
  readonly detail: string;
  /** Sent to the rules when the option is chosen. */
  readonly intent?: CourtIntent;
  /** Opens another list of options. */
  readonly submenu?: MenuBuilder;
  /** Asks this spot regular before using her room. */
  readonly askRegularId?: CharacterId;
}

export interface MenuView {
  readonly title: string;
  readonly subtitle: string;
  readonly notes: readonly string[];
  readonly options: readonly MenuOption[];
}

/** What the page remembers between choices. */
export interface MenuMemory {
  hasAsked(regularId: CharacterId): boolean;
}

/** Builds a menu from the court as it is now. Null: there is nothing to offer, so the menu closes. */
export type MenuBuilder = (court: CourtState, memory: MenuMemory) => MenuView | null;

/** The amounts of silver the menu offers to hand over. */
const SILVER_CHOICES = [5, 10, 25] as const;

const GIFT_ORDER: readonly GiftKind[] = ['homemade_dish', 'homemade_sewn_item', 'trinket', 'fine_jewelry', 'rare_treasure'];
const SHOP_ORDER: readonly ShopItem[] = [
  'premium_cosmetics',
  'physician_cure',
  'childbearing_restoration',
  'poison_ingredients',
  'fertility_poison_ingredients',
];
const WORKS: readonly SellableWork[] = ['sewing', 'drawing'];

/** What the menu calls the work done alongside each kind of servant (SPOT_LED_BY in the rules). */
const LED_LABEL: Readonly<Partial<Record<ServantRole, string>>> = {
  cook: 'Cook alongside her',
  eunuch: 'Help him sweep the courtyard',
};
const AWAY_NOTE: Readonly<Partial<Record<ServantRole, string>>> = {
  cook: 'The cook is away. Come back when she is at her stove.',
  eunuch: 'The eunuch is away. Come back when he is sweeping here.',
};

const ROLE_NAME: Readonly<Record<ServantRole, string>> = {
  personal_maid: 'Maid',
  cook: 'Palace cook',
  eunuch: 'Palace eunuch',
  guard: 'Palace guard',
};

const PRACTISE: Readonly<Record<LadyTalent, string>> = {
  makeup: 'Practise makeup at the mirror',
  poetry: 'Read and write poetry',
  drawing: 'Practise drawing',
  instruments: 'Practise an instrument',
  singing: 'Practise singing',
  dancing: 'Practise dancing',
  sewing: 'Practise sewing',
  cooking: 'Practise cooking',
  plotting: 'Listen for gossip',
};

const MAKE_TO_SELL: Readonly<Record<SellableWork, string>> = {
  sewing: 'Sew a piece to sell',
  drawing: 'Make a drawing to sell',
};

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function you(court: CourtState): Lady {
  const character = court.characters[YOU];
  if (character?.path !== 'lady') throw new Error('The palace has lost its player.');
  return character;
}

function energy(amount: number): string {
  return `${amount} energy`;
}

function signed(amount: number): string {
  return amount >= 0 ? `+${amount}` : `${amount}`;
}

/** "2 energy · Day only · Cooking +3" for one training action at a spot. */
function trainingDetail(court: CourtState, spot: ActivitySpot, talent: LadyTalent | null): string {
  const rule = ACTIVITY_SPOT_RULES[spot];
  const gains: string[] = [];
  if (talent) gains.push(`${TALENT_NAME[talent]} +${trainingGain(you(court).talents[talent])}`);
  if (rule.alsoRaises) gains.push(`${ATTRIBUTE_NAME[rule.alsoRaises]} +${SPOT_ATTRIBUTE_GAIN[rule.attributeGain]}`);
  return [energy(ENERGY.training), 'Day only', gains.join(', ')].join(' · ');
}

function gossipOption(court: CourtState, label: string): MenuOption {
  return {
    label,
    detail: trainingDetail(court, 'servants_gossip', 'plotting'),
    intent: { type: 'train', actorId: YOU, spot: 'servants_gossip' },
  };
}

function giftMenu(recipientId: CharacterId, sentWithMaid: boolean): MenuBuilder {
  return (court) => {
    if (sentWithMaid ? !maidWith(court, YOU) : !areTogether(court, YOU, recipientId)) return null;
    const lady = you(court);
    const name = nameOf(court, recipientId);
    const outranksYou = isRankedAbove(court, recipientId, lady);
    const notes: string[] = [];
    if (lady.today.giftedTo.filter((id) => id === recipientId).length >= GIFTING.countedPerRecipientPerDay) {
      notes.push(`You have already given ${name} a gift today. Another would be paid for and change nothing.`);
    }
    const options = GIFT_ORDER.map((gift): MenuOption => {
      const rule = GIFTS[gift];
      const cost = `${rule.cost} taels · ${energy(ENERGY.socializing)} · Day only`;
      let worth: string;
      if (rule.rolledOn !== null) {
        worth = `its quality comes from your ${TALENT_NAME[rule.rolledOn]} (${lady.talents[rule.rolledOn]})`;
      } else {
        const halved = outranksYou && !rule.fullValueToHigherRanks;
        const value = rule.relationship ?? 0;
        worth = halved ? `${signed(Math.floor(value * GIFTING.higherRankMultiplier))} (half: ${name} outranks you)` : signed(value);
      }
      return {
        label: GIFT_NAME[gift],
        detail: `${cost} · ${worth}`,
        intent: { type: 'give_gift', actorId: YOU, recipientId, gift, sentWithMaid },
      };
    });
    return { title: `A gift for ${name}`, subtitle: `You have ${lady.silver} taels`, notes, options };
  };
}

function silverMenu(recipientId: CharacterId, sentWithMaid: boolean): MenuBuilder {
  return (court) => {
    if (sentWithMaid ? !maidWith(court, YOU) : !areTogether(court, YOU, recipientId)) return null;
    const name = nameOf(court, recipientId);
    const isPlayer = court.characters[recipientId]?.controller.kind === 'player';
    return {
      title: `Silver for ${name}`,
      subtitle: `You have ${you(court).silver} taels`,
      notes: isPlayer ? [`${capital(name)} is another player: at most ${TRANSFER.playerToPlayerCapPerDay} taels a day between players.`] : [],
      options: SILVER_CHOICES.map((amount) => ({
        label: `${amount} taels`,
        detail: 'Any time',
        intent: { type: 'give_silver', actorId: YOU, recipientId, amount, sentWithMaid },
      })),
    };
  };
}

function recipientMenu(what: 'gift' | 'silver'): MenuBuilder {
  return (court) => {
    const maid = maidWith(court, YOU);
    if (!maid) return null;
    return {
      title: what === 'gift' ? `${maid.name} carries a gift` : `${maid.name} carries silver`,
      subtitle: 'Who is it for?',
      notes: [],
      // The Empress Dowager accepts gifts but keeps no purse, so silver cannot be sent to her.
      options: everyoneElse(court)
        .filter((id) => what === 'gift' || court.characters[id] !== undefined)
        .map((id) => {
          const character = court.characters[id];
          const rank = character ? RANK_NAME[character.rank] : 'Always an NPC';
          return {
            label: capital(nameOf(court, id)),
            detail: `${rank} · relationship ${relationshipBetween(court, YOU, id)}`,
            submenu: what === 'gift' ? giftMenu(id, true) : silverMenu(id, true),
          };
        }),
    };
  };
}

function shopMenu(): MenuBuilder {
  return (court) => {
    const maid = maidWith(court, YOU);
    if (!maid) return null;
    return {
      title: `${maid.name} goes to buy`,
      subtitle: `You have ${you(court).silver} taels`,
      notes: [],
      options: SHOP_ORDER.map((item) => ({
        label: ITEM_NAME[item],
        detail: `${SHOP_PRICE[item]} taels · Any time`,
        intent: { type: 'buy', actorId: YOU, item },
      })),
    };
  };
}

/** Talking to a lady or a guard. */
export function personMenu(targetId: CharacterId): MenuBuilder {
  return (court) => {
    const target = court.characters[targetId];
    if (!target) return null;
    const problem = whyCannotApproach(court, YOU, targetId);
    if (problem === 'not_with_that_person') return null;

    const name = target.name;
    const bowsTo = respectsGoTo(court, you(court))?.id === targetId;
    const subtitle = [
      RANK_NAME[target.rank],
      bowsTo ? 'your palace mistress' : null,
      `relationship ${relationshipBetween(court, YOU, targetId)}`,
    ]
      .filter((part) => part !== null)
      .join(' · ');
    if (problem !== null) {
      return {
        title: capital(name),
        subtitle,
        notes: [
          `${capital(name)} is in her own room and does not wish to be disturbed. Find her in the main hall or out walking, or become close to her first (relationship ${PRIVATE_ROOM.welcomeFromRelationship}).`,
        ],
        options: [],
      };
    }

    const options: MenuOption[] = [];
    if (bowsTo) {
      options.push({
        label: 'Pay your Morning respects',
        detail: `Free · Morning only · ${signed(RELATIONSHIP_CHANGE.respectsOrGreeting)} with her`,
        intent: { type: 'pay_respects', actorId: YOU },
      });
    }
    options.push(
      {
        label: `Greet ${name}`,
        detail: `${energy(ENERGY.socializing)} · Day only · ${signed(RELATIONSHIP_CHANGE.respectsOrGreeting)}, once a day`,
        intent: { type: 'greet', actorId: YOU, targetId },
      },
      { label: 'Give a gift…', detail: 'Homemade or bought · Day only', submenu: giftMenu(targetId, false) },
      { label: 'Give silver…', detail: 'Any time', submenu: silverMenu(targetId, false) },
    );
    return { title: capital(name), subtitle, notes: [], options };
  };
}

/** Talking to a servant: your own maid, or one of the palace staff. */
export function servantMenu(servantId: string): MenuBuilder {
  return (court) => {
    const servant = court.servants[servantId];
    if (!servant || !areTogether(court, YOU, servantId)) return null;
    const options: MenuOption[] = [];
    const isYours = servant.servesId === YOU;
    if (isYours) {
      options.push(
        {
          label: `Tip ${servant.name}`,
          detail: `${TIP.cost} taels · Any time · Loyalty +${TIP.loyaltyGain}, up to +${TIP.maxLoyaltyPerDay} a day`,
          intent: { type: 'tip_servant', actorId: YOU, servantId },
        },
        { label: 'Send her with a gift…', detail: 'To anyone, wherever they are · Day only', submenu: recipientMenu('gift') },
        { label: 'Send her with silver…', detail: 'To anyone, wherever they are', submenu: recipientMenu('silver') },
        { label: 'Send her to buy…', detail: 'Cosmetics, the physician, ingredients', submenu: shopMenu() },
      );
    }
    const place = placeOf(court, YOU);
    for (const spot of place?.spots ?? []) {
      if (SPOT_LED_BY[spot] !== servant.role) continue;
      const [talent] = ACTIVITY_SPOT_RULES[spot].talents;
      options.push({
        label: LED_LABEL[servant.role] ?? `Work alongside ${servant.name}`,
        detail: trainingDetail(court, spot, talent ?? null),
        intent: { type: 'train', actorId: YOU, spot },
      });
    }
    options.push(gossipOption(court, servant.role === 'eunuch' ? 'Gossip with him' : 'Gossip with her'));
    return {
      title: servant.name,
      subtitle: isYours ? `Your maid · Loyalty ${servant.loyalty}` : ROLE_NAME[servant.role],
      notes: [],
      options,
    };
  };
}

function spotOptions(court: CourtState, memory: MenuMemory, place: Place, spot: ActivitySpot, notes: string[]): MenuOption[] {
  const options: MenuOption[] = [];
  const regular = regularPresent(court, place, spot, YOU);
  const mustAsk = regular !== null && relationshipBetween(court, YOU, regular.id) < STEPPING_ON_TOES.safeFromRelationship;
  const asked = regular !== null && memory.hasAsked(regular.id);
  if (regular && mustAsk && !asked) {
    notes.push(
      `${capital(regular.name)} is the regular here, and she is in the room. Practising without asking costs ${STEPPING_ON_TOES.relationshipLoss} with her.`,
    );
    options.push({ label: `Ask ${regular.name} if you may practise here`, detail: 'Free', askRegularId: regular.id });
  }
  for (const talent of ACTIVITY_SPOT_RULES[spot].talents) {
    options.push({
      label: PRACTISE[talent],
      detail: trainingDetail(court, spot, talent),
      intent: { type: 'train', actorId: YOU, spot, talent, askedFirst: asked },
    });
  }
  for (const work of WORKS) {
    if (SELLING_WORK.madeAt[work] !== spot) continue;
    options.push({
      label: MAKE_TO_SELL[work],
      detail: `${energy(ENERGY.training)} · Day only · one piece a day, paid by its quality`,
      intent: { type: 'sell_work', actorId: YOU, work },
    });
  }
  return options;
}

/** Using the room she is standing in. Null when the room has nothing to do in it. */
export function placeMenu(placeId: string): MenuBuilder {
  return (court, memory) => {
    const place = court.places[placeId];
    if (!place || placeOf(court, YOU)?.id !== placeId) return null;
    const notes: string[] = [];
    const options: MenuOption[] = [];

    const servantsHere = peopleIn(court, place.id).flatMap((id) => court.servants[id] ?? []);
    for (const spot of place.spots) {
      const leader = SPOT_LED_BY[spot];
      if (!leader) {
        options.push(...spotOptions(court, memory, place, spot, notes));
        continue;
      }
      // Work done alongside a servant is offered by talking to her. A whole courtyard needs no note.
      if (place.kind === 'courtyard') continue;
      const servant = servantsHere.find((entry) => entry.role === leader);
      const [talent] = ACTIVITY_SPOT_RULES[spot].talents;
      const what = talent ? `practise ${TALENT_NAME[talent].toLowerCase()}` : 'help';
      notes.push(servant ? `Talk to ${servant.name} to ${what}.` : (AWAY_NOTE[leader] ?? 'The servant who works here is away.'));
    }
    if (place.kind === 'private_room' && place.ownerId === YOU) {
      options.push({
        label: 'Doll up at the dressing table',
        detail: `${energy(DOLL_UP.energyCost)} · Day only · Beauty +${dollUpBonusFor(you(court).talents.makeup)} for today`,
        intent: { type: 'doll_up', actorId: YOU },
      });
    }
    if (place.kind === 'gate') {
      notes.push('The gate is shut to attendants without a day pass. Day passes arrive with the movement rules, which are not built yet.');
    }
    if (options.length === 0 && notes.length === 0) return null;
    return { title: capital(place.name), subtitle: '', notes, options };
  };
}
