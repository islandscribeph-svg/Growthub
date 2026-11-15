import Phaser from 'phaser';
import type { Point, Rect } from '../../../shared/geometry';
import { findFreeSpot, walk, type WalkArea, type WalkInput } from '../../../shared/movement';
import { areaBounds, startPosition, zoneAt, type Zone } from '../../../shared/tiledMap';
import { MAP_ZOOM, PLAYER_BODY, PLAYER_SPEED } from '../config';
import type { EventLog, InteractEvent } from '../events';
import type { TouchPad } from '../input/TouchPad';
import { combineInputs } from '../input/walkInput';
import type { LoadedArea } from '../maps/loadAreaMap';
import type { Hud } from '../ui/Hud';

const BACKGROUND_KEY = 'area-background';
const PLAIN_MAP_COLOUR = 0xeadfc8;
const PLAIN_WALL_COLOUR = 0x8c2f24;
const PLAYER_COLOUR = 0xb5384f;
const PLAYER_OUTLINE_COLOUR = 0x3d0f18;
export const PLAYER_DEPTH = 10;
/** A long pause (a hidden tab, a slow frame) must not turn into one giant step. */
const LONGEST_FRAME_MS = 100;
const ACTION_KEYS = [Phaser.Input.Keyboard.KeyCodes.SPACE, Phaser.Input.Keyboard.KeyCodes.ENTER];

export interface AreaSceneDeps {
  touchPad: TouchPad;
  hud: Hud;
  events: EventLog;
}

/**
 * One area of the palace, loaded from a Tiled map: a painted background, walls that block,
 * and zones that show a prompt. There is no server yet, so the position is worked out here.
 */
export class AreaScene extends Phaser.Scene {
  protected player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private walkArea!: WalkArea;
  protected position: Point = { x: 0, y: 0 };
  protected zone: Zone | null = null;
  private lastEvent: string | null = null;
  private notes: string[] = [];

  constructor(
    protected readonly deps: AreaSceneDeps,
    protected readonly area: LoadedArea,
  ) {
    super('area');
  }

  preload(): void {
    if (this.area.backgroundUrl) {
      this.load.image(BACKGROUND_KEY, this.area.backgroundUrl);
    }
  }

  create(): void {
    const { map } = this.area;
    this.notes = [...map.warnings];

    const bounds = this.drawMap();
    this.walkArea = { bounds, obstacles: map.collisions };
    this.position = findFreeSpot(startPosition(map, bounds), PLAYER_BODY, this.walkArea);
    this.player = this.createPlayer();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is not available.');
    this.cursors = keyboard.createCursorKeys();
    // Listening for the key press itself, rather than checking once a frame, so that a
    // very quick tap of the key is never missed.
    for (const code of ACTION_KEYS) {
      keyboard.addKey(code).on('down', () => this.interact('key'));
    }

    const camera = this.cameras.main;
    const frameCamera = (): void => {
      camera.setZoom(MAP_ZOOM);
      camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
      // On a short screen the day card covers the top, so the player sits a little below centre.
      camera.setFollowOffset(0, this.scale.height <= 520 ? 36 : 0);
    };
    camera.startFollow(this.player, true);
    frameCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, frameCamera);

    this.deps.hud.onPromptTap = () => this.interact('tap');
    this.deps.events.onEvent((event) => {
      this.lastEvent = `${event.type} with ${event.zone} (${event.via})`;
    });
    this.refreshHud();
  }

  override update(_time: number, deltaMs: number): void {
    const input = combineInputs(this.readKeyboard(), this.deps.touchPad.read());
    const distance = (PLAYER_SPEED * Math.min(deltaMs, LONGEST_FRAME_MS)) / 1000;
    this.position = walk(this.position, input, distance, PLAYER_BODY, this.walkArea);
    this.player.setPosition(this.position.x, this.position.y);
    this.zone = zoneAt(this.position, this.area.map.zones);
    this.refreshHud();
  }

  protected interact(via: InteractEvent['via']): void {
    if (!this.zone) return;
    this.deps.events.log({
      type: 'interact',
      zone: this.zone.name,
      zoneId: this.zone.id,
      map: this.area.name,
      via,
      at: new Date().toISOString(),
    });
  }

  private readKeyboard(): WalkInput {
    const { left, right, up, down } = this.cursors;
    return {
      x: (right.isDown ? 1 : 0) - (left.isDown ? 1 : 0),
      y: (down.isDown ? 1 : 0) - (up.isDown ? 1 : 0),
    };
  }

  /** Draws the painted background, or a plain stand-in when there is none. Returns the map's edges. */
  private drawMap(): Rect {
    const { map, backgroundUrl } = this.area;
    if (map.background && this.textures.exists(BACKGROUND_KEY)) {
      const image = this.add.image(map.background.x, map.background.y, BACKGROUND_KEY).setOrigin(0);
      return areaBounds(map, { width: image.width, height: image.height });
    }
    if (backgroundUrl) {
      this.notes.push(`The background picture "${map.background?.image}" could not be loaded.`);
    }

    const bounds = areaBounds(map);
    const graphics = this.add.graphics();
    graphics.fillStyle(PLAIN_MAP_COLOUR).fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    graphics.fillStyle(PLAIN_WALL_COLOUR);
    for (const wall of map.collisions) {
      graphics.fillRect(wall.x, wall.y, wall.width, wall.height);
    }
    return bounds;
  }

  protected createPlayer(): Phaser.GameObjects.Container {
    const square = this.add
      .rectangle(0, 0, PLAYER_BODY.width, PLAYER_BODY.height, PLAYER_COLOUR)
      .setStrokeStyle(1, PLAYER_OUTLINE_COLOUR);
    const label = this.add
      .text(0, -PLAYER_BODY.height / 2 - 1, 'Player', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#3d0f18',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setResolution(MAP_ZOOM * 2);
    return this.add.container(this.position.x, this.position.y, [square, label]).setDepth(PLAYER_DEPTH);
  }

  /** What the action key would do here, shown at the bottom of the screen. */
  protected promptText(): string | null {
    return this.zone ? this.zone.name || `zone ${this.zone.id}` : null;
  }

  private refreshHud(): void {
    const { hud } = this.deps;
    hud.showPrompt(this.promptText());
    hud.showStatus({
      map: this.area.path,
      x: this.position.x,
      y: this.position.y,
      zone: this.zone ? this.zone.name || `zone ${this.zone.id}` : null,
      lastEvent: this.lastEvent,
      notes: this.notes,
    });
  }
}
