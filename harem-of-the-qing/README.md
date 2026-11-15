# Harem of the Qing

A multiplayer 2D top-down browser game set in the Qing dynasty imperial harem.

**Where it stands: Phase 1, Step A (one palace).** A red square labelled "Player" walks around one painted palace. Walls stop her, a prompt appears when she stands in a named spot, and the view follows her. There are no game rules, accounts or other players yet, and nothing is online. Everything runs on your own computer.

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

- The painted consort palace, zoomed in, with a red square labelled **Player** standing in the small bedroom on the left (the zone called `side_room_1`).
- A dark box in the top-left corner showing the map file, the square's position, the zone she is standing in, and the last event.
- A yellow-edged button at the bottom of the screen reading **side_room_1 / Press Space or tap here**.
- A round pad with four arrows in the bottom-left corner.

Try this:

1. Click the picture once, then hold the **arrow keys**. The square walks and the picture slides so she stays in view. Two arrows together walk diagonally.
2. Walk into a wall. She stops. Walk along it and she slides.
3. Press **Space** (or **Enter**). The top-left box changes to "Last event: interact with side_room_1 (key)". Click or tap the yellow-edged button and it says "(tap)".
4. Leave the room: walk to the bottom-right corner of the room and go right, through the white doorway. The button disappears and the box says "Zone: none". Pressing Space now does nothing.
5. Walk into other rooms. The button comes back with that room's name: `study`, `kitchen`, `music_pavilion`, `garden`, `main_hall`, `side_room_2`, `palace_gate`.
6. Walk to a corner of the palace. The view stops at the edge of the picture and never shows anything beyond it.
7. Press and hold an arrow on the **round pad** with the mouse (or a finger on a touch screen). She walks that way and the arrow turns yellow. Slide to another arrow without letting go to change direction.

To see the event log itself: press `F12` in the browser, open the **Console** tab, and press Space while standing in a zone. A line starting with `[event] interact` appears each time.

## Use your own Tiled map

The palace you see is a **stand-in** map, `assets/maps/consort-palace.json`. It uses your painting `assets/palace-layouts/consort-palace-furnished.jpg`. Its walls were traced from the painting by a script and its zone names are made up, so expect to adjust both. You can open it in Tiled and edit it, or replace it with your own.

A map works if it is saved from Tiled as JSON (`File > Export As`, type "JSON map files") into `assets/maps/`, and has:

| Layer | Type in Tiled | What it does |
| --- | --- | --- |
| any name | Image Layer | The painted background. One picture. |
| `collisions` | Object Layer | Every rectangle here blocks the player. |
| `zones` | Object Layer | Every rectangle here shows a prompt with the rectangle's **Name**. |

- Only rectangles count. Ellipses, polygons, points and rotated rectangles are skipped, and the top-left box says so.
- If there is a zone named `side_room_1`, the player starts in it. Otherwise she starts in the middle of the map.
- Keep the picture inside the `assets/` folder, so the game can find it.

To open a different map, add its file name (without `.json`) to the address: <http://localhost:5173/?map=my-palace> opens `assets/maps/my-palace.json`. To make it the map that opens by default, change `DEFAULT_MAP` in `client/src/config.ts`.

If the file name is wrong, the screen says "Could not open assets/maps/... .json".

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
| `client/` | What the player sees: the Phaser game screen, the map loader, the prompt, the keyboard and touch controls. |
| `server/` | Empty for now. The game server arrives in later phases. |
| `shared/` | The game rules as plain code, with their tests. So far: reading a Tiled map, walking and being blocked by walls. `balance.ts` will hold every number from the game logic doc. It is empty until Phase 2. |
| `assets/` | The art and Tiled files, as uploaded, plus `maps/`, where the game looks for Tiled JSON maps. |
| `docs/` | `GAME_LOGIC.md`, the source of truth for every game rule. |

## Placeholders

The player's size, her walking speed, the zoom and the action keys (Space and Enter) are stand-in values in `client/src/config.ts` and `client/src/scenes/AreaScene.ts`. They are not game rules.
