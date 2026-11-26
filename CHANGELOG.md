# Changelog

Versions: MINOR for new features, PATCH for fixes and tweaks. The version shown in the game's bottom-right corner comes from `js/version.js`.

## 0.15.3 — 2026-11-26
- Fix: the voice could stay silent, for example when the game was opened straight from disk, where browsers block loading the file for the effects chain. Lines now fall back to plain playback (no live effects) when the effects path can't load them, and a failed file is retried after 30 seconds instead of never.
- The voice shares the music's audio channel when music is playing.
- Settings: "Computer voice" is now "Assistant"; Test plays `slipspace.mp3`; each voice file shows whether it plays with effects, plainly, or not at all.

## 0.15.2 — 2026-11-26
- First recorded voice line: `welcome_back.mp3` ("Welcome back, Commander.").
- `assets/voice/README.md` documents how the voice is made: text-to-speech.online with "Sonia - GB", then Audacity echo (0.3 s, decay 0.4) and a duplicated track pitched −3 %.

## 0.15.1 — 2026-11-26
- Voice: a missing voice file is only looked for once per session (less console noise). Reload after adding a file.

## 0.15.0 — 2026-11-26
- The ship's computer voice now plays mp3 files instead of the browser's built-in speech, so it works the same in every browser.
- Each line's file is `assets/voice/<line id>.mp3` (e.g. `welcome_back.mp3`). The game adds radio filtering, light distortion, stutters, dropouts and static live.
- Lines without a file yet are shown as on-screen transmissions only; Settings lists which files are missing.
- `assets/voice/README.md` lists the lines to record and how.

## 0.14.2 — 2026-11-26
- Fix: in browsers that block speech (Brave, Firefox with fingerprinting resistance), the voice played only noises. The game now detects this, keeps the static short, and shows the line as an on-screen transmission instead.
- Voice lines appear as glitching on-screen transmissions ("◆ SHIP AI") in every browser; Subtitles can be turned off in Settings.
- Settings explains when the browser has no usable voice.

## 0.14.1 — 2026-11-26
- Playable online through GitHub Pages: https://jokerf4ce.github.io/voyager/ (deploys on every push to `main`).
- Added `.nojekyll` so GitHub serves the files as they are.

## 0.14.0 — 2026-11-26
- Ship's computer voice: a British female voice says "Welcome back, Commander." when you start playing and when you return after more than 5 minutes away.
- Glitch effect: stuttered word fragments, small pitch slips, static, clicks and digital squelches, with the music ducked while she speaks.
- Reusable system: lines and triggers in `js/voicelines.js`; call `Voice.trigger('name')` from the game. Lines can also use recorded audio files, which get real distortion and stutter.
- Voice on/off, volume and a Test button in Settings.

## 0.13.0 — 2026-11-26
- Music playlist: several tracks that play in order, on shuffle or on repeat, with a track list, Play buttons and Next track in Settings. Choices are remembered.
- The existing piece is now the track "Cathedral of Ash" (unchanged).
- New track "Cold Drift": slow pads, distant FM bells and a faint choir, for exploring.
- New track "Iron Tide": a driving drum ostinato, low brass, pulsing strings and a choir, for war.
- New instruments: bell and low brass.
- Recorded tracks are supported: add `{ id, name, src: 'assets/music/file.mp3' }` to `js/tracks.js`.

## 0.12.0 — 2026-11-26
- Music: an original generative soundtrack synthesised live in the browser. A monk choir chants over a low drone, with slow strings and war drums that swell during battles. Inspired by the mood of Halo's choral scores; no audio files.
- Music on/off button (♪) in the top bar, and a volume slider in Settings; both are remembered.
- Fix: the first click after loading no longer gets lost.
- Top bar fits on one row at 1400 px and wider.

## 0.11.1 — 2026-11-26
- Polymers renamed to Electronics (⌁). The Polymer Refinery is now the Electronics Foundry, and Catalytic Cracking is now Microfabrication.
- Old saves start a new game.

## 0.11.0 — 2026-11-26
- New resource system. Gathered: Metals, Rare Minerals, Organics. Refined: Polymers (Metals + Rare), Chemicals (Organics + Rare).
- Power, Compute and Infrastructure are capacities. Research is made by Research Labs.
- Each planet class has its own yields for the gathered resources, scaled by planet size; dwarfs and stellar remnants are rich in Rare Minerals.
- New buildings: Bio-Harvester, Atmosphere Skimmer, Chemical Plant, Solar Array, Research Lab. The Fusion Core is now a Fusion Reactor (Power).
- The capital starts with the whole production chain running.
- Old saves start a new game.

## 0.10.0 — 2026-11-26
- Version display in the bottom-right corner of the screen, and this changelog.

## 0.9.1 — 2026-11-26
- Fix: stars and planets on the maps could not be clicked in short or wide windows (letterboxed canvas).
- Map tabs stay on one line so the map no longer jumps when the selection changes.

## 0.9.0 — 2026-11-26
- Rare special systems: White Dwarfs, Pulsars and Black Holes, with their own art and bonuses.
- Small planets are drawn at least 8 px across on the solar system map.

## 0.8.0 — 2026-11-26
- The 10 systems nearest home are charted at the start.
- New Red Hypergiant star class, placed once near the start.
- Star surfaces get convection and starspot texture.

## 0.7.1 — 2026-11-26
- Solar system map drawn to scale: real radius ratios between stars and planets.

## 0.7.0 — 2026-11-26
- Solar system map: one system with its star, planets on orbits, colonies and fleets.
- Planets ordered hot to frozen outward from the star.

## 0.6.0 — 2026-11-26
- Star classes O, B, A, F, G, K, M with effects on planets, Infrastructure and habitability.

## 0.5.0 — 2026-11-26
- Planets classified by size, composition and temperature (eight classes).
- Extremely Hazardous planets have no buildable surface.
- The capital is a Large Terran World with Natural Life Support.

## 0.4.2 — 2026-11-26
- Habitability cost multipliers per layer (surface/orbit): 7.5/2.5, 5/2, 4/1, 2.5/1, 1/1.

## 0.4.1 — 2026-11-26
- Habitability levels renamed: Extremely Hazardous, Hazardous, Barren, Habitable, Natural Life Support.

## 0.4.0 — 2026-11-26
- Planet habitability 1–5 that changes building costs.

## 0.3.0 — 2026-11-26
- Several planets per system, each with a surface and an orbit building layer.

## 0.2.0 — 2026-11-25
- New resources: Metal, Rare Minerals, Polymers, Compute, Infrastructure (capacity).

## 0.1.0 — 2026-11-25
- First playable proof of concept.
