#!/usr/bin/env python3
"""Voyager playtest bot: a scripted player plays whole games in a real (headless) browser and reports what happened.

It drives the actual game code (js/*.js) through Playwright, so every rule, cost and AI decision is the real one.
The bot plays sensibly but simply: it expands steadily, keeps its economy balanced, builds a fleet once raids are
near, keeps its strongest fleet at home and attacks weak targets. Every battle is fought on auto. A skilled human
should do better, so read the results as tendencies, and compare difficulties with the same bot.

Setup (once):   pip install playwright && python -m playwright install chromium
Run:            python3 tools/playtest/playtest.py                      # 5 games each on Learning and Commander, 200 Cycles
                python3 tools/playtest/playtest.py -g 3 -c 120 commander
                python3 tools/playtest/playtest.py --json results.json  # also save every game's details
Options:        --chrome PATH  use an installed Chrome/Chromium instead of Playwright's own
                --port N       port for the local web server (default 8765)

Per game it prints: the Cycle reached, win/lose, colonies, ships, raids (count and first Cycle), colonies lost to
raids, defences and attacks won/lost, and xeno systems. A summary per difficulty follows.
"""
import argparse, json, os, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # the repo: index.html lives here

# The bot, injected into the page. T collects statistics through hooks on the game's own functions.
BOT = r"""
window.T = { raids: [], captured: [], lostShips: 0, built: 0, defended: { win: 0, lose: 0 }, attacks: { win: 0, lose: 0 }, snaps: {}, stall: 0 };
// hooks: raids launched, colonies captured, battles
(() => {
  const push = G.threats.push;
  const origTick = AI.tick.bind(AI);
  AI.tick = () => { const before = G.threats.length; origTick(); for (const t of G.threats.slice(before)) T.raids.push({ c: G.cycle, n: t.ships.length, owner: t.owner, power: Math.round(Ships.groupPower(t.ships)), mine: AI.playerStrength ? Math.round(AI.playerStrength()) : null }); };
  const cap = Colonies.capture.bind(Colonies);
  Colonies.capture = (sid, owner) => { const s = G.systems[sid]; if (s.owner === 'player' && owner !== 'player') T.captured.push({ c: G.cycle, sys: s.name, planets: s.planets.filter(p => p.colony).length }); return cap(sid, owner); };
  const fin = Battle.finish.bind(Battle);
  Battle.finish = (r) => { const b = G.battle; if (b && b.phase !== 'over') { const k = b.kind === 'defend' ? 'defended' : 'attacks'; T[k][r === 'win' ? 'win' : 'lose']++; } return fin(r); };
  const bld = Ships.build.bind(Ships);
  Ships.build = (z) => { const s = bld(z); if (s) T.built++; return s; };
})();

window.bot = () => {
  if (UI.splash) UI.closeSplash();
  if (UI.modalOpen) { const b = document.querySelector('#modal [data-act]'); if (b) b.click(); else UI.closeModal(); }
  // battles: defend with the strongest fleet at home, then let it play out
  let g = 0;
  while (G.battle && g++ < 10) {
    if (G.battle.phase === 'setup') {
      const f = Ships.idleFleets().sort((a, b) => Ships.groupPower(Ships.fleetShips(b)) - Ships.groupPower(Ships.fleetShips(a)))[0];
      T.defLog = T.defLog || [];
      const th = G.battle.threat;
      T.defLog.push({ c: G.cycle, idle: Ships.idleFleets().length, fleets: G.fleets.length, mine: f ? Math.round(Ships.groupPower(Ships.fleetShips(f))) : 0,
        raid: th ? Math.round(Ships.groupPower(th.ships)) : null, home: G.battle.sys === G.homeId, total: Math.round(Ships.groupPower(Ships.all())) });
      Battle.defendWith(f ? f.id : null);
    }
    if (G.battle.phase === 'fight') Battle.resolve();
    if (G.battle && G.battle.phase === 'over') Battle.close();
  }
  const caps = Economy.caps(), net = Economy.net(), cost = (c) => Colonies.canAfford(c);
  const planets = Colonies.playerPlanets().length;
  const yard = Colonies.yards().length > 0;
  const raidsSoon = G.raidsOpen || (AI.raids().fromCycle && G.cycle > AI.raids().fromCycle - 8);

  // expansion first: survey nearby, send colonists, settle planets in owned systems
  const cands = G.systems.filter((s) => s.explored && !s.owner && !Missions.guard(s)).length;
  if (!G.surveys.length && (cands < 2 || G.res.metal > 140)) {
    const sv = G.systems.filter((s) => !Missions.surveyBlocker(s.id)).sort((a, b) => Missions.distance(a.id) - Missions.distance(b.id))[0];
    if (sv) Missions.survey(sv.id);
  }
  if (!G.expeditions.length) {
    const c = G.systems.filter((s) => s.explored && !s.owner && !Missions.colonizeBlocker(s.id, Galaxy.bestPlanet(s))).sort((a, b) => Missions.distance(a.id) - Missions.distance(b.id))[0];
    if (c) Missions.colonize(c.id, Galaxy.bestPlanet(c));
  }

  // the starting scout only costs maintenance: break it up on the first Cycle
  if (G.cycle === 1) for (const sh of Ships.all()) if (sh.type === 'scout') Ships.scrap(sh.id);
  // while expanding, keep enough in store for the next colony expedition
  const expanding = planets < 8 && !G.expeditions.length && G.systems.some((s) => s.explored && !s.owner);
  const cc = State.cost(DATA.colonize.cost), reserve = expanding ? { electronics: cc.electronics, chemicals: cc.chemicals } : {};
  const afford = (c) => Object.entries(c).every(([k, v]) => G.res[k] - (reserve[k] || 0) >= v);
  const tryBuild = (k) => { const x = Colonies.best(k); if (!x || x.why || !afford(x.cost)) return false; return Colonies.build(x.ref, x.layer, k); };
  for (const s of Colonies.playerSystems()) for (const p of s.planets) if (!p.colony && afford(Colonies.settleCost(p)) && G.res.metal > 120) Colonies.settle(s.id, p.idx);
  // economy: capacity first, then a fixed priority, a couple of builds per Cycle
  const want = [];
  if (caps.power.free < 2) want.push('fusion', 'solar');
  if (caps.infra.free < 2) want.push('dome', 'ring');
  if (caps.compute && caps.compute.free < 1) want.push('cogitator');
  if (!yard) want.push('shipyard');
  if (net.metal < 4) want.push('mine');
  if (net.rare < 1.5) want.push('drill');
  if (net.electronics < 3) want.push('refinery');
  if (net.organics < 1) want.push('harvester');
  if (net.chemicals < 1) want.unshift('chemplant');
  want.push('drill', 'mine', 'lab', 'refinery', 'chemplant');
  if (raidsSoon) want.unshift('bastion');
  if (G.cycle > 40) want.push('platform', 'finance');
  let builds = 0;
  for (const k of want) { if (builds >= 2) break; if (tryBuild(k)) builds++; }

  // military: once raids are near, keep building while the economy carries the upkeep
  const power = Ships.groupPower(Ships.all());
  const goal = raidsSoon ? 60 + G.cycle * 4 : 30;
  if (yard && power < goal && net.metal > 2 && net.chemicals > 0.3) {
    for (const z of ['M', 'S', 'L']) if (!Ships.blocker(z) && afford(Ships.buildCost(z)) && G.res.metal > 80) { Ships.build(z); break; }
  }
  // fleets: hangar ships fill fleets
  for (const s of Ships.hangar()) { let f = G.fleets.find((x) => !x.mission && x.ships.length < 5); if (!f) f = Ships.newFleet(); Ships.assign(s.id, f.id); }
  // attack weak targets, but always keep the strongest fleet at home once raids are possible
  const idle = Ships.idleFleets().sort((a, b) => Ships.groupPower(Ships.fleetShips(b)) - Ships.groupPower(Ships.fleetShips(a)));
  const free = raidsSoon ? idle.slice(1) : idle;
  for (const f of free) {
    const p = Ships.groupPower(Ships.fleetShips(f));
    const t = G.systems.filter((s) => s.explored && Missions.hostile(s) && !Missions.targeted(s.id, 'attack'))
      .map((s) => ({ s, e: Missions.guard(s) ? Ships.groupPower(Missions.guard(s).ships) : 10 })).filter((x) => p > x.e * 1.5).sort((a, b) => a.e - b.e)[0];
    if (t) Missions.launch(f.id, 'attack', t.s.id);
  }
  Game.endCycle();
  for (const c of [25, 50, 100, 150, 200]) if (G.cycle === c) T.snaps[c] = { planets: Colonies.playerPlanets().length, systems: Colonies.playerSystems().length,
    power: Math.round(Ships.groupPower(Ships.all())), ships: Ships.all().length, metalNet: +Economy.net().metal.toFixed(1), upkeep: +Ships.upkeep().toFixed(1),
    ai: AI.ids.map((id) => G.systems.filter((s) => s.owner === id).length).join('/') };
};
"""

SUMMARY = """JSON.stringify({ cycle: G.cycle, over: G.over, planets: Colonies.playerPlanets().length, systems: Colonies.playerSystems().length,
  ships: Ships.all().length, built: T.built, raids: T.raids, captured: T.captured, defended: T.defended, attacks: T.attacks, snaps: T.snaps,
  defLog: T.defLog || [], firstRaid: T.raids.length ? T.raids[0].c : null, stats: G.stats,
  ai: AI.ids.map((id) => G.systems.filter((s) => s.owner === id).length), aiAlive: AI.ids.filter((id) => G.ai[id].alive).length,
  res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v)])) })"""


def play(browser, url, difficulty, cycles):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url)
    pg.wait_for_timeout(600)
    pg.evaluate(f"Game.startWith('{difficulty}')")
    pg.evaluate('Tutorial.finish()')
    pg.evaluate('Voice.enabled = false; Music.enabled = false; Sfx.enabled = false')
    pg.evaluate(BOT)
    for _ in range(cycles):
        pg.evaluate('bot()')
        if pg.evaluate('!!G.over'):
            break
    r = json.loads(pg.evaluate(SUMMARY))
    r['errors'] = errors[:3]
    ctx.close()
    return r


def main():
    ap = argparse.ArgumentParser(description='Voyager playtest bot')
    ap.add_argument('difficulties', nargs='*', default=['learning', 'commander'])
    ap.add_argument('-g', '--games', type=int, default=5, help='games per difficulty (default 5)')
    ap.add_argument('-c', '--cycles', type=int, default=200, help='Cycles per game at most (default 200)')
    ap.add_argument('--json', help='save every game to this file')
    ap.add_argument('--chrome', default=os.environ.get('CHROME'), help='path to a Chrome/Chromium binary')
    ap.add_argument('--port', type=int, default=8765)
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright

    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(a.port), '--bind', '127.0.0.1'], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    url = f'http://127.0.0.1:{a.port}/index.html'
    results = {}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(**({'executable_path': a.chrome} if a.chrome else {}))
            for d in a.difficulties:
                results[d] = []
                for i in range(a.games):
                    r = play(browser, url, d, a.cycles)
                    results[d].append(r)
                    print(f"{d} {i + 1}: cycle {r['cycle']} {r['over'] or 'alive'} | colonies {r['planets']} | ships {r['ships']} | "
                          f"raids {len(r['raids'])} (first C{r['firstRaid']}) | lost {len(r['captured'])} | "
                          f"defended {r['defended']['win']}-{r['defended']['lose']} | attacks {r['attacks']['win']}-{r['attacks']['lose']} | "
                          f"xenos {r['ai']} | errors {len(r['errors'])}", flush=True)
            browser.close()
    finally:
        srv.kill()

    print()
    for d, games in results.items():
        lost = [g for g in games if g['over'] == 'lose']
        snap = lambda c: [g['snaps'].get(str(c), {}).get('planets') for g in games]
        print(f"{d}: {len(games) - len(lost)}/{len(games)} survived" + (f" (lost at Cycles {sorted(g['cycle'] for g in lost)})" if lost else '')
              + f" | colonies at C50 {snap(50)}, C100 {snap(100)}, C200 {snap(200)}"
              + f" | first raid {[g['firstRaid'] for g in games]}"
              + f" | defences won {sum(g['defended']['win'] for g in games)}/{sum(g['defended']['win'] + g['defended']['lose'] for g in games)}")
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(results, f, indent=1)


if __name__ == '__main__':
    main()
