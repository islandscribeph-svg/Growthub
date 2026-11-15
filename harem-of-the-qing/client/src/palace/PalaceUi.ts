/**
 * Everything drawn over the palace in ordinary page elements: the clock and purse (top left),
 * the menu that opens when she talks to someone or uses a room, short notices, and the journal.
 * It shows what the session says and hands the session intents; it decides nothing itself.
 */
import { ENERGY, PRIVATE_ROOM, RELATIONSHIP } from '../../../shared/balance';
import { relationshipBetween } from '../../../shared/rules/relationships';
import { dollUpBonusToday } from '../../../shared/rules/training';
import { LADY_TALENTS, type CourtState, type Lady, type Phase } from '../../../shared/types';
import { everyoneElse } from '../sandbox/demoCourt';
import { nameOf, type LogLine } from '../sandbox/describe';
import { PHASE_NAME, RANK_NAME, TALENT_NAME } from '../sandbox/labels';
import { HELPER_SILVER, type LogEntry } from '../sandbox/session';
import type { MenuBuilder, MenuOption, MenuView } from './menus';
import type { PalaceSession } from './PalaceSession';
import { YOU } from './palaceCourt';

/** How long a notice stays on screen. */
const NOTICE_MS = 7000;
const NOTICES_SHOWN = 4;
const JOURNAL_ENTRIES = 40;

const PHASE_HINT: Readonly<Record<Phase, string>> = {
  morning: 'Pay your respects to Consort Mei in the main hall.',
  day: 'Train, greet, give gifts, doll up. Each costs energy.',
  evening: 'The Emperor chooses. That rule is not built yet.',
  night: 'The palace sleeps. Unspent energy is gone.',
};

type Attributes = Record<string, string | boolean>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  children: readonly (Node | string)[] = [],
  attributes: Attributes = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    if (typeof value === 'boolean') node.toggleAttribute(name, value);
    else node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

function button(className: string, children: readonly (Node | string)[], onClick: () => void): HTMLButtonElement {
  const node = el('button', className, children, { type: 'button', tabindex: '-1' });
  node.addEventListener('click', () => {
    // Keep the keyboard on the game, so Space is not read as "press this button again".
    node.blur();
    onClick();
  });
  return node;
}

/** True for the lines of her own story: the clock, and whatever she did or was done to her. */
function concernsYou(line: LogLine): boolean {
  return line.tone === 'clock' || line.about.length === 0 || line.about.includes(YOU);
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export class PalaceUi {
  /** Called when the menu closes, however it closes. */
  onMenuClosed: (() => void) | null = null;

  private readonly stack = el('div', 'pal-stack');
  private readonly hud = el('section', 'pal-hud', [], { 'aria-label': 'Your day' });
  private readonly notices = el('div', 'pal-notices', [], { 'aria-live': 'polite' });
  private readonly menu = el('section', 'pal-menu', [], { role: 'dialog', hidden: true });
  private readonly journal = el('aside', 'pal-journal', [], { 'aria-label': 'Journal', hidden: true });
  private menuStack: MenuBuilder[] = [];
  private menuOptions: readonly MenuOption[] = [];
  private result: readonly LogLine[] = [];
  /** The phone whereabouts panel stays as she left it when the day card is redrawn. */
  private whereaboutsOpen = false;
  /** A phone upright is narrow; a phone on its side is short. Both use the compact day card. */
  private readonly narrowQuery = window.matchMedia('(max-width: 760px), (max-height: 500px)');

  constructor(
    root: HTMLElement,
    private readonly session: PalaceSession,
  ) {
    this.stack.append(this.hud, this.notices);
    root.append(this.stack, this.menu, this.journal);
    window.addEventListener('keydown', (event) => this.onKey(event));
    this.narrowQuery.addEventListener('change', () => this.renderHud());
    this.refresh();
  }

  get menuOpen(): boolean {
    return this.menuStack.length > 0;
  }

  /** Opens a menu, replacing any that is open. Does nothing when the builder has nothing to offer. */
  openMenu(builder: MenuBuilder): void {
    this.menuStack = [builder];
    this.result = [];
    this.renderMenu();
  }

  closeMenu(): void {
    if (!this.menuOpen) return;
    this.menuStack = [];
    this.renderMenu();
  }

  /** Shows short notices at the top of the screen for a few seconds. */
  notify(lines: readonly LogLine[]): void {
    for (const line of lines) {
      const notice = el('p', `pal-notice pal-notice--${line.tone}`, [line.text]);
      this.notices.append(notice);
      window.setTimeout(() => notice.remove(), NOTICE_MS);
    }
    while (this.notices.childElementCount > NOTICES_SHOWN) this.notices.firstElementChild?.remove();
  }

  /** Redraws everything from the court as it is now. */
  refresh(): void {
    this.renderHud();
    if (!this.journal.hidden) this.renderJournal();
    if (this.menuOpen) this.renderMenu();
  }

  private get court(): CourtState {
    return this.session.court;
  }

  private get you(): Lady {
    const character = this.court.characters[YOU];
    if (character?.path !== 'lady') throw new Error('The palace has lost its player.');
    return character;
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.menuOpen || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape' || event.key === 'Backspace') {
      event.preventDefault();
      this.back();
      return;
    }
    const chosen = /^[1-9]$/.test(event.key) ? this.menuOptions[Number(event.key) - 1] : undefined;
    if (chosen) {
      event.preventDefault();
      this.choose(chosen);
    }
  }

  private back(): void {
    this.menuStack = this.menuStack.slice(0, -1);
    this.renderMenu();
  }

  private choose(option: MenuOption): void {
    if (option.submenu) {
      this.menuStack = [...this.menuStack, option.submenu];
      this.result = [];
      this.renderMenu();
      return;
    }
    let entry: LogEntry | null = null;
    if (option.askRegularId) entry = this.session.askRegular(option.askRegularId);
    else if (option.intent) entry = this.session.send(option.intent);
    if (entry) this.result = entry.lines;
    this.refresh();
  }

  /** Drops any level of the menu that has nothing left to offer, then draws the top one. */
  private renderMenu(): void {
    const memory = { hasAsked: (regularId: string) => this.session.hasAsked(regularId) };
    let view: MenuView | null = null;
    while (this.menuStack.length > 0) {
      const builder = this.menuStack[this.menuStack.length - 1];
      view = builder ? builder(this.court, memory) : null;
      if (view) break;
      this.menuStack = this.menuStack.slice(0, -1);
    }
    const wasOpen = !this.menu.hidden;
    if (!view) {
      this.menu.hidden = true;
      this.menu.replaceChildren();
      this.menuOptions = [];
      if (wasOpen) this.onMenuClosed?.();
      return;
    }

    this.menuOptions = view.options;
    const heading = el('div', 'pal-menu__heading', [el('h2', '', [view.title])]);
    if (view.subtitle) heading.append(el('p', '', [view.subtitle]));
    const header = el('header', 'pal-menu__header', [
      heading,
      button('pal-menu__close', ['×'], () => this.closeMenu()),
    ]);
    const results = el(
      'div',
      'pal-menu__result',
      this.result.map((line) => el('p', `pal-line pal-line--${line.tone}`, [line.text])),
    );
    const notes = view.notes.map((note) => el('p', 'pal-menu__note', [note]));
    const options = el(
      'ol',
      'pal-menu__options',
      view.options.map((option, index) =>
        el('li', '', [
          button(
            'pal-option',
            [
              el('span', 'pal-option__key', [String(index + 1)]),
              el('span', 'pal-option__text', [
                el('strong', '', [option.label]),
                el('span', '', [option.detail]),
              ]),
            ],
            () => this.choose(option),
          ),
        ]),
      ),
    );
    const footer = el('footer', 'pal-menu__footer', []);
    if (this.menuStack.length > 1) footer.append(button('pal-menu__back', ['← Back'], () => this.back()));
    footer.append(el('span', '', [view.options.length > 0 ? 'Press a number to choose · Esc to close' : 'Esc to close']));

    this.menu.setAttribute('aria-label', view.title);
    this.menu.replaceChildren(header, results, ...notes, options, footer);
    this.menu.hidden = false;
  }

  private renderHud(): void {
    const { court, you } = this;
    const place = this.session.placeId === null ? null : court.places[this.session.placeId];
    const pips = el(
      'span',
      'pal-pips',
      Array.from({ length: ENERGY.perDay }, (_unused, index) => el('i', index < you.energy ? 'is-full' : '')),
      { 'aria-hidden': 'true' },
    );
    const people = this.whereaboutsList();
    const hint = el('p', 'pal-hud__hint', [PHASE_HINT[court.phase]]);
    const clock = el('div', 'pal-hud__clock', [
      el('strong', '', [`Day ${court.day} · ${PHASE_NAME[court.phase]}`]),
      button('pal-hud__next', [`End the ${PHASE_NAME[court.phase]} →`], () => this.endPhase()),
    ]);
    const purse = el('div', 'pal-hud__purse', [
      el('span', '', ['Energy ', pips, el('b', '', [` ${you.energy}`])]),
      el('span', '', ['Silver ', el('b', '', [`${you.silver}`]), ' taels']),
    ]);
    const here = el('p', 'pal-hud__place', [
      place ? `You are ${place.kind === 'gate' ? 'at' : 'in'} ${place.name}.` : 'You are outside.',
    ]);
    const journalButton = button('pal-hud__journal', [this.journal.hidden ? 'Open journal' : 'Close journal'], () =>
      this.toggleJournal(),
    );

    if (this.narrowQuery.matches) {
      const summary = el('summary', '', ['Where everyone is']);
      summary.tabIndex = -1;
      const panel = el('details', 'pal-hud__whereabouts', [summary, el('div', 'pal-hud__whereabouts-body', [hint, people])]);
      panel.open = this.whereaboutsOpen;
      panel.addEventListener('toggle', () => {
        this.whereaboutsOpen = panel.open;
      });
      this.hud.replaceChildren(clock, purse, here, panel, journalButton);
      return;
    }

    this.hud.replaceChildren(clock, hint, purse, here, people, journalButton);
  }

  private whereaboutsList(): HTMLElement {
    return el(
      'ul',
      'pal-hud__people',
      this.peopleOfThePalace().map(([name, where]) => el('li', '', [el('span', '', [name]), el('em', '', [where])])),
    );
  }

  /** Everyone who lives or works in this palace, and the room they are in. */
  private peopleOfThePalace(): [string, string][] {
    const { court } = this;
    const ids = [...Object.keys(court.characters), ...Object.keys(court.servants)].filter((id) => id !== YOU);
    const rows: [string, string][] = [];
    for (const id of ids) {
      const placeId = court.whereabouts[id];
      const place = placeId === undefined ? undefined : court.places[placeId];
      if (!place) continue;
      const asleep = court.phase === 'night' && place.ownerId === id;
      const where = place.ownerId === id ? 'her own room' : place.name.replace(/^the /, '');
      rows.push([capital(nameOf(court, id)), asleep ? `${where}, asleep` : where]);
    }
    return rows;
  }

  private endPhase(): void {
    const entry = this.session.nextPhase();
    this.notify(entry.lines.filter((line) => line.tone === 'clock' || line.about.includes(YOU)));
    this.refresh();
  }

  private toggleJournal(): void {
    this.journal.hidden = !this.journal.hidden;
    this.refresh();
  }

  private renderJournal(): void {
    const { court, you } = this;
    const bonus = dollUpBonusToday(you);
    const stat = (name: string, value: string): HTMLElement => el('li', '', [el('span', '', [name]), el('b', '', [value])]);
    const attributes = el('ul', 'pal-stats', [
      stat('Beauty', bonus > 0 ? `${you.beauty} +${bonus} today` : `${you.beauty}`),
      stat('Intelligence', `${you.intelligence}`),
      stat('Obedience', `${you.obedience}`),
      stat('Childbearing', `${you.childbearing}`),
      stat('Favor', `${you.favor}`),
    ]);
    const talents = el(
      'ul',
      'pal-stats pal-stats--two',
      LADY_TALENTS.map((talent) => stat(TALENT_NAME[talent], `${you.talents[talent]}`)),
    );
    const whereabouts = el(
      'ul',
      'pal-stats',
      this.peopleOfThePalace().map(([name, where]) => stat(name, where)),
    );
    const relationships = el(
      'ul',
      'pal-stats',
      everyoneElse(court).map((id) => {
        const character = court.characters[id];
        const score = relationshipBetween(court, YOU, id);
        const row = stat(capital(nameOf(court, id)), `${score}`);
        row.title = character ? RANK_NAME[character.rank] : 'Always an NPC';
        if (score >= PRIVATE_ROOM.welcomeFromRelationship) row.classList.add('is-close');
        if (score < RELATIONSHIP.strangers) row.classList.add('is-cold');
        return row;
      }),
    );
    const history = el(
      'ol',
      'pal-history',
      this.session.log
        .map((entry) => ({ entry, lines: entry.lines.filter(concernsYou) }))
        // What the rest of the court got up to is not her story to read.
        .filter(({ entry, lines }) => lines.length > 0 || entry.helper)
        .slice(-JOURNAL_ENTRIES)
        .reverse()
        .map(({ entry, lines }) =>
          el('li', '', [
            el('p', 'pal-history__title', [el('strong', '', [entry.title]), el('span', '', [entry.stamp])]),
            ...lines.map((line) => el('p', `pal-line pal-line--${line.tone}`, [line.text])),
          ]),
        ),
    );
    const tools = el('div', 'pal-tools', [
      button('pal-tool', [`Add ${HELPER_SILVER} taels`], () => {
        this.session.helperAddSilver();
        this.refresh();
      }),
      button('pal-tool', ['Let a little time pass'], () => {
        this.session.stir();
        this.refresh();
      }),
      button('pal-tool', ['Start over'], () => window.location.reload()),
    ]);

    this.journal.replaceChildren(
      el('header', 'pal-journal__header', [
        el('h2', '', [`${you.name}, ${RANK_NAME[you.rank]}`]),
        button('pal-menu__close', ['×'], () => this.toggleJournal()),
      ]),
      el('h3', '', ['Attributes']),
      attributes,
      el('h3', '', ['Talents']),
      talents,
      el('h3', '', ['Relationships']),
      el('p', 'pal-journal__hint', [
        `Everyone starts at ${RELATIONSHIP.strangers}. At ${PRIVATE_ROOM.welcomeFromRelationship} a lady welcomes you into her room.`,
      ]),
      relationships,
      el('h3', '', ['Where everyone is']),
      whereabouts,
      el('h3', '', ['Test tools (not part of the game)']),
      tools,
      el('h3', '', ['What happened']),
      history,
    );
  }
}
