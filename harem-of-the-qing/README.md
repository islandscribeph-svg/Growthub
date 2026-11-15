# Harem of the Qing

A multiplayer 2D top-down browser game set in the Qing dynasty imperial harem.

**Where it stands: Phase 0 (scaffold).** A red square labelled "Player" walks around a blank map. There are no palaces, rules, accounts or other players yet, and nothing is online. Everything runs on your own computer.

## What to install (once)

1. **Node.js, version 22 or newer.** Go to [nodejs.org](https://nodejs.org), download the "LTS" installer and click through it with the default options.
2. **This repository on your computer.** On GitHub, use the green "Code" button, then "Open with GitHub Desktop" or "Download ZIP" (and unzip it).

## Run the game

1. Open a terminal: the **Terminal** app on a Mac, or **PowerShell** on Windows.
2. Go into the game folder. Type `cd ` (with a space after it), drag the `harem-of-the-qing` folder onto the terminal window, and press Enter.
3. The first time only, download the game's building blocks (takes under a minute):

   ```
   npm install
   ```

4. Start the game:

   ```
   npm run dev
   ```

5. Open the address the terminal prints in your browser. It is normally <http://localhost:5173/>.

To stop the game, click the terminal and press `Ctrl` + `C`.

## What you should see

- A beige map with a faint grid and a dark red border, and the words "Blank map (placeholder)".
- A red square labelled **Player** in the middle.
- A dark box in the top-left corner showing the square's position as two numbers.
- A round pad with four arrows in the bottom-left corner.

Try this:

- Click the map once, then hold the **arrow keys**. The square walks, the grid slides past, and the position numbers change. Two arrows together walk diagonally.
- Press and hold an arrow on the **round pad** with the mouse (or a finger on a touch screen). The square walks that way and the arrow turns yellow. Slide to another arrow without letting go to change direction. Let go to stop.
- Walk into any edge. The square stops at the red border and cannot leave the map.

## Try it on a phone

1. Put the phone on the same Wi-Fi as the computer.
2. In the terminal, run `npm run dev:phone` in place of `npm run dev`.
3. The terminal prints a line starting with "Network:", such as `http://192.168.1.20:5173/`. Type that address into the phone's browser.

## Check that nothing is broken

```
npm run check
```

This runs three checks in a row: the type check (looks for coding mistakes), the tests, and a production build. It should finish without the word "error" or "failed".

## What is in each folder

| Folder | What it holds |
| --- | --- |
| `client/` | What the player sees: the Phaser game screen, the keyboard and touch controls. |
| `server/` | Empty for now. The game server arrives in later phases. |
| `shared/` | The game rules as plain code, with their tests. `balance.ts` will hold every number from the game logic doc. It is empty until Phase 2. |
| `assets/` | The art and Tiled map files, as uploaded. Not shown in the game yet. |
| `docs/` | `GAME_LOGIC.md`, the source of truth for every game rule. |

## Placeholders in Phase 0

The map size, the square's size and its walking speed are stand-in values in `client/src/config.ts`. They are not game rules and will be replaced when the real maps arrive in Phase 1.
