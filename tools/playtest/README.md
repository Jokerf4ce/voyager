# Playtest bot

`playtest.py` plays whole games of Voyager in a headless browser and reports what happened. It runs the real game
code (it serves the repo locally and drives `index.html` with Playwright), so every rule, price and AI decision is
the real one. Use it to compare difficulties or check a balance change before and after.

## Setup

```
pip install playwright
python -m playwright install chromium
```

## Run

```
python3 tools/playtest/playtest.py                         # 5 games each on Learning and Commander, up to 200 Cycles
python3 tools/playtest/playtest.py -g 3 -c 120 commander   # 3 games of Commander, 120 Cycles
python3 tools/playtest/playtest.py --json results.json     # also save every game's details (timeline, raids, defences)
python3 tools/playtest/playtest.py --chrome /usr/bin/google-chrome   # use an installed Chrome
```

A run of 10 games × 200 Cycles takes about two minutes.

## What the bot does each Cycle

- Closes pop-ups and the new-ship splash; fights every battle on auto, defending with its strongest fleet at home.
- Scraps the starting scout (it only costs maintenance).
- Sends one survey probe at a time, sends colonists to the nearest free charted system, and settles more planets in
  its systems when Metal is plentiful. While expanding it keeps the Electronics and Chemicals for the next expedition.
- Builds up to two buildings: capacity first (power, habitation, compute), then whatever income is short
  (Metal, Rare, Electronics, Organics, Chemicals), then a fixed order; Bastions once raids are near.
- Builds one ship per Cycle while its fleet is below a target that grows with the Cycle, if the economy carries the
  maintenance; fills fleets from the hangar.
- Once raids are possible it keeps its strongest fleet at home and sends the others after weak targets.

It is a decent player, not a good one: it fights on auto and under-builds its fleet, so it loses more raid defences
than a human would. Compare results between difficulties or versions with the same bot rather than reading them as
absolute.

## Output

One line per game (Cycle reached, result, colonies, ships, raids, colonies lost, defences and attacks won-lost, xeno
systems), then a summary per difficulty. With `--json`, each game also has `snaps` (colonies, fleet power, Metal
income and maintenance at Cycles 25, 50, 100, 150, 200), `raids` (Cycle and size), `captured` and `defLog` (your
fleet's power against each raid's).
