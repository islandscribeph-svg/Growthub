import Phaser from 'phaser';
import { DEFAULT_MAP, DEFAULT_SEED, VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { EventLog } from './events';
import { TouchPad } from './input/TouchPad';
import { loadAreaMap } from './maps/loadAreaMap';
import { PalaceScene } from './palace/PalaceScene';
import { PalaceSession } from './palace/PalaceSession';
import { PalaceUi } from './palace/PalaceUi';
import { AreaScene } from './scenes/AreaScene';
import { Hud } from './ui/Hud';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`index.html is missing the element with id "${id}".`);
  return found as T;
}

async function start(): Promise<void> {
  const hud = new Hud(element('status'), element<HTMLButtonElement>('zone-prompt'), element('message'));
  const touchPad = new TouchPad(element('touch-pad'));
  const events = new EventLog();

  // Adding ?map=name to the address opens assets/maps/name.json.
  const query = new URLSearchParams(window.location.search);
  const mapName = query.get('map') ?? DEFAULT_MAP;

  let area;
  try {
    area = await loadAreaMap(mapName);
  } catch (error) {
    hud.showMessage(error instanceof Error ? error.message : String(error));
    return;
  }

  // The painted palace has people in it and things to do. Any other map is for walking only.
  let scene: Phaser.Scene;
  if (mapName === DEFAULT_MAP) {
    const session = new PalaceSession(query.get('seed') ?? DEFAULT_SEED);
    const ui = new PalaceUi(element('palace-ui'), session);
    // The position read-out is for map-making; ?debug brings it back.
    element('status').hidden = !query.has('debug');
    scene = new PalaceScene({ touchPad, hud, events, session, ui }, area);
  } else {
    scene = new AreaScene({ touchPad, hud, events }, area);
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: '#14100e',
    scale: {
      // Fill the window, including a phone in either orientation, instead of letterboxing 800×600.
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [scene],
  });
}

void start();
