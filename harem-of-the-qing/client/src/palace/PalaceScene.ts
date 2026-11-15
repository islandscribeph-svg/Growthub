import Phaser from 'phaser';
import { distanceBetween, type Point } from '../../../shared/geometry';
import type { CourtState } from '../../../shared/types';
import { COURT_STIR_MS, MAP_ZOOM } from '../config';
import type { InteractEvent } from '../events';
import type { LoadedArea } from '../maps/loadAreaMap';
import { nameOf } from '../sandbox/describe';
import { AreaScene, type AreaSceneDeps } from '../scenes/AreaScene';
import { labelLifts } from './labelLayout';
import { REACH, SHEET_SCALE, SHEET_URL, STROLL_MS, portraitOf, standOf, type Portrait, type SheetKey } from './layout';
import { personMenu, placeMenu, servantMenu, type MenuBuilder } from './menus';
import type { PalaceSession } from './PalaceSession';
import type { PalaceUi } from './PalaceUi';
import { YOU } from './palaceCourt';

/** Portraits are drawn this many times larger than they are shown, so they stay sharp when zoomed. */
const PORTRAIT_DETAIL = 4;
/** How far above the feet a figure's picture is anchored: the feet sit just above its bottom edge. */
const FEET = 0.94;
const FADE_MS = 350;
/** A menu about a person closes once she has walked this many reaches away. */
const WALK_AWAY_REACHES = 1.6;
const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '7px',
  fontStyle: 'bold',
  color: '#ffffff',
  stroke: '#3d0f18',
  strokeThickness: 2,
};
const PLAYER_LABEL_COLOUR = '#ffd166';

interface Actor {
  readonly id: string;
  readonly container: Phaser.GameObjects.Container;
  readonly label: Phaser.GameObjects.Text;
  /** The room and spot she was last drawn at, so she only moves when it changes. */
  standKey: string | null;
  stroll: Phaser.Tweens.Tween | null;
}

export interface PalaceSceneDeps extends AreaSceneDeps {
  session: PalaceSession;
  ui: PalaceUi;
}

/**
 * The palace with its people in it. Walking works as in AreaScene; on top of that, everyone
 * the court places in a room is drawn there, and the action key opens a menu for the person
 * she is standing next to, or for the room she is in.
 */
export class PalaceScene extends AreaScene {
  private readonly actors = new Map<string, Actor>();
  private readonly session: PalaceSession;
  private readonly ui: PalaceUi;
  private playerLabel: Phaser.GameObjects.Text | null = null;
  /** The person the open menu is about, when it is about a person. */
  private talkingTo: string | null = null;

  constructor(deps: PalaceSceneDeps, area: LoadedArea) {
    super(deps, area);
    this.session = deps.session;
    this.ui = deps.ui;
  }

  override preload(): void {
    super.preload();
    for (const [key, path] of Object.entries(SHEET_URL)) {
      this.load.image(key, new URL(path, document.baseURI).href);
    }
  }

  override create(): void {
    super.create();
    this.session.onChange(() => {
      this.syncActors();
      this.ui.refresh();
    });
    this.ui.onMenuClosed = () => {
      if (this.talkingTo) this.actors.get(this.talkingTo)?.stroll?.resume();
      this.talkingTo = null;
    };
    this.time.addEvent({
      delay: COURT_STIR_MS,
      loop: true,
      callback: () => {
        // Nobody walks off in the middle of a conversation.
        if (!this.ui.menuOpen) this.session.stir();
      },
    });
    this.syncActors();
  }

  override update(time: number, deltaMs: number): void {
    super.update(time, deltaMs);
    this.player.setDepth(this.position.y);
    for (const actor of this.actors.values()) actor.container.setDepth(actor.container.y);
    this.separateNameLabels();

    const placeId = this.currentPlaceId();
    if (placeId !== this.session.placeId) {
      const entry = this.session.send({ type: 'enter_place', actorId: YOU, placeId });
      this.ui.notify(entry.lines);
    }
    if (this.talkingTo) {
      const actor = this.actors.get(this.talkingTo);
      if (!actor || distanceBetween(this.position, actor.container) > REACH * WALK_AWAY_REACHES) this.ui.closeMenu();
    }
  }

  protected override interact(_via: InteractEvent['via']): void {
    if (this.ui.menuOpen) return;
    const nearby = this.nearestActor();
    if (nearby) {
      this.talkingTo = nearby.id;
      nearby.stroll?.pause();
      this.ui.openMenu(this.court.servants[nearby.id] ? servantMenu(nearby.id) : personMenu(nearby.id));
      if (!this.ui.menuOpen) this.ui.onMenuClosed?.();
      return;
    }
    const menu = this.roomMenu();
    if (menu) this.ui.openMenu(menu);
  }

  protected override createPlayer(): Phaser.GameObjects.Container {
    const { container, label } = this.createFigure(YOU, 'You');
    label.setColor(PLAYER_LABEL_COLOUR);
    this.playerLabel = label;
    return container.setPosition(this.position.x, this.position.y);
  }

  /**
   * Names that would draw on top of each other (two people standing close) are stacked,
   * each still sitting just above its own figure.
   */
  private separateNameLabels(): void {
    const labels: Phaser.GameObjects.Text[] = [];
    if (this.playerLabel?.visible) labels.push(this.playerLabel);
    for (const actor of this.actors.values()) {
      if (actor.container.visible) labels.push(actor.label);
    }
    for (const label of labels) {
      const restY = label.getData('restY');
      if (typeof restY === 'number') label.setY(restY);
    }

    // A fixed block around each name, anchored on the figure. Text measurement comes back as 0
    // until the first paint, which left two people on the same spot with their names crossed.
    const boxes = labels.flatMap((label) => {
      const id = label.getData('labelId');
      const restY = label.getData('restY');
      const parent = label.parentContainer;
      if (typeof id !== 'string' || typeof restY !== 'number' || !parent) return [];
      const bottom = parent.y + restY;
      return [{ id, left: parent.x - 22, top: bottom - 16, right: parent.x + 22, bottom }];
    });
    const lifts = new Map(labelLifts(boxes));
    // Names of two people standing in the same spot still crossed when the text boxes
    // only barely touched, so also keep their baselines a full line apart.
    const spots = boxes.flatMap((box) => {
      const label = labels.find((item) => item.getData('labelId') === box.id);
      const parent = label?.parentContainer;
      return parent ? [{ id: box.id, x: parent.x, y: parent.y }] : [];
    });
    spots.sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const above = spots[i];
        const below = spots[j];
        if (!above || !below || Math.abs(above.x - below.x) > 36 || below.y - above.y > 40) continue;
        const wanted = 40 - (below.y - above.y) + (lifts.get(below.id) ?? 0);
        if (wanted > (lifts.get(above.id) ?? 0)) lifts.set(above.id, wanted);
      }
    }
    for (const label of labels) {
      const id = label.getData('labelId');
      const restY = label.getData('restY');
      if (typeof id !== 'string' || typeof restY !== 'number') continue;
      label.setY(restY - (lifts.get(id) ?? 0));
    }
  }

  protected override promptText(): string | null {
    if (this.ui.menuOpen) return null;
    const nearby = this.nearestActor();
    if (nearby) return `Talk to ${nameOf(this.court, nearby.id)}`;
    const placeId = this.session.placeId;
    const place = placeId === null ? undefined : this.court.places[placeId];
    return place && this.roomMenu() ? place.name.charAt(0).toUpperCase() + place.name.slice(1) : null;
  }

  private get court(): CourtState {
    return this.session.court;
  }

  /** The zone she stands in, when the court knows a place by that name. */
  private currentPlaceId(): string | null {
    const name = this.zone?.name ?? null;
    return name !== null && this.court.places[name] ? name : null;
  }

  /** The menu for the room she is in, or null when the room has nothing to do in it. */
  private roomMenu(): MenuBuilder | null {
    const placeId = this.session.placeId;
    if (placeId === null) return null;
    const builder = placeMenu(placeId);
    const memory = { hasAsked: (regularId: string) => this.session.hasAsked(regularId) };
    return builder(this.court, memory) ? builder : null;
  }

  /** The closest person within reach who is in the same room as she is. */
  private nearestActor(): Actor | null {
    const placeId = this.session.placeId;
    if (placeId === null) return null;
    let nearest: Actor | null = null;
    let nearestDistance = REACH;
    for (const actor of this.actors.values()) {
      if (!actor.container.visible || this.court.whereabouts[actor.id] !== placeId) continue;
      const distance = distanceBetween(this.position, actor.container);
      if (distance <= nearestDistance) {
        nearest = actor;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  /** Puts everyone where the court says they are. */
  private syncActors(): void {
    const { court } = this;
    const ids = [...Object.keys(court.characters), ...Object.keys(court.servants)].filter((id) => id !== YOU);
    for (const id of ids) {
      const placeId = court.whereabouts[id];
      const stand = placeId === undefined ? null : standOf(placeId, id, court.phase);
      const actor = this.actors.get(id) ?? (stand ? this.createActor(id) : null);
      if (!actor) continue;
      if (!stand || placeId === undefined) {
        actor.stroll?.stop();
        actor.stroll = null;
        actor.standKey = null;
        actor.container.setVisible(false);
        continue;
      }

      const asleep = court.phase === 'night' && court.places[placeId]?.ownerId === id;
      actor.label.setText(asleep ? `${nameOf(court, id)} (asleep)` : nameOf(court, id));
      const standKey = `${placeId}:${stand.at.x},${stand.at.y}`;
      if (actor.standKey === standKey) continue;
      actor.standKey = standKey;
      actor.stroll?.stop();
      actor.stroll = null;
      actor.container.setPosition(stand.at.x, stand.at.y).setVisible(true).setAlpha(0);
      this.tweens.add({ targets: actor.container, alpha: 1, duration: FADE_MS });
      if (stand.strollTo) actor.stroll = this.startStroll(actor.container, stand.strollTo);
    }
  }

  private startStroll(container: Phaser.GameObjects.Container, to: Point): Phaser.Tweens.Tween {
    return this.tweens.add({
      targets: container,
      x: to.x,
      y: to.y,
      duration: STROLL_MS,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      hold: FADE_MS,
      repeatDelay: FADE_MS,
    });
  }

  private createActor(id: string): Actor {
    const { container, label } = this.createFigure(id, nameOf(this.court, id));
    const actor: Actor = { id, container, label, standKey: null, stroll: null };
    this.actors.set(id, actor);
    return actor;
  }

  /** A person on the map: their picture standing on its feet, with their name above. */
  private createFigure(id: string, name: string): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const portrait = portraitOf(this.court, id);
    const parts: Phaser.GameObjects.GameObject[] = [];
    let height = 0;
    if (portrait) {
      const image = this.add.image(0, 0, this.portraitTexture(portrait)).setOrigin(0.5, FEET).setScale(1 / PORTRAIT_DETAIL);
      height = image.displayHeight * FEET;
      parts.push(image);
    }
    const label = this.add
      .text(0, -height - 1, name, LABEL_STYLE)
      .setOrigin(0.5, 1)
      .setResolution(MAP_ZOOM * 2);
    label.setData('restY', label.y);
    label.setData('labelId', id);
    parts.push(label);
    return { container: this.add.container(0, 0, parts), label };
  }

  /**
   * Cuts one figure out of its sheet and shrinks it once, smoothly, into a texture of its own.
   * Shrinking the big painted sheets every frame would make the figures shimmer as they move.
   */
  private portraitTexture(portrait: Portrait): string {
    const { sheet, rect } = portrait;
    const key = `portrait:${sheet}:${rect.x},${rect.y}`;
    if (this.textures.exists(key)) return key;
    const scale = SHEET_SCALE[sheet as SheetKey] * PORTRAIT_DETAIL;
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));
    const canvas = this.textures.createCanvas(key, width, height);
    if (!canvas) throw new Error(`Could not make the picture for ${key}.`);
    const context = canvas.getContext();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const source = this.textures.get(sheet).getSourceImage() as HTMLImageElement;
    context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
    canvas.refresh();
    return key;
  }
}
