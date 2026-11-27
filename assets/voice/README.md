# Voice lines

The ship's computer voice plays mp3 files from this folder. Each file is named after its line id in
`js/voicelines.js`:

| File | Line | Triggers |
|---|---|---|
| `wake_up.mp3` | "Wake up, Commander, all systems operational." | a new game starts (first time, new galaxy, Begin anew) |
| `welcome_back.mp3` | "Welcome back, Commander." | loading a saved game; returning after 5+ minutes away |
| `still_here.mp3` | "Hey, are you still here?" | returning after 5+ minutes away; random announcement |
| `gagarin.mp3` | "Attention! Colonel Gagarin, please report to Medbay!" | random announcement |
| `shepard.mp3` | "Attention! Rear admiral Shepard, your keycard was found in engineering!" | random announcement |
| `hydrated.mp3` | "Commander, Make sure you stay hydrated" | random announcement |
| `slipspace.mp3` | "Warning! Slipspace rupture detected!" | battle start (combat, red alert) |
| `forces.mp3` | "Warning! Hostile forces inbound!" | battle start (combat, red alert) |
| `signatures.mp3` | "Warning! Unknown signatures detected!" | battle start (combat, red alert) |
| `hell.mp3` | "Commander! Give them hell!" | battle start (combat, red alert) |
| `construction.mp3` | "Construction completed!" | a building is finished or upgraded |
| `new_colony.mp3` | "New colony established, congratulations!" | a new colony is founded |

When several lines share a trigger, one is picked at random. The `return`, `combat`, `construction` and `colony` triggers only speak about one time in three (`chance: 0.33` in `VoiceTriggers`), so they don't nag. The Test button in Settings → Assistant plays any line. Lines with the `combat` trigger play at the start of every battle and show as a red alert transmission. The other lines added since (`second_monitor`, `posture`, `airlock`, `blink`, `coffee`, `cryopod`, `ripley`, …) are listed with their triggers in `js/voicelines.js`.

## How the voice is made

Use this recipe for every line so they all sound like the same ship's computer.

1. **Text-to-speech:** [text-to-speech.online](https://text-to-speech.online) with the voice preset **"Sonia - GB"**. Export the line as an mp3.
2. **Robotic effect in [Audacity](https://www.audacityteam.org/):**
   1. Open the mp3, select the whole track and apply **Effect → Echo**:
      - Delay time: **0.3 s**
      - Decay factor: **0.4**
   2. **Duplicate the track** (Edit → Duplicate).
   3. On the duplicate only, apply **Effect → Pitch and Tempo → Change Pitch** with **−3 %** frequency.
   4. Keep both tracks playing together: the slightly detuned copy gives the robotic double voice.
3. **Export** as mp3 (File → Export Audio), named `<line id>.mp3`, into this folder.

The game plays the file exactly as exported, with no extra effects, so the recipe above is the whole sound.
(`glitch` in `js/voicelines.js` only controls how much the on-screen caption glitches.)

**Tips:** trim the silence at the start and end, and normalise to around −3 dB peak so all lines are equally loud.

## Adding a line

1. Add an entry to `js/voicelines.js` with the line id, its text and its triggers.
2. Make the mp3 with the recipe above and save it here as `<line id>.mp3`.

Until the file exists, the line still shows on screen as a "SHIP AI" transmission.

Settings → Assistant shows whether each file played.
