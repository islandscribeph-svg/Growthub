/**
 * The rules sandbox page: buttons that run the rules from /shared on a small test court, and
 * panels that show what changed. A test bench, not the game.
 */
import {
  ACTIVITY_SPOT_RULES,
  DOLL_UP,
  ENERGY,
  GIFTS,
  RELATIONSHIP,
  SHOP_PRICE,
  STAT,
  TIP,
  TRANSFER,
} from '../../../shared/balance';
import { isExiled, isIll } from '../../../shared/rules/core';
import {
  haremAverage,
  isHated,
  palaceMistress,
  relationshipBetween,
  respectsGoTo,
  statusPanelRelationships,
} from '../../../shared/rules/relationships';
import { dollUpBonusToday, trainingGain } from '../../../shared/rules/training';
import {
  ACTIVITY_SPOTS,
  EMPRESS_DOWAGER_ID,
  LADY_TALENTS,
  PHASES,
  type ActivitySpot,
  type CharacterId,
  type GiftKind,
  type Lady,
  type LadyTalent,
  type Phase,
  type SellableWork,
  type ShopItem,
} from '../../../shared/types';
import { MAID_ID, REGULAR_ID, YOU, everyoneElse } from './demoCourt';
import { nameOf, type LogLine } from './describe';
import {
  ATTRIBUTE_NAME,
  GIFT_NAME,
  ITEM_NAME,
  PHASE_HINT,
  PHASE_NAME,
  RANK_NAME,
  SPOT_NAME,
  TALENT_NAME,
  WORK_NAME,
} from './labels';
import { HELPER_SILVER, SandboxSession, type LogEntry } from './session';

type Child = Node | string | null | false;
type Attrs = Readonly<Record<string, string | boolean>>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value === 'boolean') node.toggleAttribute(name, value);
    else node.setAttribute(name, value);
  }
  for (const child of children) {
    if (child === null || child === false) continue;
    node.append(child);
  }
  return node;
}

function option(value: string, label: string): HTMLOptionElement {
  return el('option', { value }, label);
}

function select(label: string, options: readonly HTMLOptionElement[]): HTMLSelectElement {
  return el('select', { 'aria-label': label }, ...options);
}

function checkbox(label: string, checked: boolean): { box: HTMLInputElement; row: HTMLLabelElement } {
  const box = el('input', { type: 'checkbox' });
  box.checked = checked;
  return { box, row: el('label', { class: 'check' }, box, label) };
}

function button(label: string, onClick: () => void, kind = 'action'): HTMLButtonElement {
  const node = el('button', { type: 'button', class: `btn btn--${kind}` }, label);
  node.addEventListener('click', onClick);
  return node;
}

function card(title: string, ...children: Child[]): HTMLElement {
  return el('section', { class: 'card' }, el('h2', {}, title), ...children);
}

function percent(value: number): string {
  return `${Math.max(0, Math.min(100, ((value - STAT.min) / (STAT.max - STAT.min)) * 100))}%`;
}

function bar(value: number, marks: readonly number[] = [], tone = 'gold'): HTMLElement {
  const fill = el('span', { class: `bar__fill bar__fill--${tone}`, style: `width:${percent(value)}` });
  const ticks = marks.map((mark) => el('span', { class: 'bar__mark', style: `left:${percent(mark)}` }));
  return el('span', { class: 'bar' }, fill, ...ticks);
}

function statRow(label: string, value: number, note = '', tone = 'gold'): HTMLElement {
  return el(
    'div',
    { class: 'stat' },
    el('span', { class: 'stat__label' }, label),
    bar(value, [], tone),
    el('span', { class: 'stat__value' }, String(value)),
    el('span', { class: 'stat__note' }, note),
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

class SandboxPage {
  private session = new SandboxSession(randomSeed());
  private showOthers = false;

  private readonly clockPanel = el('div');
  private readonly youPanel = el('div');
  private readonly maidPanel = el('div');
  private readonly latestPanel = el('div', { class: 'latest', 'aria-live': 'polite' });
  private readonly peoplePanel = el('div');
  private readonly statusPanel = el('div');
  private readonly logPanel = el('div', { class: 'log' });
  private readonly ledgerPanel = el('div');
  private readonly phaseTags: { tag: HTMLElement; phase: Phase | null }[] = [];

  constructor(root: HTMLElement) {
    root.replaceChildren(this.header(), this.layout());
    this.render();
  }

  private get you(): Lady {
    const character = this.session.court.characters[YOU];
    if (character?.path !== 'lady') throw new Error('The sandbox court has lost its player.');
    return character;
  }

  private run(action: () => LogEntry): void {
    action();
    this.render();
  }

  private header(): HTMLElement {
    return el(
      'header',
      { class: 'top' },
      el(
        'div',
        {},
        el('p', { class: 'top__eyebrow' }, 'Harem of the Qing'),
        el('h1', {}, 'Rules sandbox'),
        el(
          'p',
          { class: 'top__lede' },
          'A test bench for the first five sets of rules: the clock, training, relationships, money and gifting. ',
          'You play Lan, a new Second Class Attendant. Press anything, including things that should not be allowed, ',
          'and read what the rules answer. Nothing is saved; reloading starts over.',
        ),
      ),
      el('a', { class: 'top__link', href: './' }, 'Walking demo →'),
    );
  }

  private layout(): HTMLElement {
    const showOthers = checkbox('Also show what happens to everyone else', false);
    showOthers.box.addEventListener('change', () => {
      this.showOthers = showOthers.box.checked;
      this.render();
    });
    return el(
      'main',
      { class: 'grid' },
      el(
        'div',
        { class: 'col' },
        card('The clock', this.clockPanel),
        card('You', this.youPanel),
        card('Your maid', this.maidPanel),
      ),
      el(
        'div',
        { class: 'col' },
        card('What just happened', this.latestPanel),
        this.morningActions(),
        this.dayActions(),
        this.anyTimeActions(),
        this.helpers(),
      ),
      el(
        'div',
        { class: 'col' },
        card('Your relationships', this.peoplePanel),
        card('Status panel rows', this.statusPanel),
        card('Everything so far', showOthers.row, this.logPanel),
        el('details', { class: 'card card--fold' }, el('summary', {}, 'Silver ledger'), this.ledgerPanel),
      ),
    );
  }

  private phaseTag(phase: Phase | null): HTMLElement {
    const tag = el('span', { class: 'when' }, phase ? `${PHASE_NAME[phase]} only` : 'Any time');
    this.phaseTags.push({ tag, phase });
    return tag;
  }

  private group(title: string, phase: Phase | null, note: string, ...children: Child[]): HTMLElement {
    return el(
      'div',
      { class: 'action' },
      el('div', { class: 'action__head' }, el('h3', {}, title), this.phaseTag(phase)),
      el('p', { class: 'action__note' }, note),
      el('div', { class: 'action__controls' }, ...children),
    );
  }

  private personSelect(label: string, include: (id: CharacterId) => boolean = () => true): HTMLSelectElement {
    const people = everyoneElse(this.session.court).filter(include);
    const node = select(
      label,
      people.map((id) => option(id, this.personLabel(id))),
    );
    return node;
  }

  private personLabel(id: CharacterId): string {
    const name = nameOf(this.session.court, id);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private morningActions(): HTMLElement {
    return card(
      'Morning',
      this.group(
        'Pay your respects',
        'morning',
        'Free. +1 with your palace mistress. Skipping it costs 1 Obedience and 1 with her when the Morning ends.',
        button('Pay respects', () => this.run(() => this.session.payRespects())),
      ),
    );
  }

  private dayActions(): HTMLElement {
    const spot = select(
      'Activity spot',
      ACTIVITY_SPOTS.map((id) => option(id, SPOT_NAME[id])),
    );
    const talent = select('Talent', []);
    const fillTalents = (): void => {
      const rule = ACTIVITY_SPOT_RULES[spot.value as ActivitySpot];
      const also = rule.alsoRaises ? ` (also ${ATTRIBUTE_NAME[rule.alsoRaises]})` : '';
      const choices = rule.talents.map((id) => option(id, `${TALENT_NAME[id]}${also}`));
      talent.replaceChildren(...(choices.length > 0 ? choices : [option('', `No talent${also}`)]));
    };
    spot.addEventListener('change', fillTalents);
    fillTalents();
    const regular = checkbox(`${this.personLabel(REGULAR_ID)}, the spot's regular, is there`, false);
    const asked = checkbox('Ask her first', false);

    const ownRoom = checkbox('In my own room', true);
    const greetWho = this.personSelect('Who to greet');
    const giftWho = this.personSelect('Who the gift is for');
    const gift = select(
      'Gift',
      (Object.keys(GIFTS) as GiftKind[]).map((id) => option(id, `${GIFT_NAME[id]} · ${GIFTS[id].cost} taels`)),
    );
    const work = select('Work to sell', [option('sewing', WORK_NAME.sewing), option('drawing', WORK_NAME.drawing)]);

    return card(
      'Day',
      this.group(
        'Train',
        'day',
        `${ENERGY.training} energy. The talent rises by 3, then 2, then 1 as it gets higher.`,
        spot,
        talent,
        regular.row,
        asked.row,
        button('Train', () =>
          this.run(() =>
            this.session.train(
              spot.value as ActivitySpot,
              talent.value === '' ? undefined : (talent.value as LadyTalent),
              regular.box.checked,
              asked.box.checked,
            ),
          ),
        ),
      ),
      this.group(
        'Doll up',
        'day',
        `${DOLL_UP.energyCost} energy. Beauty bonus for today: a quarter of your Makeup.`,
        ownRoom.row,
        button('Doll up', () => this.run(() => this.session.dollUp(ownRoom.box.checked))),
      ),
      this.group(
        'Greet someone',
        'day',
        `${ENERGY.socializing} energy. +1 with them. Once per person per day.`,
        greetWho,
        button('Greet', () => this.run(() => this.session.greet(greetWho.value))),
      ),
      this.group(
        'Give a gift',
        'day',
        `${ENERGY.socializing} energy plus the price. Homemade gifts roll on your Cooking or Sewing; a bad one is an insult.`,
        giftWho,
        gift,
        button('Give', () => this.run(() => this.session.giveGift(giftWho.value, gift.value as GiftKind))),
      ),
      this.group(
        'Sell your own work',
        'day',
        `${ENERGY.training} energy. Pays the quality of the piece divided by 5. One piece a day.`,
        work,
        button('Make and sell', () => this.run(() => this.session.sellWork(work.value as SellableWork))),
      ),
    );
  }

  private anyTimeActions(): HTMLElement {
    const silverWho = this.personSelect('Who the silver is for', (id) => id !== EMPRESS_DOWAGER_ID);
    const amount = el('input', { type: 'number', min: '1', step: '1', value: '10', 'aria-label': 'Taels to give' });
    const shop = (Object.keys(SHOP_PRICE) as ShopItem[]).map((item) =>
      button(`${ITEM_NAME[item]} · ${SHOP_PRICE[item]}`, () => this.run(() => this.session.buy(item)), 'quiet'),
    );
    return card(
      'Any time',
      this.group('Buy', null, 'Prices in taels. Every purchase goes in the ledger; poison ingredients leave a trail.', ...shop),
      this.group(
        'Tip your maid',
        null,
        `${TIP.cost} taels for +${TIP.loyaltyGain} Loyalty, up to +${TIP.maxLoyaltyPerDay} a day.`,
        button('Tip Xiu', () => this.run(() => this.session.tipMaid())),
      ),
      this.group(
        'Give silver',
        null,
        `Qing is another player, so gifts of silver to her are capped at ${TRANSFER.playerToPlayerCapPerDay} taels a day. The others are NPCs.`,
        silverWho,
        amount,
        button('Give', () => this.run(() => this.session.giveSilver(silverWho.value, Number(amount.value)))),
      ),
    );
  }

  private helpers(): HTMLElement {
    const talent = select(
      'Talent to set',
      LADY_TALENTS.map((id) => option(id, TALENT_NAME[id])),
    );
    const talentValue = el('input', { type: 'number', min: '0', max: '100', value: '60', 'aria-label': 'Talent value' });
    const who = select('Whose relationship to set', [
      option('everyone', 'Everyone'),
      ...everyoneElse(this.session.court).map((id) => option(id, this.personLabel(id))),
    ]);
    const score = el('input', { type: 'number', min: '0', max: '100', value: '70', 'aria-label': 'Relationship value' });
    const seed = el('input', { type: 'text', value: this.session.seed, 'aria-label': 'Seed for the dice' });

    return el(
      'details',
      { class: 'card card--fold' },
      el('summary', {}, 'Test helpers (not part of the game)'),
      el(
        'p',
        { class: 'action__note' },
        'Shortcuts for setting up a situation without playing many days. The real game has nothing like these.',
      ),
      el(
        'div',
        { class: 'action__controls' },
        button(`Add ${HELPER_SILVER} taels`, () => this.run(() => this.session.helperAddSilver()), 'quiet'),
        button('Fall ill', () => this.run(() => this.session.helperFallIll()), 'quiet'),
        button('Go to the Cold Palace', () => this.run(() => this.session.helperSendToColdPalace()), 'quiet'),
        button('Lower Childbearing', () => this.run(() => this.session.helperLowerChildbearing()), 'quiet'),
      ),
      el(
        'div',
        { class: 'action__controls' },
        talent,
        talentValue,
        button('Set talent', () => this.run(() => this.session.helperSetTalent(talent.value as LadyTalent, Number(talentValue.value))), 'quiet'),
      ),
      el(
        'div',
        { class: 'action__controls' },
        who,
        score,
        button('Set relationship', () => this.run(() => this.session.helperSetRelationship(who.value, Number(score.value))), 'quiet'),
      ),
      el(
        'div',
        { class: 'action__controls' },
        seed,
        button(
          'Start over with this seed',
          () => {
            this.session = new SandboxSession(seed.value.trim() || randomSeed());
            seed.value = this.session.seed;
            this.render();
          },
          'quiet',
        ),
      ),
      el('p', { class: 'action__note' }, 'The seed decides every dice roll. The same seed and the same clicks always give the same results.'),
    );
  }

  private render(): void {
    this.renderClock();
    this.renderYou();
    this.renderMaid();
    this.renderLatest();
    this.renderPeople();
    this.renderStatus();
    this.renderLog();
    this.renderLedger();
    for (const { tag, phase } of this.phaseTags) {
      tag.classList.toggle('when--now', phase === null || phase === this.session.court.phase);
    }
  }

  private renderClock(): void {
    const { day, phase } = this.session.court;
    const next = PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length] ?? PHASES[0];
    this.clockPanel.replaceChildren(
      el('p', { class: 'clock__day' }, `Day ${day}`),
      el(
        'ol',
        { class: 'phases' },
        ...PHASES.map((id) => el('li', { class: id === phase ? 'phases__item phases__item--now' : 'phases__item' }, PHASE_NAME[id])),
      ),
      el('p', { class: 'clock__hint' }, PHASE_HINT[phase]),
      button(`End the ${PHASE_NAME[phase]} → ${PHASE_NAME[next]}`, () => this.run(() => this.session.nextPhase()), 'primary'),
      el('p', { class: 'action__note' }, 'In the real game each phase lasts 30 minutes. Here you move the clock yourself.'),
    );
  }

  private renderYou(): void {
    const court = this.session.court;
    const lan = this.you;
    const bonus = dollUpBonusToday(lan);
    const badges: string[] = [];
    if (isIll(lan, court.day)) badges.push(`Ill through day ${lan.illThroughDay}`);
    if (isExiled(lan, court.day)) badges.push(`In the Cold Palace through day ${lan.exiledThroughDay}`);
    if (isHated(court, YOU)) badges.push('Hated by the harem');
    if (lan.today.premiumCosmetics) badges.push('Premium cosmetics today');
    if (lan.inventory.poisonIngredients > 0) badges.push(`Poison ingredients × ${lan.inventory.poisonIngredients}`);
    if (lan.inventory.fertilityPoisonIngredients > 0) {
      badges.push(`Fertility poison ingredients × ${lan.inventory.fertilityPoisonIngredients}`);
    }
    const target = respectsGoTo(court, lan);
    const today = [
      target ? `Respects: ${lan.today.paidRespects ? 'paid' : 'not paid yet'}` : 'Respects: nobody to bow to',
      `Greeted: ${lan.today.greeted.map((id) => nameOf(court, id)).join(', ') || 'nobody'}`,
      `Gifts to: ${lan.today.giftedTo.map((id) => nameOf(court, id)).join(', ') || 'nobody'}`,
      `Work sold: ${lan.today.workSold}`,
    ];

    this.youPanel.replaceChildren(
      el('p', { class: 'who' }, el('strong', {}, lan.name), ` · ${RANK_NAME[lan.rank]}`),
      el('p', { class: 'badges' }, ...badges.map((text) => el('span', { class: 'badge badge--warn' }, text))),
      el(
        'div',
        { class: 'purse' },
        el(
          'div',
          {},
          el('span', { class: 'purse__label' }, 'Energy'),
          el(
            'span',
            { class: 'pips', 'aria-label': `${lan.energy} of ${ENERGY.perDay} energy` },
            ...Array.from({ length: ENERGY.perDay }, (_, index) =>
              el('span', { class: index < lan.energy ? 'pip pip--on' : 'pip' }),
            ),
          ),
          el('span', { class: 'purse__value' }, `${lan.energy} / ${ENERGY.perDay}`),
        ),
        el(
          'div',
          {},
          el('span', { class: 'purse__label' }, 'Silver'),
          el('span', { class: 'purse__value purse__value--big' }, plural(lan.silver, 'tael')),
        ),
      ),
      el('h3', {}, 'Attributes'),
      statRow('Beauty', lan.beauty, bonus > 0 ? `+${bonus} today` : ''),
      statRow('Intelligence', lan.intelligence),
      statRow('Obedience', lan.obedience),
      statRow('Childbearing', lan.childbearing),
      statRow('Favor', lan.favor, '', 'red'),
      el('h3', {}, 'Talents'),
      ...LADY_TALENTS.map((talent) =>
        statRow(TALENT_NAME[talent], lan.talents[talent], `next +${trainingGain(lan.talents[talent])}`, 'jade'),
      ),
      el('h3', {}, 'Today'),
      el('ul', { class: 'today' }, ...today.map((text) => el('li', {}, text))),
    );
  }

  private renderMaid(): void {
    const maid = this.session.court.servants[MAID_ID];
    if (!maid) return;
    this.maidPanel.replaceChildren(
      el('p', { class: 'who' }, el('strong', {}, maid.name), ' · personal maid'),
      statRow('Loyalty', maid.loyalty, `+${maid.loyaltyFromTipsToday} from tips today`),
      el('p', { class: 'action__note' }, 'Her Loyalty is your main defence against schemes. It drops by 20 if you become hated.'),
    );
  }

  private line(line: LogLine): HTMLElement {
    return el('li', { class: `line line--${line.tone}` }, line.text);
  }

  private visibleLines(entry: LogEntry): readonly LogLine[] {
    if (this.showOthers) return entry.lines;
    return entry.lines.filter((line) => line.about.length === 0 || line.about.includes(YOU));
  }

  private entry(entry: LogEntry): HTMLElement {
    const lines = this.visibleLines(entry);
    const hidden = entry.lines.length - lines.length;
    return el(
      'article',
      { class: entry.helper ? 'entry entry--helper' : 'entry' },
      el('header', { class: 'entry__head' }, el('strong', {}, entry.title), el('span', {}, entry.stamp)),
      lines.length > 0 ? el('ul', { class: 'lines' }, ...lines.map((line) => this.line(line))) : null,
      lines.length === 0 && hidden === 0 ? el('p', { class: 'entry__quiet' }, 'Done.') : null,
      hidden > 0 ? el('p', { class: 'entry__quiet' }, `${plural(hidden, 'more thing')} happened to other people.`) : null,
    );
  }

  private renderLatest(): void {
    const latest = this.session.latest;
    this.latestPanel.replaceChildren(
      latest ? this.entry(latest) : el('p', { class: 'entry__quiet' }, 'Nothing yet. It is the Morning of day 1: try paying your respects.'),
    );
  }

  private renderPeople(): void {
    const court = this.session.court;
    const lan = this.you;
    const mistress = palaceMistress(court, lan.palaceId);
    const rows = everyoneElse(court).map((id) => {
      const character = court.characters[id];
      const score = relationshipBetween(court, YOU, id);
      const facts: string[] = [];
      if (character) {
        facts.push(RANK_NAME[character.rank]);
        facts.push(court.palaces[character.palaceId]?.name ?? character.palaceId);
        facts.push(character.controller.kind === 'player' ? 'another player' : 'NPC');
      } else {
        facts.push('Always an NPC');
      }
      const tags: string[] = [];
      if (mistress?.id === id) tags.push('Your palace mistress');
      if (score >= RELATIONSHIP.friendsFrom) tags.push('Friend');
      return el(
        'li',
        { class: 'person' },
        el(
          'div',
          { class: 'person__head' },
          el('strong', {}, this.personLabel(id)),
          ...tags.map((text) => el('span', { class: 'badge' }, text)),
          el('span', { class: 'person__score' }, String(score)),
        ),
        bar(score, [RELATIONSHIP.mistressFavorsFrom, RELATIONSHIP.friendsFrom], 'red'),
        el('p', { class: 'person__facts' }, facts.join(' · ')),
      );
    });
    this.peoplePanel.replaceChildren(
      el(
        'p',
        { class: 'action__note' },
        `Everyone starts at ${RELATIONSHIP.strangers}. The marks are ${RELATIONSHIP.mistressFavorsFrom} (a mistress grants day passes) and ${RELATIONSHIP.friendsFrom} (friends).`,
      ),
      el('ul', { class: 'people' }, ...rows),
    );
  }

  private renderStatus(): void {
    const court = this.session.court;
    const rows = statusPanelRelationships(court, YOU);
    const average = haremAverage(court, YOU);
    const show = (value: number | null): string => (value === null ? 'none' : String(value));
    this.statusPanel.replaceChildren(
      el(
        'dl',
        { class: 'rows' },
        el('dt', {}, 'Empress Dowager'),
        el('dd', {}, show(rows?.empressDowager ?? null)),
        el('dt', {}, 'Empress'),
        el('dd', {}, show(rows?.empress ?? null)),
        el('dt', {}, 'Palace mistress'),
        el('dd', {}, show(rows?.palaceMistress ?? null)),
        el('dt', {}, 'Ladies of your palace'),
        el('dd', {}, show(rows?.ownPalaceLadies ?? null)),
        el('dt', {}, 'Other palaces'),
        el('dd', {}, show(rows?.otherPalaces ?? null)),
        el('dt', {}, 'Average across the harem'),
        el('dd', {}, average === null ? 'none' : average.toFixed(1)),
      ),
      el(
        'p',
        { class: 'action__note' },
        `The grouped rows are averages. If the average across the harem falls below ${RELATIONSHIP.hatedBelow}, you are hated.`,
      ),
    );
  }

  private renderLog(): void {
    const entries = [...this.session.log].reverse();
    this.logPanel.replaceChildren(
      ...(entries.length > 0 ? entries.map((entry) => this.entry(entry)) : [el('p', { class: 'entry__quiet' }, 'Nothing yet.')]),
    );
  }

  private renderLedger(): void {
    const court = this.session.court;
    const entries = court.ledger.filter((entry) => this.showOthers || entry.characterId === YOU).reverse();
    if (entries.length === 0) {
      this.ledgerPanel.replaceChildren(el('p', { class: 'entry__quiet' }, 'No silver has moved yet.'));
      return;
    }
    this.ledgerPanel.replaceChildren(
      el(
        'table',
        { class: 'ledger' },
        el('thead', {}, el('tr', {}, ...['When', 'Who', 'Taels', 'Why', 'Trail'].map((text) => el('th', {}, text)))),
        el(
          'tbody',
          {},
          ...entries.map((entry) =>
            el(
              'tr',
              {},
              el('td', {}, `Day ${entry.day}, ${PHASE_NAME[entry.phase]}`),
              el('td', {}, entry.characterId === YOU ? 'You' : nameOf(court, entry.characterId)),
              el('td', { class: entry.direction === 'in' ? 'in' : 'out' }, `${entry.direction === 'in' ? '+' : '−'}${entry.amount}`),
              el('td', {}, [entry.reason, entry.item?.replaceAll('_', ' '), entry.otherId ? `→ ${nameOf(court, entry.otherId)}` : null].filter(Boolean).join(' · ')),
              el('td', {}, entry.leavesTrail ? 'leaves a trail' : ''),
            ),
          ),
        ),
      ),
    );
  }
}

function randomSeed(): string {
  return `court-${Math.floor(Math.random() * 1_000_000)}`;
}

const root = document.getElementById('sandbox');
if (!root) throw new Error('sandbox.html is missing the element with id "sandbox".');
new SandboxPage(root);
