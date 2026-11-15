/**
 * Where everyone is. Section 13.10 to 13.12 of GAME_LOGIC.md: the rooms of a palace, walking
 * in on a lady in her own room, and where the court's NPCs and servants spend each phase.
 */
import { ACTIVITY_SPOT_RULES, PRIVATE_ROOM } from '../balance';
import type { Rng } from '../rng';
import {
  ACTIVITY_SPOTS,
  LADY_TALENTS,
  type ActivitySpot,
  type Character,
  type CharacterId,
  type CourtState,
  type Lady,
  type LadyTalent,
  type Phase,
  type Place,
  type PlaceId,
  type PlaceKind,
  type Servant,
} from '../types';
import {
  allLadies,
  andThen,
  getCharacter,
  isExiled,
  rankNumber,
  rejected,
  unchanged,
  withCharacter,
  type RuleResult,
} from './core';
import { isRankedAbove } from './gifting';
import { changeRelationship, palaceMistress, relationshipBetween } from './relationships';

export interface EnterPlaceIntent {
  readonly type: 'enter_place';
  readonly actorId: CharacterId;
  /** The place she steps into, or null when she steps out of every mapped place. */
  readonly placeId: PlaceId | null;
}

/** The place a character or servant is in, or null when they are out of reach. */
export function placeOf(state: CourtState, id: string): Place | null {
  const placeId = state.whereabouts[id];
  return placeId === undefined ? null : (state.places[placeId] ?? null);
}

/** Whether two people (characters or servants) are in the same place. */
export function areTogether(state: CourtState, a: string, b: string): boolean {
  const place = state.whereabouts[a];
  return place !== undefined && place === state.whereabouts[b];
}

/** Everyone standing in a place: character ids and servant ids. */
export function peopleIn(state: CourtState, placeId: PlaceId): string[] {
  return Object.keys(state.whereabouts).filter((id) => state.whereabouts[id] === placeId);
}

export function ownRoomOf(state: CourtState, ladyId: CharacterId): Place | null {
  return Object.values(state.places).find((place) => place.kind === 'private_room' && place.ownerId === ladyId) ?? null;
}

/** Whether she is standing in her own room. */
export function isInOwnRoom(state: CourtState, ladyId: CharacterId): boolean {
  const place = placeOf(state, ladyId);
  return place !== null && place.kind === 'private_room' && place.ownerId === ladyId;
}

/**
 * Whether a visitor may walk into the owner's room and speak to her there: they are close
 * enough, or the visitor outranks her.
 */
export function isWelcomeInRoomOf(state: CourtState, visitor: Character, ownerId: CharacterId): boolean {
  const owner = getCharacter(state, ownerId);
  if (owner && isRankedAbove(state, visitor.id, owner)) return true;
  return relationshipBetween(state, visitor.id, ownerId) >= PRIVATE_ROOM.welcomeFromRelationship;
}

function withWhereabouts(state: CourtState, id: string, placeId: PlaceId | null): CourtState {
  const { [id]: _previous, ...others } = state.whereabouts;
  return { ...state, whereabouts: placeId === null ? others : { ...others, [id]: placeId } };
}

/**
 * A character steps into a place. Walking into another lady's own room while she is in it
 * costs relationship with her, unless the visitor is welcome there.
 */
export function enterPlace(state: CourtState, intent: EnterPlaceIntent): RuleResult {
  const actor = getCharacter(state, intent.actorId);
  if (!actor) return rejected(state, intent.type, intent.actorId, 'unknown_character');
  const place = intent.placeId === null ? null : (state.places[intent.placeId] ?? null);
  if (intent.placeId !== null && !place) return rejected(state, intent.type, actor.id, 'unknown_place');
  if ((state.whereabouts[actor.id] ?? null) === intent.placeId) return unchanged(state);

  const entered: RuleResult = {
    state: withWhereabouts(state, actor.id, intent.placeId),
    events: [{ type: 'place_entered', characterId: actor.id, placeId: intent.placeId }],
  };
  if (!place || place.kind !== 'private_room' || place.ownerId === null || place.ownerId === actor.id) return entered;
  const ownerId = place.ownerId;
  if (state.whereabouts[ownerId] !== place.id) return entered;

  const alreadyToday = actor.today.walkedInOn.filter((id) => id === ownerId).length;
  const outcome = isWelcomeInRoomOf(state, actor, ownerId)
    ? 'welcome'
    : alreadyToday >= PRIVATE_ROOM.lossesPerLadyPerDay
      ? 'already_counted'
      : 'charged';
  const walkedIn: RuleResult = {
    state: entered.state,
    events: [...entered.events, { type: 'walked_in_on', characterId: actor.id, onId: ownerId, placeId: place.id, outcome }],
  };
  if (outcome !== 'charged') return walkedIn;

  const noted = withCharacter(walkedIn.state, {
    ...actor,
    today: { ...actor.today, walkedInOn: [...actor.today.walkedInOn, ownerId] },
  });
  return andThen({ state: noted, events: walkedIn.events }, (current) =>
    changeRelationship(current, actor.id, ownerId, -PRIVATE_ROOM.relationshipLoss, 'walked_in_on_her'),
  );
}

/** The activity spot that trains a lady's highest talent: the one she is a regular at. */
export function favouriteSpot(lady: Lady): ActivitySpot | null {
  let best: LadyTalent = LADY_TALENTS[0];
  for (const talent of LADY_TALENTS) {
    if (lady.talents[talent] > lady.talents[best]) best = talent;
  }
  return ACTIVITY_SPOTS.find((spot) => ACTIVITY_SPOT_RULES[spot].talents.includes(best)) ?? null;
}

/**
 * "Each activity spot has a regular, usually the highest-ranked lady who trains there." The
 * regular of a spot is the highest-ranked lady of that palace whose favourite spot it is.
 */
export function spotRegular(state: CourtState, place: Place, spot: ActivitySpot): Lady | null {
  let regular: Lady | null = null;
  for (const lady of allLadies(state)) {
    if (lady.palaceId !== place.palaceId || favouriteSpot(lady) !== spot) continue;
    if (regular === null || rankNumber(lady) > rankNumber(regular)) regular = lady;
  }
  return regular;
}

/** The spot's regular when she is standing in the place right now, and is not the one asking. */
export function regularPresent(state: CourtState, place: Place, spot: ActivitySpot, actorId: CharacterId): Lady | null {
  const regular = spotRegular(state, place, spot);
  if (!regular || regular.id === actorId || state.whereabouts[regular.id] !== place.id) return null;
  return regular;
}

type Haunt = 'main_hall' | 'courtyard' | 'own_room' | 'favourite_spot';

/** 13.12 Where a palace mistress may be found in each phase. */
const MISTRESS_HAUNTS: Readonly<Record<Phase, readonly Haunt[]>> = {
  morning: ['main_hall'],
  day: ['main_hall', 'courtyard', 'own_room'],
  evening: ['main_hall', 'own_room'],
  night: ['own_room'],
};

/** 13.12 Where the other ladies of a palace may be found in each phase. */
const LADY_HAUNTS: Readonly<Record<Phase, readonly Haunt[]>> = {
  morning: ['main_hall'],
  day: ['favourite_spot', 'courtyard', 'own_room'],
  evening: ['courtyard', 'own_room'],
  night: ['own_room'],
};

function placesOfPalace(state: CourtState, palaceId: string): Place[] {
  return Object.values(state.places).filter((place) => place.palaceId === palaceId);
}

function firstOfKind(places: readonly Place[], kind: PlaceKind): Place | null {
  return places.find((place) => place.kind === kind) ?? null;
}

function firstWithSpot(places: readonly Place[], spot: ActivitySpot | null): Place | null {
  return spot === null ? null : (places.find((place) => place.spots.includes(spot)) ?? null);
}

function ladyHaunt(state: CourtState, lady: Lady, haunt: Haunt, places: readonly Place[]): Place | null {
  switch (haunt) {
    case 'main_hall':
      return firstOfKind(places, 'main_hall');
    case 'courtyard':
      return firstOfKind(places, 'courtyard');
    case 'own_room': {
      const room = ownRoomOf(state, lady.id);
      return room && room.palaceId === lady.palaceId ? room : null;
    }
    case 'favourite_spot':
      return firstWithSpot(places, favouriteSpot(lady));
    default: {
      const unknown: never = haunt;
      throw new Error(`Unknown haunt: ${String(unknown)}`);
    }
  }
}

function idsOf(places: readonly (Place | null)[]): PlaceId[] {
  const ids = places.filter((place): place is Place => place !== null).map((place) => place.id);
  return [...new Set(ids)];
}

/** The places an NPC character may be found in during the current phase. Empty: nowhere mapped. */
export function usualPlacesOfCharacter(state: CourtState, character: Character): PlaceId[] {
  if (isExiled(character, state.day)) return [];
  const places = placesOfPalace(state, character.palaceId);
  if (character.path === 'guard') return idsOf([firstOfKind(places, 'gate')]);
  const isMistress = palaceMistress(state, character.palaceId)?.id === character.id;
  const haunts = (isMistress ? MISTRESS_HAUNTS : LADY_HAUNTS)[state.phase];
  return idsOf(haunts.map((haunt) => ladyHaunt(state, character, haunt, places)));
}

/** The places a servant may be found in during the current phase. Empty: nowhere mapped. */
export function usualPlacesOfServant(state: CourtState, servant: Servant): PlaceId[] {
  const places = placesOfPalace(state, servant.palaceId);
  const quarters = firstOfKind(places, 'servants_quarters');
  const atNight = state.phase === 'night';
  switch (servant.role) {
    case 'personal_maid': {
      const room = servant.servesId === null ? null : ownRoomOf(state, servant.servesId);
      return idsOf([room && room.palaceId === servant.palaceId ? room : quarters]);
    }
    case 'cook':
      return idsOf([atNight ? quarters : firstWithSpot(places, 'kitchen')]);
    case 'eunuch':
      return idsOf([atNight || state.phase === 'evening' ? quarters : firstOfKind(places, 'courtyard')]);
    case 'guard':
      return idsOf([firstOfKind(places, 'gate')]);
    default: {
      const unknown: never = servant.role;
      throw new Error(`Unknown servant role: ${String(unknown)}`);
    }
  }
}

function moveTo(result: RuleResult, id: string, options: readonly PlaceId[], rng: Rng): RuleResult {
  const from = result.state.whereabouts[id] ?? null;
  const to = options.length === 0 ? null : (options[rng.int(0, options.length - 1)] ?? null);
  if (from === to) return result;
  return {
    state: withWhereabouts(result.state, id, to),
    events: [...result.events, { type: 'whereabouts_changed', id, from, to }],
  };
}

/**
 * The court stirs: every NPC and every servant moves to one of the places they may be found
 * in during this phase. The server runs this when a phase starts, and a few more times within
 * it. Players are never moved; they walk themselves.
 */
export function stirCourt(state: CourtState, rng: Rng): RuleResult {
  let result = unchanged(state);
  for (const character of Object.values(state.characters)) {
    if (character.controller.kind !== 'npc') continue;
    result = moveTo(result, character.id, usualPlacesOfCharacter(state, character), rng);
  }
  for (const servant of Object.values(state.servants)) {
    result = moveTo(result, servant.id, usualPlacesOfServant(state, servant), rng);
  }
  return result;
}
