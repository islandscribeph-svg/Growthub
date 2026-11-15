# Harem of the Qing

A multiplayer 2D top-down browser game set in the Qing dynasty imperial harem.

**Where it stands: Phase 2, first half (rules 1 to 5).** Three things exist so far:

- **The walking demo (Phase 1, Step A).** A red square labelled "Player" walks around one painted palace. Walls stop her, a prompt appears when she stands in a named spot, and the view follows her.
- **The first five sets of game rules (Phase 2).** The clock, training, relationships, money and gifting, written as plain code with tests.
- **The rules sandbox.** A page where you press buttons to try those rules on a small test court and read what they answer. It is a test bench, not the game. See [Try the rules in the sandbox](#try-the-rules-in-the-sandbox).

There are no accounts or other players yet. Everything can run on your own computer.

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

## Try the rules in the sandbox

With the game running (`npm run dev`), open <http://localhost:5173/sandbox.html>, or click **Rules sandbox** in the top-right corner of the walking demo.

You play Lan, a new Second Class Attendant, in a court of seven people. Nothing is saved; reloading the page starts over.

- **The clock** (left) shows the day and phase. In the real game a phase lasts 30 minutes; here you press **End the Morning** and so on to move it yourself.
- **The actions** (middle) are grouped by when they are allowed. Every button works at any time on purpose: press one at the wrong time, or without the energy or silver, and the rules answer "Not allowed" with the reason.
- **What just happened** (top of the middle column) shows the result of your last click in plain sentences. **Everything so far** (right) keeps the whole history.
- **Your relationships** and **Status panel rows** (right) update after every click.
- **Test helpers** (bottom of the middle column) are shortcuts that are not part of the game: add silver, set a talent, fall ill, go to the Cold Palace, set a relationship. They let you reach a situation without playing many days.

Things worth trying:

1. Press **Pay respects** in the Morning, then again. The second is refused.
2. End the Morning without paying respects. You lose 1 Obedience and 1 with Consort Mei.
3. In the Day, train in the dressing room, then **Doll up**. Beauty shows a bonus for today.
4. Give Consort Mei a homemade dish. With Cooking at 10 it is a bad gift and she likes you less. Use **Set talent** to put Cooking at 70 and try again the next day.
5. Give the same person two gifts in one day. The second costs silver and changes nothing.
6. Give Consort Mei a trinket (worth half, she outranks you), then fine jewelry on another day (full value).
7. Use **Set relationship** with "Everyone" and 5. You become hated and your maid's Loyalty drops by 20.
8. Give Qing, the other player, more than 50 taels in one day. It is refused.

## The game rules

The rules live in `shared/` and come only from `docs/GAME_LOGIC.md`. Nothing on the screen uses them yet.

To run every test:

```
npm test
```

It should end with a line like `Tests  300 passed`, and no line containing "failed". To run the tests for one set of rules, add part of its file name, for example `npm test -- gifting`.

| File in `shared/` | What it holds |
| --- | --- |
| `balance.ts` | **Every number from the game logic doc**, each with a name and the sentence it comes from. To tune the game, change a number here and nowhere else. A test (`rules/noDocNumbers.test.ts`) fails if a rule file contains a number of its own. |
| `types.ts` | What a lady, a guard, a servant, a child, a relationship, a clue, a scheme, a trial and a whole court look like. |
| `rng.ts` | The dice. Given the same starting number (the "seed") it always rolls the same sequence, so a test can be repeated exactly. |
| `events.ts` | The list of things a rule can report, such as "trained", "gift given", or "refused, not enough silver". |
| `rules/clock.ts` | Rule 1. The 2-hour game day, its four phases, and energy: lost at Night, back to full in the Morning. |
| `rules/training.ts` | Rule 2. Training at the activity spots, gains that shrink as a talent rises, dolling up. |
| `rules/relationships.ts` | Rule 3. The 0 to 100 score for each pair, every change in the section 5 table, friends, the hated state, the averages on the status panel. |
| `rules/money.ts` | Rule 4. Stipends, the bribe formula, the shop, tipping servants, the cap on silver between players, the ledger. Silver never goes below zero. |
| `rules/gifting.ts` | Rule 5. Homemade and bought gifts, one counted gift per recipient per day, half value to higher ranks. |
| `rules/*.test.ts` | The tests for each of the above. |

Every rule works the same way: it is given the court as it is now and what someone wants to do, and it hands back a new court plus a list of what happened. It never changes the court it was given. If the action is not allowed, the court comes back untouched with one "refused" event that says why.

**Numbers the doc did not give.** Section 13 of `docs/GAME_LOGIC.md`, "Decided during the build", lists the points sections 1 to 12 left open and what was decided for each: how much an activity spot adds to Beauty, Intelligence or Obedience, what skipping Morning respects costs, selling sewing and drawings, guard stipends, the energy cost of each scheme, and what a new character starts with. They are starting values like every other number, and they sit together at the bottom of `balance.ts` under "Section 13".

## What is in each folder

| Folder | What it holds |
| --- | --- |
| `client/` | What the player sees: the Phaser game screen, the map loader, the prompt, the keyboard and touch controls. No game rules. `client/src/sandbox/` is the rules sandbox page, the one place that runs the rules in the browser, for testing only. |
| `server/` | Empty for now. The game server arrives in later phases. |
| `shared/` | The game rules as plain code, with their tests. See [The game rules](#the-game-rules). Also reading a Tiled map, walking and being blocked by walls. |
| `assets/` | The art and Tiled files, as uploaded, plus `maps/`, where the game looks for Tiled JSON maps. |
| `docs/` | `GAME_LOGIC.md`, the source of truth for every game rule. |

## Placeholders

The player's size, her walking speed, the zoom and the action keys (Space and Enter) are stand-in values in `client/src/config.ts` and `client/src/scenes/AreaScene.ts`. They are not game rules.
