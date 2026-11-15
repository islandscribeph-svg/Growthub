import Phaser from 'phaser';
import { insetBounds, stepWithinBounds, type Bounds, type Point, type WalkInput } from '../../../shared/movement';
import {
  GRID_SPACING,
  MAP_HEIGHT,
  MAP_WIDTH,
  PLAYER_SIZE,
  PLAYER_SPEED,
} from '../config';
import { combineInputs } from '../input/walkInput';
import type { TouchPad } from '../input/TouchPad';

const MAP_COLOUR = 0xeadfc8;
const GRID_COLOUR = 0xcdbd9c;
const BORDER_COLOUR = 0x8c2f24;
const PLAYER_COLOUR = 0xb5384f;
const BORDER_WIDTH = 6;
// The player draws over the readout, so she is never hidden in the top-left corner.
const READOUT_DEPTH = 1;
const PLAYER_DEPTH = 2;

/**
 * Phase 0: a labelled placeholder square walking on a blank map.
 * There is no server yet, so the position is worked out here in the browser.
 */
export class WalkScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private readout!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private position: Point = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  private readonly walkable: Bounds = insetBounds(
    { left: 0, top: 0, right: MAP_WIDTH, bottom: MAP_HEIGHT },
    PLAYER_SIZE / 2,
  );

  constructor(private readonly touchPad: TouchPad) {
    super('walk');
  }

  create(): void {
    this.drawBlankMap();
    this.player = this.createPlayer();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is not available.');
    this.cursors = keyboard.createCursorKeys();

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.player, true);

    this.readout = this.add
      .text(12, 10, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: 'rgba(20, 16, 14, 0.75)',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(READOUT_DEPTH);
    this.updateReadout();
  }

  override update(_time: number, deltaMs: number): void {
    const input = combineInputs(this.readKeyboard(), this.touchPad.read());
    const distance = (PLAYER_SPEED * deltaMs) / 1000;
    this.position = stepWithinBounds(this.position, input, distance, this.walkable);
    this.player.setPosition(this.position.x, this.position.y);
    this.updateReadout();
  }

  private readKeyboard(): WalkInput {
    const { left, right, up, down } = this.cursors;
    return {
      x: (right.isDown ? 1 : 0) - (left.isDown ? 1 : 0),
      y: (down.isDown ? 1 : 0) - (up.isDown ? 1 : 0),
    };
  }

  private drawBlankMap(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(MAP_COLOUR).fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    graphics.lineStyle(1, GRID_COLOUR);
    for (let x = GRID_SPACING; x < MAP_WIDTH; x += GRID_SPACING) {
      graphics.lineBetween(x, 0, x, MAP_HEIGHT);
    }
    for (let y = GRID_SPACING; y < MAP_HEIGHT; y += GRID_SPACING) {
      graphics.lineBetween(0, y, MAP_WIDTH, y);
    }

    graphics
      .lineStyle(BORDER_WIDTH, BORDER_COLOUR)
      .strokeRect(BORDER_WIDTH / 2, BORDER_WIDTH / 2, MAP_WIDTH - BORDER_WIDTH, MAP_HEIGHT - BORDER_WIDTH);

    this.add
      .text(MAP_WIDTH / 2, MAP_HEIGHT / 2 - 90, 'Blank map (placeholder)', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#7a6a4f',
      })
      .setOrigin(0.5);
  }

  private createPlayer(): Phaser.GameObjects.Container {
    const square = this.add
      .rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, PLAYER_COLOUR)
      .setStrokeStyle(2, 0x3d0f18);
    const label = this.add
      .text(0, 0, 'Player', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    return this.add.container(this.position.x, this.position.y, [square, label]).setDepth(PLAYER_DEPTH);
  }

  private updateReadout(): void {
    this.readout.setText(
      `Phase 0 scaffold · walk with the arrow keys or the on-screen pad\n` +
        `Position: ${Math.round(this.position.x)}, ${Math.round(this.position.y)} ` +
        `(map is ${MAP_WIDTH} x ${MAP_HEIGHT})`,
    );
  }
}
