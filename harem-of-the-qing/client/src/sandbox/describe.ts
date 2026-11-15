/** Turns the events a rule returns into sentences a tester can read. */
import type { GameEvent } from '../../../shared/events';
import { EMPRESS_DOWAGER_ID, type CharacterId, type CourtState } from '../../../shared/types';
import { YOU } from './demoCourt';
import {
  ATTRIBUTE_NAME,
  CAUSE_TEXT,
  GIFT_PHRASE,
  ITEM_PHRASE,
  PHASE_NAME,
  REJECTION_TEXT,
  SPOT_NAME,
  TALENT_NAME,
  WORK_PHRASE,
} from './labels';

export type Tone = 'good' | 'bad' | 'plain' | 'refused' | 'clock';

export interface LogLine {
  readonly text: string;
  readonly tone: Tone;
  /** The characters this line is about. Empty for news the whole court shares. */
  readonly about: readonly CharacterId[];
}

export function nameOf(court: CourtState, id: string): string {
  if (id === EMPRESS_DOWAGER_ID) return 'the Empress Dowager';
  return court.characters[id]?.name ?? court.servants[id]?.name ?? id;
}

/** "You" at the start of a sentence, or the character's name. */
function subject(court: CourtState, id: CharacterId): string {
  if (id === YOU) return 'You';
  const name = nameOf(court, id);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "you" inside a sentence, or the character's name. */
function object(court: CourtState, id: CharacterId): string {
  return id === YOU ? 'you' : nameOf(court, id);
}

function signed(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

function pair(court: CourtState, between: readonly [CharacterId, CharacterId]): string {
  const [first, second] = between[1] === YOU ? [between[1], between[0]] : between;
  return `${subject(court, first)} and ${object(court, second)}`;
}

/** One sentence for one event, or null for an event that needs no line of its own. */
export function describeEvent(event: GameEvent, court: CourtState): LogLine | null {
  switch (event.type) {
    case 'rejected':
      return {
        text: `Not allowed: ${REJECTION_TEXT[event.reason]}`,
        tone: 'refused',
        about: event.actorId ? [event.actorId] : [],
      };
    case 'phase_changed':
      return { text: `Day ${event.day} · ${PHASE_NAME[event.phase]}`, tone: 'clock', about: [] };
    case 'day_started':
      return null;
    case 'energy_lost':
      return {
        text: `${subject(court, event.characterId)} lost ${event.amount} unspent energy as Night fell.`,
        tone: 'plain',
        about: [event.characterId],
      };
    case 'energy_restored':
      return {
        text:
          event.energy > 0
            ? `${subject(court, event.characterId)} woke with ${event.energy} energy.`
            : `${subject(court, event.characterId)} woke with no energy: illness.`,
        tone: event.energy > 0 ? 'plain' : 'bad',
        about: [event.characterId],
      };
    case 'stipend_paid':
      return {
        text: `${subject(court, event.characterId)} received a stipend of ${event.amount} taels.`,
        tone: 'good',
        about: [event.characterId],
      };
    case 'trained': {
      const gains: string[] = [];
      if (event.talent) gains.push(`${TALENT_NAME[event.talent]} ${signed(event.talentGain)}`);
      if (event.attribute) gains.push(`${ATTRIBUTE_NAME[event.attribute]} ${signed(event.attributeGain)}`);
      return {
        text: `${subject(court, event.characterId)} trained (${SPOT_NAME[event.spot]}): ${gains.join(', ') || 'nothing gained'}.`,
        tone: 'good',
        about: [event.characterId],
      };
    }
    case 'dolled_up':
      return {
        text: `${subject(court, event.characterId)} dolled up: Beauty +${event.beautyBonus} for today.`,
        tone: 'good',
        about: [event.characterId],
      };
    case 'relationship_changed':
      return {
        text: `${pair(court, event.between)}: relationship ${event.from} → ${event.to} (${CAUSE_TEXT[event.cause]}).`,
        tone: event.to > event.from ? 'good' : 'bad',
        about: event.between,
      };
    case 'became_friends':
      return { text: `${pair(court, event.between)} became friends.`, tone: 'good', about: event.between };
    case 'friendship_ended':
      return { text: `${pair(court, event.between)} stopped being friends.`, tone: 'bad', about: event.between };
    case 'became_hated':
      return {
        text: `${subject(court, event.characterId)} became hated by the harem.`,
        tone: 'bad',
        about: [event.characterId],
      };
    case 'no_longer_hated':
      return {
        text: `${subject(court, event.characterId)} stopped being hated by the harem.`,
        tone: 'good',
        about: [event.characterId],
      };
    case 'servant_loyalty_changed': {
      const servesId = court.servants[event.servantId]?.servesId;
      const why = event.cause === 'tip' ? 'a tip' : 'her mistress became hated';
      return {
        text: `${nameOf(court, event.servantId)} the maid: Loyalty ${event.from} → ${event.to} (${why}).`,
        tone: event.to > event.from ? 'good' : 'bad',
        about: servesId ? [servesId] : [],
      };
    }
    case 'respects_paid':
      return {
        text: `${subject(court, event.characterId)} paid Morning respects to ${object(court, event.toId)}.`,
        tone: 'plain',
        about: [event.characterId, event.toId],
      };
    case 'respects_skipped':
      return {
        text: `${subject(court, event.characterId)} skipped Morning respects to ${object(court, event.toId)}: Obedience ${event.obedienceFrom} → ${event.obedienceTo}.`,
        tone: 'bad',
        about: [event.characterId, event.toId],
      };
    case 'greeted':
      return {
        text: `${subject(court, event.characterId)} greeted ${object(court, event.targetId)}.`,
        tone: 'plain',
        about: [event.characterId, event.targetId],
      };
    case 'purchased':
      return {
        text: `${subject(court, event.characterId)} bought ${ITEM_PHRASE[event.item]} for ${event.cost} taels.`,
        tone: 'plain',
        about: [event.characterId],
      };
    case 'illness_cured':
      return { text: `${subject(court, event.characterId)} recovered from illness.`, tone: 'good', about: [event.characterId] };
    case 'childbearing_restored':
      return {
        text: `Childbearing ${event.from} → ${event.to}.`,
        tone: 'good',
        about: [event.characterId],
      };
    case 'servant_tipped':
      return {
        text: `${subject(court, event.characterId)} tipped ${nameOf(court, event.servantId)} ${event.cost} taels.`,
        tone: 'plain',
        about: [event.characterId],
      };
    case 'work_sold':
      return {
        text:
          event.price > 0
            ? `${subject(court, event.characterId)} sold ${WORK_PHRASE[event.work]} of quality ${event.quality} for ${event.price} taels.`
            : `${subject(court, event.characterId)} made ${WORK_PHRASE[event.work]} of quality ${event.quality}. The eunuch paid nothing for it.`,
        tone: event.price > 0 ? 'good' : 'bad',
        about: [event.characterId],
      };
    case 'silver_given':
      return {
        text: `${subject(court, event.fromId)} gave ${object(court, event.toId)} ${event.amount} taels.`,
        tone: 'plain',
        about: [event.fromId, event.toId],
      };
    case 'gift_given': {
      const parts = [
        `${subject(court, event.giverId)} gave ${object(court, event.recipientId)} ${GIFT_PHRASE[event.gift]} (${event.cost} taels).`,
      ];
      if (event.quality !== null && event.band !== null) parts.push(`Its quality was ${event.quality}: a ${event.band} gift.`);
      if (!event.counted) parts.push('It changed nothing: only the first gift to each person in a day counts.');
      if (event.halved) parts.push('Worth half, because the recipient is ranked higher.');
      return { text: parts.join(' '), tone: 'plain', about: [event.giverId, event.recipientId] };
    }
    case 'place_entered':
      return null;
    case 'walked_in_on': {
      const who = object(court, event.onId);
      switch (event.outcome) {
        case 'charged':
          return {
            text: `${subject(court, event.characterId)} walked in on ${who} in her own room.`,
            tone: 'bad',
            about: [event.characterId, event.onId],
          };
        case 'welcome':
          return {
            text: `${subject(court, event.characterId)} stepped into ${who}'s room and found a welcome there.`,
            tone: 'good',
            about: [event.characterId, event.onId],
          };
        case 'already_counted':
          return {
            text: `${subject(court, event.characterId)} walked in on ${who} again. It has already cost its price today.`,
            tone: 'plain',
            about: [event.characterId, event.onId],
          };
        default: {
          const unknown: never = event.outcome;
          throw new Error(`Unknown outcome: ${String(unknown)}`);
        }
      }
    }
    case 'whereabouts_changed': {
      const place = event.to === null ? null : court.places[event.to];
      const name = nameOf(court, event.id);
      const who = name.charAt(0).toUpperCase() + name.slice(1);
      return {
        text: place ? `${who} went to ${place.name}.` : `${who} left the palace grounds.`,
        tone: 'plain',
        about: [event.id],
      };
    }
    case 'maid_sent': {
      const maid = nameOf(court, event.servantId);
      const errand = { gift: 'with a gift', silver: 'with silver', shopping: 'out to buy something' }[event.errand];
      return {
        text: `${subject(court, event.characterId)} sent ${maid} ${errand}.`,
        tone: 'plain',
        about: [event.characterId],
      };
    }
    default: {
      const unknown: never = event;
      throw new Error(`Unknown event: ${JSON.stringify(unknown)}`);
    }
  }
}

export function describeEvents(events: readonly GameEvent[], court: CourtState): LogLine[] {
  return events.map((event) => describeEvent(event, court)).filter((line): line is LogLine => line !== null);
}
