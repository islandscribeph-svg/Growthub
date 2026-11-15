import { describe, expect, it } from 'vitest';
import { GIFTS, PRIVATE_ROOM, SHOP_PRICE, STEPPING_ON_TOES, TIP } from '../../../shared/balance';
import { act, type CourtIntent } from '../../../shared/rules/act';
import { wasRejected } from '../../../shared/rules/core';
import { createRng } from '../../../shared/rng';
import { rejectionReasons } from '../../../shared/testing/fixtures';
import { EMPRESS_DOWAGER_ID, type CourtState, type Phase } from '../../../shared/types';
import { helperAddSilver, helperSetRelationship } from '../sandbox/demoCourt';
import { personMenu, placeMenu, servantMenu, type MenuBuilder, type MenuMemory, type MenuOption, type MenuView } from './menus';
import { COOK_ID, EUNUCH_ID, GUARD_ID, MAID_ID, MISTRESS_ID, NEIGHBOUR_ID, PALACE_PLACES, YOU, createPalaceCourt } from './palaceCourt';

const NOBODY_ASKED: MenuMemory = { hasAsked: () => false };
const ASKED: MenuMemory = { hasAsked: () => true };
const PLENTY = 1000;

/** The palace with people put exactly where the test wants them. */
function court(whereabouts: Record<string, string>, phase: Phase = 'day'): CourtState {
  return { ...helperAddSilver(createPalaceCourt(), PLENTY), phase, whereabouts };
}

function closeTo(state: CourtState, otherId: string, relationship: number): CourtState {
  return helperSetRelationship(state, otherId, relationship).state;
}

function open(builder: MenuBuilder, state: CourtState, memory = NOBODY_ASKED): MenuView {
  const view = builder(state, memory);
  if (!view) throw new Error('expected a menu');
  return view;
}

function labels(view: MenuView): string[] {
  return view.options.map((option) => option.label);
}

function option(view: MenuView, label: string): MenuOption {
  const found = view.options.find((entry) => entry.label === label);
  if (!found) throw new Error(`no option "${label}" among: ${labels(view).join(', ')}`);
  return found;
}

function submenu(view: MenuView, label: string, state: CourtState): MenuView {
  const builder = option(view, label).submenu;
  if (!builder) throw new Error(`"${label}" opens nothing`);
  return open(builder, state);
}

describe('talking to a lady', () => {
  it('offers respects, a greeting, gifts and silver to the palace mistress in the main hall', () => {
    const view = open(personMenu(MISTRESS_ID), court({ [YOU]: 'main_hall', [MISTRESS_ID]: 'main_hall' }));
    expect(view.title).toBe('Consort Mei');
    expect(view.subtitle).toBe('Consort · your palace mistress · relationship 30');
    expect(labels(view)).toEqual(['Pay your Morning respects', 'Greet Consort Mei', 'Give a gift…', 'Give silver…']);
    expect(option(view, 'Greet Consort Mei').intent).toEqual({ type: 'greet', actorId: YOU, targetId: MISTRESS_ID });
    expect(option(view, 'Pay your Morning respects').intent).toEqual({ type: 'pay_respects', actorId: YOU });
  });

  it('offers the same when she is out walking in the courtyard', () => {
    const view = open(personMenu(MISTRESS_ID), court({ [YOU]: 'courtyard', [MISTRESS_ID]: 'courtyard' }));
    expect(labels(view)).toContain('Greet Consort Mei');
  });

  it('does not offer respects to a lady she does not bow to', () => {
    const view = open(personMenu(NEIGHBOUR_ID), court({ [YOU]: 'courtyard', [NEIGHBOUR_ID]: 'courtyard' }));
    expect(labels(view)).toEqual(['Greet Attendant Yu', 'Give a gift…', 'Give silver…']);
  });

  it('offers nothing but an explanation when the mistress is in her own room', () => {
    const view = open(personMenu(MISTRESS_ID), court({ [YOU]: 'mistress_room', [MISTRESS_ID]: 'mistress_room' }));
    expect(view.options).toEqual([]);
    expect(view.notes).toHaveLength(1);
    expect(view.notes[0]).toContain('does not wish to be disturbed');
    expect(view.notes[0]).toContain(`relationship ${PRIVATE_ROOM.welcomeFromRelationship}`);
  });

  it('lets a close friend talk to her in her own room', () => {
    const state = closeTo(court({ [YOU]: 'mistress_room', [MISTRESS_ID]: 'mistress_room' }), MISTRESS_ID, PRIVATE_ROOM.welcomeFromRelationship);
    expect(labels(open(personMenu(MISTRESS_ID), state))).toContain('Greet Consort Mei');
  });

  it('has no menu for someone who is in another room, out of the palace, or unknown', () => {
    expect(personMenu(MISTRESS_ID)(court({ [YOU]: 'main_hall', [MISTRESS_ID]: 'courtyard' }), NOBODY_ASKED)).toBeNull();
    expect(personMenu('empress')(court({ [YOU]: 'main_hall' }), NOBODY_ASKED)).toBeNull();
    expect(personMenu('nobody')(court({ [YOU]: 'main_hall' }), NOBODY_ASKED)).toBeNull();
  });

  it('offers a greeting, gifts and silver to the guard at the gate', () => {
    const view = open(personMenu(GUARD_ID), court({ [YOU]: 'palace_gate', [GUARD_ID]: 'palace_gate' }));
    expect(labels(view)).toEqual(['Greet Guard Bo', 'Give a gift…', 'Give silver…']);
  });
});

describe('giving in person', () => {
  const together = court({ [YOU]: 'main_hall', [MISTRESS_ID]: 'main_hall' });

  it('lists every gift with its price, and warns that a higher rank halves a bought gift', () => {
    const gifts = submenu(open(personMenu(MISTRESS_ID), together), 'Give a gift…', together);
    expect(labels(gifts)).toEqual(['Homemade dish', 'Homemade sewn item', 'Trinket', 'Fine jewelry', 'Rare treasure']);
    expect(option(gifts, 'Trinket').detail).toContain(`${GIFTS.trinket.cost} taels`);
    expect(option(gifts, 'Trinket').detail).toContain('half: Consort Mei outranks you');
    expect(option(gifts, 'Rare treasure').detail).not.toContain('half');
    expect(option(gifts, 'Trinket').intent).toEqual({
      type: 'give_gift',
      actorId: YOU,
      recipientId: MISTRESS_ID,
      gift: 'trinket',
      sentWithMaid: false,
    });
  });

  it('does not halve a gift to someone of lower rank', () => {
    const state = court({ [YOU]: 'palace_gate', [GUARD_ID]: 'palace_gate' });
    const gifts = submenu(open(personMenu(GUARD_ID), state), 'Give a gift…', state);
    expect(option(gifts, 'Trinket').detail).not.toContain('half');
  });

  it('warns when she has already given that person a gift today', () => {
    const given = act(together, { type: 'give_gift', actorId: YOU, recipientId: MISTRESS_ID, gift: 'trinket' }, createRng('gift'));
    expect(wasRejected(given)).toBe(false);
    const gifts = submenu(open(personMenu(MISTRESS_ID), given.state), 'Give a gift…', given.state);
    expect(gifts.notes[0]).toContain('already given Consort Mei a gift today');
  });

  it('offers a few amounts of silver', () => {
    const silver = submenu(open(personMenu(MISTRESS_ID), together), 'Give silver…', together);
    expect(labels(silver)).toEqual(['5 taels', '10 taels', '25 taels']);
    expect(option(silver, '10 taels').intent).toMatchObject({ type: 'give_silver', recipientId: MISTRESS_ID, amount: 10, sentWithMaid: false });
  });

  it('closes the gift and silver lists when she walks off', () => {
    const view = open(personMenu(MISTRESS_ID), together);
    const apart = court({ [YOU]: 'main_hall', [MISTRESS_ID]: 'courtyard' });
    expect(option(view, 'Give a gift…').submenu?.(apart, NOBODY_ASKED)).toBeNull();
    expect(option(view, 'Give silver…').submenu?.(apart, NOBODY_ASKED)).toBeNull();
  });
});

describe('talking to your maid', () => {
  const inYourRoom = court({ [YOU]: 'side_room_1', [MAID_ID]: 'side_room_1' });

  it('offers a tip, three errands and gossip', () => {
    const view = open(servantMenu(MAID_ID), inYourRoom);
    expect(view.title).toBe('Xiu');
    expect(view.subtitle).toBe('Your maid · Loyalty 50');
    expect(labels(view)).toEqual(['Tip Xiu', 'Send her with a gift…', 'Send her with silver…', 'Send her to buy…', 'Gossip with her']);
    expect(option(view, 'Tip Xiu').detail).toContain(`${TIP.cost} taels`);
    expect(option(view, 'Tip Xiu').intent).toEqual({ type: 'tip_servant', actorId: YOU, servantId: MAID_ID });
  });

  it('lets her carry a gift to anyone at court, wherever they are', () => {
    const recipients = submenu(open(servantMenu(MAID_ID), inYourRoom), 'Send her with a gift…', inYourRoom);
    expect(labels(recipients)).toContain('Consort Mei');
    expect(labels(recipients)).toContain('The Empress');
    expect(labels(recipients)).toContain('The Empress Dowager');
    expect(labels(recipients)).not.toContain('Lan');
    const gifts = submenu(recipients, 'The Empress', inYourRoom);
    expect(option(gifts, 'Trinket').intent).toMatchObject({ type: 'give_gift', recipientId: 'empress', sentWithMaid: true });
  });

  it('lets her carry silver', () => {
    const recipients = submenu(open(servantMenu(MAID_ID), inYourRoom), 'Send her with silver…', inYourRoom);
    const silver = submenu(recipients, 'The Empress', inYourRoom);
    expect(option(silver, '5 taels').intent).toMatchObject({ type: 'give_silver', recipientId: 'empress', sentWithMaid: true });
  });

  it('does not offer to send silver to the Empress Dowager, who keeps no purse', () => {
    const recipients = submenu(open(servantMenu(MAID_ID), inYourRoom), 'Send her with silver…', inYourRoom);
    expect(labels(recipients)).not.toContain('The Empress Dowager');
    const refused = act(inYourRoom, { type: 'give_silver', actorId: YOU, recipientId: EMPRESS_DOWAGER_ID, amount: 5, sentWithMaid: true }, createRng('purse'));
    expect(wasRejected(refused)).toBe(true);
  });

  it('warns about the daily limit when the silver is for another player', () => {
    const recipients = submenu(open(servantMenu(MAID_ID), inYourRoom), 'Send her with silver…', inYourRoom);
    expect(submenu(recipients, 'Qing', inYourRoom).notes[0]).toContain('another player');
    expect(submenu(recipients, 'Consort Mei', inYourRoom).notes).toEqual([]);
  });

  it('lists what she can buy, with the prices from the doc', () => {
    const shop = submenu(open(servantMenu(MAID_ID), inYourRoom), 'Send her to buy…', inYourRoom);
    expect(shop.options).toHaveLength(Object.keys(SHOP_PRICE).length);
    expect(option(shop, 'Premium cosmetics').detail).toContain(`${SHOP_PRICE.premium_cosmetics} taels`);
    expect(option(shop, 'Premium cosmetics').intent).toEqual({ type: 'buy', actorId: YOU, item: 'premium_cosmetics' });
  });

  it('has no menu, and closes her errand lists, when she is not in the room', () => {
    const apart = court({ [YOU]: 'main_hall', [MAID_ID]: 'side_room_1' });
    const view = open(servantMenu(MAID_ID), inYourRoom);
    expect(servantMenu(MAID_ID)(apart, NOBODY_ASKED)).toBeNull();
    expect(option(view, 'Send her with a gift…').submenu?.(apart, NOBODY_ASKED)).toBeNull();
    expect(option(view, 'Send her to buy…').submenu?.(apart, NOBODY_ASKED)).toBeNull();
    expect(servantMenu('nobody')(inYourRoom, NOBODY_ASKED)).toBeNull();
  });
});

describe('talking to the palace staff', () => {
  it('trains Cooking by cooking alongside the cook in the kitchen', () => {
    const view = open(servantMenu(COOK_ID), court({ [YOU]: 'kitchen', [COOK_ID]: 'kitchen' }));
    expect(view.subtitle).toBe('Palace cook');
    expect(labels(view)).toEqual(['Cook alongside her', 'Gossip with her']);
    expect(option(view, 'Cook alongside her').detail).toContain('Cooking +');
    expect(option(view, 'Cook alongside her').intent).toEqual({ type: 'train', actorId: YOU, spot: 'kitchen' });
  });

  it('only offers gossip when the cook is resting in the servants’ quarters', () => {
    const view = open(servantMenu(COOK_ID), court({ [YOU]: 'servants_quarters', [COOK_ID]: 'servants_quarters' }));
    expect(labels(view)).toEqual(['Gossip with her']);
  });

  it('offers courtyard chores with the eunuch in the courtyard', () => {
    const view = open(servantMenu(EUNUCH_ID), court({ [YOU]: 'courtyard', [EUNUCH_ID]: 'courtyard' }));
    expect(labels(view)).toEqual(['Help him sweep the courtyard', 'Gossip with him']);
    expect(option(view, 'Help him sweep the courtyard').intent).toEqual({ type: 'train', actorId: YOU, spot: 'courtyard_chores' });
  });

  it('does not offer a tip or errands to a servant who is not hers', () => {
    const view = open(servantMenu(COOK_ID), court({ [YOU]: 'kitchen', [COOK_ID]: 'kitchen' }));
    expect(labels(view).some((label) => label.startsWith('Tip') || label.startsWith('Send'))).toBe(false);
  });
});

describe('using a room', () => {
  it('offers reading, drawing and a drawing to sell in the study', () => {
    const view = open(placeMenu('study'), court({ [YOU]: 'study' }));
    expect(view.title).toBe('The study');
    expect(labels(view)).toEqual(['Read and write poetry', 'Practise drawing', 'Make a drawing to sell']);
    expect(option(view, 'Practise drawing').intent).toEqual({ type: 'train', actorId: YOU, spot: 'study', talent: 'drawing', askedFirst: false });
    expect(option(view, 'Make a drawing to sell').intent).toEqual({ type: 'sell_work', actorId: YOU, work: 'drawing' });
  });

  it('offers sewing and a piece to sell in the sewing room', () => {
    expect(labels(open(placeMenu('sewing_room'), court({ [YOU]: 'sewing_room' })))).toEqual(['Practise sewing', 'Sew a piece to sell']);
  });

  it('offers makeup in the dressing room and dancing on the terrace', () => {
    expect(labels(open(placeMenu('dressing_room'), court({ [YOU]: 'dressing_room' })))).toEqual(['Practise makeup at the mirror']);
    expect(labels(open(placeMenu('dance_terrace'), court({ [YOU]: 'dance_terrace' })))).toEqual(['Practise dancing']);
  });

  it('sends her to the cook in the kitchen, and says so when the cook is away', () => {
    const withCook = open(placeMenu('kitchen'), court({ [YOU]: 'kitchen', [COOK_ID]: 'kitchen' }));
    expect(withCook.options).toEqual([]);
    expect(withCook.notes).toEqual(['Talk to Cook Zhao to practise cooking.']);
    const empty = open(placeMenu('kitchen'), court({ [YOU]: 'kitchen', [COOK_ID]: 'servants_quarters' }));
    expect(empty.notes[0]).toContain('The cook is away');
  });

  it('offers to ask the regular first when she is in the room', () => {
    const state = court({ [YOU]: 'music_pavilion', [NEIGHBOUR_ID]: 'music_pavilion' });
    const view = open(placeMenu('music_pavilion'), state);
    expect(labels(view)).toEqual(['Ask Attendant Yu if you may practise here', 'Practise an instrument', 'Practise singing']);
    expect(option(view, 'Ask Attendant Yu if you may practise here').askRegularId).toBe(NEIGHBOUR_ID);
    expect(view.notes[0]).toContain(`costs ${STEPPING_ON_TOES.relationshipLoss} with her`);
    expect(option(view, 'Practise singing').intent).toMatchObject({ askedFirst: false });
  });

  it('remembers that she asked', () => {
    const state = court({ [YOU]: 'music_pavilion', [NEIGHBOUR_ID]: 'music_pavilion' });
    const view = open(placeMenu('music_pavilion'), state, ASKED);
    expect(labels(view)).toEqual(['Practise an instrument', 'Practise singing']);
    expect(view.notes).toEqual([]);
    expect(option(view, 'Practise singing').intent).toMatchObject({ askedFirst: true });
  });

  it('has no need to ask when the regular is elsewhere, or is a close friend', () => {
    const away = court({ [YOU]: 'music_pavilion', [NEIGHBOUR_ID]: 'courtyard' });
    expect(labels(open(placeMenu('music_pavilion'), away))).toEqual(['Practise an instrument', 'Practise singing']);
    const friends = closeTo(court({ [YOU]: 'music_pavilion', [NEIGHBOUR_ID]: 'music_pavilion' }), NEIGHBOUR_ID, STEPPING_ON_TOES.safeFromRelationship);
    expect(labels(open(placeMenu('music_pavilion'), friends))).toEqual(['Practise an instrument', 'Practise singing']);
  });

  it('offers the dressing table in her own room only', () => {
    const own = open(placeMenu('side_room_1'), court({ [YOU]: 'side_room_1' }));
    expect(labels(own)).toEqual(['Doll up at the dressing table']);
    expect(option(own, 'Doll up at the dressing table').intent).toEqual({ type: 'doll_up', actorId: YOU });
    expect(placeMenu('side_room_2')(court({ [YOU]: 'side_room_2' }), NOBODY_ASKED)).toBeNull();
    expect(placeMenu('mistress_room')(court({ [YOU]: 'mistress_room' }), NOBODY_ASKED)).toBeNull();
  });

  it('explains at the gate that day passes are not built yet', () => {
    const view = open(placeMenu('palace_gate'), court({ [YOU]: 'palace_gate' }));
    expect(view.options).toEqual([]);
    expect(view.notes[0]).toContain('day pass');
  });

  it('has nothing to offer in the main hall, the courtyard, the garden or the servants’ quarters', () => {
    for (const placeId of ['main_hall', 'courtyard', 'garden', 'servants_quarters']) {
      expect(placeMenu(placeId)(court({ [YOU]: placeId }), NOBODY_ASKED), placeId).toBeNull();
    }
  });

  it('has no menu for a room she is not standing in, or one that does not exist', () => {
    expect(placeMenu('study')(court({ [YOU]: 'kitchen' }), NOBODY_ASKED)).toBeNull();
    expect(placeMenu('study')(court({}), NOBODY_ASKED)).toBeNull();
    expect(placeMenu('nowhere')(court({ [YOU]: 'study' }), NOBODY_ASKED)).toBeNull();
  });
});

/** Every intent a menu and its submenus offer. */
function offered(view: MenuView, state: CourtState): CourtIntent[] {
  return view.options.flatMap((entry) => {
    const below = entry.submenu?.(state, ASKED);
    return [...(entry.intent ? [entry.intent] : []), ...(below ? offered(below, state) : [])];
  });
}

describe('the menus and the rules agree', () => {
  /** Everyone standing with her in the same room, whichever room that is. */
  function everyoneIn(placeId: string, phase: Phase): CourtState {
    return court(
      { [YOU]: placeId, [MAID_ID]: placeId, [COOK_ID]: placeId, [EUNUCH_ID]: placeId, [MISTRESS_ID]: placeId, [GUARD_ID]: placeId },
      phase,
    );
  }

  function refusals(phase: Phase, wanted: (intent: CourtIntent) => boolean): string[] {
    const refused: string[] = [];
    for (const place of PALACE_PLACES) {
      // The mistress's own room is the one place where she may not be spoken to.
      if (place.ownerId === MISTRESS_ID) continue;
      const state = everyoneIn(place.id, phase);
      const builders = [placeMenu(place.id), personMenu(MISTRESS_ID), personMenu(GUARD_ID), servantMenu(MAID_ID), servantMenu(COOK_ID), servantMenu(EUNUCH_ID)];
      for (const builder of builders) {
        const view = builder(state, ASKED);
        if (!view) continue;
        for (const intent of offered(view, state).filter(wanted)) {
          const result = act(state, intent, createRng('agree'));
          if (wasRejected(result)) refused.push(`${place.id}: ${JSON.stringify(intent)} → ${rejectionReasons(result.events).join(', ')}`);
        }
      }
    }
    return refused;
  }

  it('never offers, in the Day, something the rules refuse because of where she is', () => {
    // Paying respects belongs to the Morning. Cures and restorations are refused to the healthy.
    const dayOnly = (intent: CourtIntent) =>
      intent.type !== 'pay_respects' && !(intent.type === 'buy' && ['physician_cure', 'childbearing_restoration'].includes(intent.item));
    expect(refusals('day', dayOnly)).toEqual([]);
  });

  it('never offers Morning respects somewhere the rules refuse them', () => {
    expect(refusals('morning', (intent) => intent.type === 'pay_respects')).toEqual([]);
  });
});
