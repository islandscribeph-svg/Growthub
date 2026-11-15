import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { TouchPad } from './input/TouchPad';
import { WalkScene } from './scenes/WalkScene';

const padElement = document.getElementById('touch-pad');
if (!padElement) throw new Error('The touch pad is missing from index.html.');

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#14100e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [new WalkScene(new TouchPad(padElement))],
});
