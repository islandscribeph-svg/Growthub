/** What the status box shows. */
export interface Status {
  map: string;
  x: number;
  y: number;
  zone: string | null;
  lastEvent: string | null;
  notes: readonly string[];
}

/**
 * The on-screen text around the game: the status box (top left), the zone prompt
 * (bottom centre) and a full-screen message for problems.
 */
export class Hud {
  /** Called when the player taps or clicks the zone prompt. */
  onPromptTap: (() => void) | null = null;

  private readonly promptName: HTMLElement;
  private shownStatus = '';
  private shownZone: string | null = null;

  constructor(
    private readonly statusBox: HTMLElement,
    private readonly prompt: HTMLButtonElement,
    private readonly messageBox: HTMLElement,
  ) {
    this.promptName = document.createElement('strong');
    const hint = document.createElement('span');
    hint.textContent = 'Press Space or tap here';
    prompt.replaceChildren(this.promptName, hint);

    prompt.addEventListener('click', () => {
      // Keep keyboard focus on the game, so Space is not also read as "press this button".
      prompt.blur();
      this.onPromptTap?.();
    });
  }

  showStatus(status: Status): void {
    const lines = [
      `Map: ${status.map}`,
      `Position: ${Math.round(status.x)}, ${Math.round(status.y)}`,
      `Zone: ${status.zone ?? 'none'}`,
      `Last event: ${status.lastEvent ?? 'none yet'}`,
      ...status.notes.map((note) => `Note: ${note}`),
    ];
    const text = lines.join('\n');
    if (text === this.shownStatus) return;
    this.shownStatus = text;
    this.statusBox.textContent = text;
  }

  /** Shows the prompt for a zone, or hides it when `zoneName` is null. */
  showPrompt(zoneName: string | null): void {
    if (zoneName === this.shownZone) return;
    this.shownZone = zoneName;
    this.prompt.hidden = zoneName === null;
    this.promptName.textContent = zoneName ?? '';
  }

  showMessage(text: string): void {
    this.messageBox.textContent = text;
    this.messageBox.hidden = false;
  }
}
