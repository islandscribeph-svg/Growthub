# Harem of the Qing: Gameplay Logic

Nov 16, 2026 · Peps

## 1. Core loop

The whole court runs on one shared clock, and every lady, player or NPC, gets the same limited energy per game day. Every number in this document is a proposed starting value to tune in playtesting.

**The game day.** One game day lasts 2 real hours, so twelve game days pass per real day. Each day has four phases:

| Phase | What happens |
| --- | --- |
| Morning | Ladies pay respects to their palace mistress. Mistresses pay respects to the Empress. Permission requests are answered. |
| Day | Free actions: train skills, doll up, visit, gift, gossip, prepare schemes. |
| Evening | The Emperor chooses one person. Banquets and performances happen here. |
| Night | The server resolves everything hidden: sabotage, detection, NPC schemes, favor decay, pregnancy. |

**Energy.** Each lady has 10 energy per game day. Training costs 2, socializing 1, a scheme 3 to 4. Unspent energy is lost at Night.

**What a player does in a session:**

1. Pay respects in the Morning (free, keeps Obedience and the mistress relationship from slipping).
2. Spend energy on training, dolling up, gifting, or scheming.
3. Try to be seen by the Emperor, directly or through someone who recommends her.
4. Check the Night report: what she gained, what was done to her, and any clues she found.

**How it ends.** She climbs by raising Emperor's Favor to each rank threshold. She falls by losing a trial, being ruined by sabotage, or being hated by the whole harem.

## 2. World and movement

Rank decides where a lady may walk. The lowest two ranks are locked inside their own palace until the mistress lets them out.

**Palaces.** There are 12 consort palaces. The mistress of each is its highest-ranked resident. The 13 capped seats below Empress (1 Imperial Noble Consort, 2 Noble Consorts, 4 Consorts, 6 Imperial Concubines) supply the mistresses. Every new lady gets a side room in the palace with the fewest players.

| Rank | Where she can go |
| --- | --- |
| Second and First Class Attendant | Own palace only. Needs a day pass from the mistress to leave. |
| Noble Lady | Lanes, Imperial Garden, and any palace whose mistress has not barred her. |
| Imperial Concubine and above | Everywhere except the Emperor's palace. Can be a palace mistress. |
| Anyone | Emperor's palace by summons only. Empress Dowager's palace by summons or at Noble Lady and above. |

**Asking permission.** At the palace gate, an attendant requests a day pass. It is granted if her relationship with the mistress is 40 or higher and her Obedience is 20 or higher. A player mistress sets a policy (allow all, ask me, deny all) and can answer requests herself. If she does not answer within one phase, or if the palace mistress is not in game, the relationship rule decides.

**Sneaking out.** An attendant can slip past the gate with a Plotting roll. If caught, she loses 10 Obedience and 10 relationship with her mistress.

**Special places.** The Cold Palace holds punished ladies. The Imperial Kitchen and Physician's hall are where poison ingredients and cures come from, so being seen there leaves a trail.

## 3. Stats and skill training

A lady improves by doing: each activity spot in a palace raises one talent, and talents feed the four attributes. All stats run 0 to 100.

| Activity spot | Talent raised | Also raises |
| --- | --- | --- |
| Dressing room | Makeup | Beauty |
| Study | Poetry, Drawing | Intelligence |
| Music pavilion | Instruments, Singing | Beauty (small) |
| Dance terrace | Dancing | Beauty |
| Sewing room | Sewing | Obedience (small) |
| Kitchen | Cooking | none |
| Courtyard chores (cleaning) | none | Obedience |
| Gossiping with servants, eavesdropping | Plotting | none |

**Gains.** Each training action costs 2 energy and adds 1 to 3 points to the talent. Gains shrink as the talent rises, so the last 20 points are slow.

**Dolling up.** In her own room, a lady can doll up for 1 energy. It gives a temporary Beauty bonus for that game day equal to a quarter of her Makeup.

**Childbearing.** It starts at 100 and never rises through training. Only sabotage lowers it, and only the Imperial Physician restores it, slowly and for silver.

**Silver.** Each lady receives a stipend every game day, scaled by rank. Silver buys ingredients, gifts, physician visits, and bribes. Section 9 has the amounts.

**Gift quality.** A cooked dish or sewn item rolls its quality as the maker's talent plus a random number from -10 to +10.

| Quality | Effect on the recipient's relationship with the giver |
| --- | --- |
| 60 or higher | +5 to +8 |
| 30 to 59 | +1 to +3 |
| Below 30 | -3 to -5 (the food is bad or the stitching is an insult) |

**Stepping on toes.** Each activity spot has a regular, usually the highest-ranked lady who trains there. Using it while she is present costs 2 relationship with her, unless the relationship is already 50 or higher or the player asks first.

## 4. Emperor's Favor and promotion

Favor is earned mostly in the Evening phase, when the Emperor picks one person, and promotion happens when favor crosses a threshold and a seat is free.

**Being seen.** The Emperor can only pick ladies he has noticed. A lady becomes noticed by performing at a banquet, meeting him in the Imperial Garden, being recommended by her mistress, the Empress or the Empress Dowager, or holding the rank of Noble Lady or above. Attendants start invisible, which is why the mistress relationship matters so much early on.

**The Evening choice.** Each noticed character gets a weight, and the Emperor picks one at random in proportion to it:

```
weight = Beauty x 0.4 + best talent x 0.2 + Favor x 0.2 + Intelligence x 0.1 + Obedience x 0.1
```

**The result of a night.** The chosen lady gains 5 to 10 favor. She may conceive, with a chance of 15% times her Childbearing divided by 100. A birth gives +25 favor for a prince and +15 for a princess. Section 11 covers what follows.

**Decay.** Favor drops by 1 each game day she is not chosen, so nobody coasts.

| Rank | Favor needed | Seats |
| --- | --- | --- |
| First Class Attendant | 25 | No limit |
| Noble Lady | 40 | No limit |
| Imperial Concubine | 55 | 6 |
| Consort | 68 | 4 |
| Noble Consort | 80 | 2 |
| Imperial Noble Consort | 90 | 1 |
| Empress | 100 | 1 |

**When the seats are full.** Every 7 game days there is a rank review. A lady who meets the threshold and has at least 15 more favor than the weakest seat-holder of that rank takes her seat, and the loser drops one rank. A seat also opens whenever its holder is demoted or sent to the Cold Palace.

**Empress.** The seat requires 100 favor, a vacancy, a relationship of 70 or higher with the Empress Dowager, and an average harem relationship of 30 or higher. A hated lady cannot be crowned.

## 5. Relationships

Every pair of characters has one relationship score from 0 to 100, starting at 30 for strangers, and hurting one lady also hurts the player's standing with that lady's friends. The grouped rows on the status panel are averages of these individual scores.

| Action | Change |
| --- | --- |
| Morning respects, a greeting | +1 |
| Good gift | +5 to +8 |
| Bad gift | -3 to -5 |
| Helping with her task, warning her of a plot | +3 to +10 |
| Using her activity spot uninvited | -2 |
| Bearing witness against her | -40 with her, -15 with each of her friends |
| Caught sabotaging her | -60 with her, -10 with everyone in her palace |

Scores never go below 0 or above 100.

**Friends.** Two characters are friends when their score is 70 or higher. Friends testify for each other in trials and warn each other of plots they discover.

**What the scores unlock:**

- Mistress at 40 or higher: day passes, and she may recommend the lady to the Emperor.
- Any lady at 70 or higher: she shares gossip and clues.
- Empress Dowager at 70 or higher: required for the Empress seat, and she can overturn one trial verdict.

**Being hated.** If a lady's average score across the harem falls below 15, she is hated. Her servants' loyalty drops by 20, bribing them against her costs half, and her defense against sabotage falls. This is the rule that makes a friendless Empress easy to poison.

## 6. NPCs

NPCs fill every role a player does not hold and follow the same rules as players, so the court is full and dangerous even with five people online.

| NPC | Role in play |
| --- | --- |
| Emperor | Always an NPC. Makes the Evening choice and rules on trials for Noble Lady and above. |
| Empress Dowager | Always an NPC. Values Obedience and children. Can recommend a lady or overturn a verdict. |
| Empress | An NPC until a player earns the seat. Rules on trials for the two attendant ranks. |
| Consort NPCs | Hold every ranked seat no player holds, including palace mistress. |
| Personal maid | One per lady. Has a Loyalty score from 0 to 100, which is her mistress's main defense. |
| Eunuchs, cooks, guards | Palace staff. Carry gifts and food, can be bribed, and notice who goes where. |
| Imperial Physician | Cures poison, restores Childbearing, and can be bribed to lie about either. |

**Consort NPCs have full stats and a personality.** The personality sets how she spends her energy each day:

| Personality | Behaviour |
| --- | --- |
| Ambitious | Trains hard and schemes against whoever is closest to her rank. |
| Jealous | Schemes against whoever the Emperor chose most recently. |
| Gentle | Socializes and gifts. Never schemes first, but testifies for friends. |
| Dutiful | Maxes Obedience, courts the Empress Dowager, reports rule-breakers. |
| Schemer | High Plotting. Bribes servants and fabricates evidence. |

**Choosing a target.** An NPC who decides to scheme picks the lady with the highest threat score, which is that lady's favor minus the relationship between them. Kindness therefore buys real safety.

**Routines.** NPCs walk a schedule tied to the phases: respects in the Morning, their favourite activity spot by Day, their rooms at Night. Players can learn a routine and use it.

**Servants.** Bribing a servant costs silver in proportion to Loyalty, and fails outright above 80. Loyalty rises when the lady gifts or is kind to the servant and falls when she is hated or punishes them.

**Making room for players.** When a player is promoted into a capped rank, the NPC with the lowest favor at that rank is demoted one step. NPCs can also win seats back at a rank review.

## 7. Sabotage, detection and trials

Every scheme is two rolls resolved at Night, one for whether it works and one for whether it is traced, and a traced scheme becomes evidence anyone can take to trial.

| Scheme | Needs | Effect if it works |
| --- | --- | --- |
| Poison her food | Ingredients from the kitchen or physician, a servant or gift to deliver it | Illness: no energy for 4 game days. If the Emperor summons her while she is ill, she cannot attend and loses 10 favor. Poison never kills. A fertility poison instead cuts Childbearing by 20 to 40. |
| Burn her belongings | Access to her room | She loses stored gifts and her doll-up bonus for 3 game days. |
| Bribe a servant to lie | Silver, a servant with Loyalty of 80 or less | Creates fabricated evidence against her, or a rumor that costs her 5 favor. |

**Roll 1, success:**

```
attacker = Plotting + random(1 to 50)
defender = target Plotting / 2 + maid Loyalty / 2 + 20
```

The scheme works if the attacker's total is higher. The defender gets +15 if a friend warned her, and -15 if she is hated.

**Roll 2, detection.** A failed scheme is traced 60% of the time. A successful one is traced with a chance of 30% minus a quarter of the attacker's Plotting, and never less than 5%. A traced scheme leaves a clue with the victim or a servant for 3 game days.

**Trials.** Any lady holding a clue, real or fabricated, can bear witness against the culprit. Each side gets a score:

```
score = Favor + Intelligence / 2 + Plotting / 2 + 10 per friend testifying + evidence
evidence = 30 if real, 15 if fabricated
```

Fabricated evidence has a 25% chance of being exposed, which hands the trial to the accused.

| Outcome | Accused | Witness |
| --- | --- | --- |
| Witness wins | Demoted one rank, -30 favor, 6 game days in the Cold Palace | +15 favor, and first claim on the vacated seat if she meets the threshold |
| Accused wins | No penalty | -20 favor, -10 Obedience |

Win or lose, the witness takes the relationship hit in section 5. Rising by trial is the fastest route up and the surest way to make enemies.

**The Empress Dowager's power.** A lady with a relationship of 70 or higher with the Empress Dowager can have one verdict overturned, once.

**Cold Palace.** A lady there cannot train, gift, or be chosen, and her favor decays at double speed.

## 8. Multiplayer

Players share one court and replace NPCs seat by seat, and the server alone decides every outcome so nobody can cheat a roll.

**The court.** A court is one copy of the palace with its own clock, Emperor and ranks. It holds up to 30 players, 2 or 3 per palace. When it fills, new players start a second court.

**Live and hidden.** Movement, chat, and seeing who is at which activity spot are live. Chat reaches the lady's own palace, plus private whispers. Everything with consequences (training gains, gifts, schemes, the Evening choice, trials) is sent to the server as an intent and resolved there, most of it at the phase change.

**Players and NPCs are interchangeable.** A player can scheme against, befriend, gift, and witness against either. A player mistress controls day passes for real attendants, and a player Empress rules on attendant trials.

**Offline protection.** A lady keeps existing while her player is away, so she needs cover:

- She follows standing orders the player set: pay respects, train one chosen talent, stay guarded.
- Her defense against schemes is +20 while offline.
- She can be hit by at most one successful scheme per game day.
- If she is accused, the trial waits 12 game days (one real day) for the player. After that it runs on her stats alone.
- A player mistress who is away never traps her attendants, because the relationship rule answers pass requests for her.

**Technical shape on Cloudflare.** One Durable Object per palace holds live positions and chat. One Durable Object per court holds the clock, favor, ranks, pending schemes and trials, and runs the phase tick. D1 stores characters, relationships and history.

**Seasons.** There are none. A court runs without end. Favor decay, rank reviews and trials keep seats changing hands, and a new player can join whenever a slot is free.

## 9. Money

Silver taels are the one currency: rank pays it out every game day, and gifts, cures and bribes spend it. All amounts are proposed starting values.

**Income.** The stipend arrives each Morning.

| Rank | Stipend per game day (taels) |
| --- | --- |
| Second Class Attendant | 5 |
| First Class Attendant | 8 |
| Noble Lady | 12 |
| Imperial Concubine | 20 |
| Consort | 30 |
| Noble Consort | 45 |
| Imperial Noble Consort | 60 |
| Empress | 100 |

Other ways to earn:

- The Emperor's reward after he chooses her: 10 to 30 taels.
- Selling her own sewing or drawings through a eunuch: quality divided by 5, in taels.
- A palace mistress may hand out allowances to her residents, which is how she buys loyalty.
- Silver given by another lady.

**Gifting.** A lady can make a gift or buy one. Homemade is cheap but rolls on her talent (section 3). Bought is safe but costs more.

| Gift | Cost (taels) | Relationship effect |
| --- | --- | --- |
| Homemade dish (ingredients) | 3 | Rolled on Cooking |
| Homemade sewn item (cloth) | 5 | Rolled on Sewing |
| Trinket | 10 | +2 |
| Fine jewelry | 40 | +5 |
| Rare treasure | 120 | +10 |

One gift per recipient per game day counts. A gift to someone ranked above her is worth half unless it is jewelry or better, so attendants cannot buy a Consort's friendship with trinkets.

**Bribing.** The price of a servant depends on how loyal she is and how important her mistress is:

```
bribe cost = servant Loyalty x target's rank number (1 to 8) / 2, minimum 10 taels
```

A maid with 60 Loyalty serving a Consort (rank 5) costs 150 taels. The same maid serving a Second Class Attendant costs 30. The cost is halved if the target is hated. A servant with Loyalty above 80 refuses and reports the attempt to her mistress.

| Bribe | What it buys |
| --- | --- |
| Spy (flat 10 taels) | A report of who visited the target that game day |
| Gate guard (flat 15 taels) | One trip out of the palace without a day pass |
| Carry a poisoned dish (bribe cost) | Delivery without the player being seen |
| Lie as a witness (bribe cost) | Fabricated evidence for a trial |
| Imperial Physician (flat 60 taels) | A false diagnosis, or silence about a real one |

**Bribes can come back.** A bribed servant questioned at trial confesses with a chance equal to half her Loyalty, as a percentage. Paying double the bribe cost removes that risk.

**Buying protection.** A lady can tip her own servants: 5 taels adds 2 Loyalty, up to 6 Loyalty per game day. A rich, generous lady is expensive to attack.

**Other costs.**

| Item | Cost (taels) |
| --- | --- |
| Poison ingredients | 25 |
| Fertility poison ingredients | 40 |
| Physician visit to cure illness | 15 |
| Restoring 10 points of Childbearing | 30 |
| Premium cosmetics (doubles that day's doll-up bonus) | 5 |

**Rules that keep it fair:**

- A lady's silver is hidden from everyone else and can never go below zero.
- Player-to-player transfers are capped at 50 taels per game day, to stop extra accounts feeding one lady.
- The loser of a trial is fined 20% of her silver. A lady in the Cold Palace receives no stipend.
- Every purchase is logged. Buying poison ingredients leaves a record a spy or an investigator can find, which becomes a clue.

## 10. Decisions made

These were open questions and are now settled. The sections above already reflect them.

- Nobody dies from poison. The worst outcomes are illness, lost Childbearing, missing an Emperor's summons (which lowers favor), demotion, and the Cold Palace.
- One game day is 2 real hours.
- Relationships run 0 to 100.
- A court holds 30 players and runs without end. There are no seasons.
- The silver amounts in section 9 are accepted as starting values.
- The Empress Dowager keeps her one-time power to overturn a verdict.
- A birth gives a big favor bonus, higher for a prince than a princess, plus a daily nurture task. Rivals can plot to separate mother and child (section 11).
- The male path is a romance with the Emperor (section 12).
- The Emperor chooses one person per Evening across both paths.

## 11. Children

A child is a large one-time favor bonus plus a daily duty, and rivals can scheme to take custody but can never harm the child.

**Birth.** A prince gives +25 favor and a princess +15. The mother of a prince also gains 10 relationship with the Empress Dowager.

**The bond.** Each child has a Bond score with the mother from 0 to 100, starting at 50.

- Visiting or nurturing the child costs 1 energy and adds 5 Bond.
- Each game day without a visit removes 5 Bond.
- While Bond is 50 or higher, the mother gains 1 favor per game day, which cancels normal decay.

**Scheme: separate mother and child.** A rival ranked Imperial Concubine or above can petition to raise the child herself.

- She needs evidence of neglect (Bond below 30) or a bribed servant who lies about it.
- The petition runs as a trial before the Empress Dowager, scored like any other trial.
- If the rival wins, the child moves to her care. The mother loses the daily bonus and 10 favor. The foster mother gains 1 favor every second game day.

**Winning the child back.** After 12 game days the mother can petition in return. She wins automatically if her relationship with the Empress Dowager is 70 or higher. Otherwise it is another trial.

**Hard limit.** Children cannot be poisoned, hurt, or targeted by any scheme except custody.

## 12. The male path (draft)

A man plays an imperial guard who rises by winning the Emperor's favor, competing for the same Evening choice as the ladies. The ladder below is based on the real Qing imperial guard ranks. The top title is invented for the game.

| Rank | Title | Seats |
| --- | --- | --- |
| 1 | Blue Feather Guard | No limit |
| 2 | Third Class Guard | No limit |
| 3 | Second Class Guard | No limit |
| 4 | First Class Guard | 6 |
| 5 | Guard of the Imperial Presence | 2 |
| 6 | The Emperor's Favorite | 1 |

**Start.** Character creation is limited to Blue Feather Guard. He lives in the guard barracks and is posted to the gate of one of the 12 palaces.

**Stats.** Favor, Beauty, Intelligence and relationships work as they do for ladies. Loyalty replaces Obedience. Martial Skill replaces Childbearing and can be injured by sabotage. Talents: Swordsmanship, Archery, Riding, Poetry, Calligraphy, Music, Chess and Plotting.

**Being noticed.** The Emperor notices a guard at the archery range, on a hunt, during night watch at the Emperor's palace, or through a recommendation from a senior guard. From Guard of the Imperial Presence upward he stands beside the Emperor daily and is always noticed.

**The romance.** Noticed guards enter the same Evening choice as the ladies, with Martial Skill counted as a talent. Being chosen gives 5 to 10 favor, the same as for a lady. He cannot bear a child, so he gets a different edge: once every 7 game days he can speak for or against one lady, moving her favor by 5.

**Discretion.** The relationship is an open secret that must stay unspoken. Each night with the Emperor adds to a Rumor score. A high Rumor score lowers his relationship with the Empress Dowager, and rivals can use it as evidence at trial. Spending silver on servants, or keeping high relationships in the barracks, brings it down.

**How men and ladies touch.**

- A gate guard decides who slips out without a day pass, so attendants will court or bribe him.
- Guards carry messages and gifts between palaces, and can be bribed to spy or to look away.
- A guard and a consort found alone together can be accused of impropriety by anyone, which ruins both if the trial is lost.
- Ladies and guards are rivals for the same Evening choice, so each has reason to scheme against the other, or to ally.

**Falling.** A guard who loses a trial is demoted one rank and posted to the frontier for 6 game days. It is his version of the Cold Palace.

**One choice per Evening.** The Emperor chooses one person per Evening across both paths, so ladies and guards compete for the same night.
