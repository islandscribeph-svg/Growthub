import { parseTiledMap, type AreaMap } from '../../../shared/tiledMap';
import { MAPS_FOLDER } from '../config';

export interface LoadedArea {
  name: string;
  /** Where the file sits in the project, for messages. */
  path: string;
  map: AreaMap;
  /** Full address of the background picture, or null when the map has none. */
  backgroundUrl: string | null;
}

const VALID_NAME = /^[A-Za-z0-9_-]+$/;

/**
 * Loads assets/maps/<name>.json. Throws an Error with a plain-language message when the
 * file is missing or is not a Tiled JSON map.
 */
export async function loadAreaMap(name: string): Promise<LoadedArea> {
  if (!VALID_NAME.test(name)) {
    throw new Error(`"${name}" is not a usable map name. Use letters, numbers, - and _ only.`);
  }
  const path = `assets/${MAPS_FOLDER}/${name}.json`;
  const url = new URL(`${MAPS_FOLDER}/${name}.json`, document.baseURI);

  let data: unknown;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`status ${response.status}`);
    data = await response.json();
  } catch {
    throw new Error(`Could not open ${path}. Check the file name, and that it was exported from Tiled as JSON.`);
  }

  let map: AreaMap;
  try {
    map = parseTiledMap(data);
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    name,
    path,
    map,
    backgroundUrl: map.background ? new URL(map.background.image, url).href : null,
  };
}
