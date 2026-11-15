import Phaser from 'phaser';
import { DEFAULT_MAP, VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { EventLog } from './events';
import { TouchPad } from './input/TouchPad';
import { loadAreaMap } from './maps/loadAreaMap';
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
  const mapName = new URLSearchParams(window.location.search).get('map') ?? DEFAULT_MAP;

  let area;
  try {
    area = await loadAreaMap(mapName);
  } catch (error) {
    hud.showMessage(error instanceof Error ? error.message : String(error));
    return;
  }

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
    scene: [new AreaScene({ touchPad, hud, events }, area)],
  });
}

void start();
