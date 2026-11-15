/**
 * Things the player asks to do. For now they are only written to the browser console
 * and shown on screen. Later they become the intents sent to the server.
 */
export interface InteractEvent {
  type: 'interact';
  /** Name of the zone the player is standing in. */
  zone: string;
  zoneId: number;
  map: string;
  /** How she asked: the action key, or a tap on the prompt. */
  via: 'key' | 'tap';
  at: string;
}

export type GameEvent = InteractEvent;

type Listener = (event: GameEvent) => void;

export class EventLog {
  private readonly listeners: Listener[] = [];

  log(event: GameEvent): void {
    console.info(`[event] ${event.type}`, event);
    for (const listener of this.listeners) listener(event);
  }

  onEvent(listener: Listener): void {
    this.listeners.push(listener);
  }
}
