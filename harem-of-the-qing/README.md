# Harem of the Qing

A multiplayer 2D top-down browser game set in the Qing dynasty imperial harem.

**Where it stands: Phase 2, first half (rules 1 to 5), now playable inside one palace.** Three things exist so far:

- **The playable palace.** You walk a Second Class Attendant around one painted palace. The people of the palace stand, walk and sleep in its rooms, and everything the rules allow so far is done by walking up to someone or into a room and pressing Space. See [What you should see](#what-you-should-see).
- **The first five sets of game rules (Phase 2).** The clock, training, relationships, money and gifting, plus the rules for rooms and who is where, written as plain code with tests.
- **The rules sandbox.** A page of buttons to try the same rules without walking. It is a test bench, not the game. See [Try the rules in the sandbox](#try-the-rules-in-the-sandbox).

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

The painted consort palace, zoomed in. You are **Lan**, a new Second Class Attendant, standing in your room on the left. Your maid **Xiu** stands beside you. Nothing is saved; reloading the page starts over.

- **The day card** (top left) shows the day and phase, your energy and silver, the room you are in, and where everyone in the palace is right now. In the real game a phase lasts 30 minutes; here you press **End the Morning** and so on to move the clock yourself.
- **The yellow-edged button** (bottom) appears when there is something to do where you stand: **Talk to Xiu**, or the name of the room. Press **Space** (or **Enter**), or click or tap the button.
- **The menu** that opens lists what you can do there, with its cost. Press the number beside an option or click it. **Esc** goes back. The answer from the rules appears at the top of the menu. Options are offered even at the wrong time of day, so you can read why the rules refuse.
- **Open journal** shows your attributes, talents, relationships and what has happened so far, plus three test tools that are not part of the game: add silver, let a little time pass, start over.
- **The round pad** (bottom left) walks you with a mouse or a finger. The arrow keys do the same.

The people of the palace move by themselves about every 40 seconds, and whenever the phase changes. Nobody walks off while you are talking to them.

Try this:

1. **Your maid.** Walk down to Xiu and press Space. Tip her, send her with a gift or silver to anyone at court, send her to buy cosmetics, or gossip.
2. **Morning respects.** Leave your room by the doorway at its bottom-right corner, walk to the big building in the middle and into its main hall. Consort Mei sits on her chair. Talk to her and pay your Morning respects.
3. **Greet her.** Press **End the Morning**. In the Day she is in the main hall, walking in the courtyard in front of it, or in her own room (the room to the right of the hall). The day card says which. In the hall or the courtyard, talk to her and greet her.
4. **Walk in on her.** When the day card says she is in "her own room", walk into it. You lose 2 relationship points with her, once a day, and she will not talk to you there. At relationship 50 she welcomes you in.
5. **Train Cooking.** Walk up to the kitchen, the second room from the left in the top row, and talk to Cook Zhao: **Cook alongside her**.
6. **Other training.** The study (top left) and the music room (the next room to the right of the kitchen) have their own menus: stand in the room and press Space. Attendant Yu is the regular of the music room. If she is there, ask her first, or practising costs 2 points with her.
7. **Courtyard chores.** Eunuch Li sweeps the left side of the courtyard in the Morning and Day. Talk to him.
8. **Doll up.** Stand in your own room, away from Xiu, and press Space.
9. **Night.** End the Day and the Evening. The ladies are asleep on their beds and the servants are in their quarters.

Three rooms are stand-ins, because the painting has no dressing room, sewing room or dance terrace: the small room below your own is the dressing room, the left room of the middle building is the sewing room, and the open court below the middle building is the dance terrace. The gate at the bottom is shut: leaving the palace arrives with the movement rules.

For map-making, add `?debug` to the address (<http://localhost:5173/?debug>) to see your position and the zone you stand in. Add `?seed=anything` to get different dice.

## Use your own Tiled map

The palace you see is a **stand-in** map, `assets/maps/consort-palace.json`. It uses your painting `assets/palace-layouts/consort-palace-furnished.jpg`. Its walls were traced from the painting by a script and its zone names are made up, so expect to adjust both. You can open it in Tiled and edit it, or replace it with your own.

A map works if it is saved from Tiled as JSON (`File > Export As`, type "JSON map files") into `assets/maps/`, and has:

| Layer | Type in Tiled | What it does |
| --- | --- | --- |
| any name | Image Layer | The painted background. One picture. |
| `collisions` | Object Layer | Every rectangle here blocks the player. |
| `zones` | Object Layer | Every rectangle here shows a prompt with the rectangle's **Name**. |

- Only rectangles count. Ellipses, polygons, points and rotated rectangles are skipped, and the position box says so.
- If there is a zone named `side_room_1`, the player starts in it. Otherwise she starts in the middle of the map.
- Keep the picture inside the `assets/` folder, so the game can find it.

To open a different map, add its file name (without `.json`) to the address: <http://localhost:5173/?map=my-palace> opens `assets/maps/my-palace.json`. To make it the map that opens by default, change `DEFAULT_MAP` in `client/src/config.ts`.

A map opened this way is for walking only: a red square labelled "Player", the position box in the top-left corner, and a prompt with the zone's name. The people and menus belong to the default palace, whose rooms are listed in `client/src/palace/palaceCourt.ts` and whose standing spots are in `client/src/palace/layout.ts`. In that map, zones that share a name are one room, and a zone covering the whole map (`courtyard`) is where you are when you are in no smaller zone.

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

With the game running (`npm run dev`), open <http://localhost:5173/sandbox.html>, or click **Rules sandbox** in the top-right corner of the palace.

The sandbox ignores rooms: every button works from anywhere. Use it to check a rule quickly; use the palace to play it.

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

The rules live in `shared/` and come only from `docs/GAME_LOGIC.md`. The palace and the sandbox both run them in the browser for now, because there is no server yet. The page only ever sends what you want to do; the rules decide what happens.

To run every test:

```
npm test
```

It should end with a line like `Tests  429 passed`, and no line containing "failed". To run the tests for one set of rules, add part of its file name, for example `npm test -- gifting`.

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
| `rules/places.ts` | The rooms of a palace and who is in which. Walking in on a lady in her own room, where NPC ladies and servants spend each phase, and who a spot's regular is. |
| `rules/act.ts` | The one door every player action comes through. It checks that she is standing in the right place with the right person, then runs the rule. |
| `rules/*.test.ts` | The tests for each of the above. |

Every rule works the same way: it is given the court as it is now and what someone wants to do, and it hands back a new court plus a list of what happened. It never changes the court it was given. If the action is not allowed, the court comes back untouched with one "refused" event that says why.

**Numbers the doc did not give.** Section 13 of `docs/GAME_LOGIC.md`, "Decided during the build", lists the points sections 1 to 12 left open and what was decided for each: how much an activity spot adds to Beauty, Intelligence or Obedience, what skipping Morning respects costs, selling sewing and drawings, guard stipends, the energy cost of each scheme, and what a new character starts with. Items 13.10 to 13.13 are the rules for rooms: what walking in on a lady costs, where each action is done, where the court spends each phase, and what a maid can be sent to do. They are starting values like every other number, and they sit together at the bottom of `balance.ts` under "Section 13".

## What is in each folder

| Folder | What it holds |
| --- | --- |
| `client/` | What the player sees: the Phaser game screen, the map loader, the prompt, the keyboard and touch controls. No game rules. `client/src/palace/` is the playable palace: who stands where, the menus, the day card and journal. `client/src/sandbox/` is the rules sandbox page. Both run the rules in the browser until there is a server. |
| `server/` | Empty for now. The game server arrives in later phases. |
| `shared/` | The game rules as plain code, with their tests. See [The game rules](#the-game-rules). Also reading a Tiled map, walking and being blocked by walls. |
| `assets/` | The art and Tiled files, as uploaded, plus `maps/`, where the game looks for Tiled JSON maps. |
| `docs/` | `GAME_LOGIC.md`, the source of truth for every game rule. |

## Placeholders

- The player's size, her walking speed, the zoom, the action keys (Space and Enter) and how often the people of the palace move while testing are stand-in values in `client/src/config.ts` and `client/src/scenes/AreaScene.ts`. They are not game rules.
- The people of the palace, their names and their starting stats are made-up test data in `client/src/sandbox/demoCourt.ts` and `client/src/palace/palaceCourt.ts`.
- The figures are cut from the character sheets in `assets/characters/` and do not animate yet. Where each figure is cut from, and where each person stands in each room, is in `client/src/palace/layout.ts`.
