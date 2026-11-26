# Voice lines

The ship's computer voice plays mp3 files from this folder. Each file is named after its line id in
`js/voicelines.js`:

| File | Line | Triggers |
|---|---|---|
| `welcome_back.mp3` | "Welcome back, Commander." | game start; returning after 5+ minutes away |
| `slipspace.mp3` | (slipspace line) | the Test button in Settings → Assistant |

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

The game then adds its own live effects on top: radio filtering, light distortion, stutters, dropouts and
static, a bit differently every time. If a line sounds too broken up, lower its `glitch` value in
`js/voicelines.js` (default 0.35).

**Tips:** trim the silence at the start and end, and normalise to around −3 dB peak so all lines are equally loud.

## Adding a line

1. Add an entry to `js/voicelines.js` with the line id, its text and its triggers.
2. Make the mp3 with the recipe above and save it here as `<line id>.mp3`.

Until the file exists, the line still shows on screen as a "SHIP AI" transmission.

Played over the web (GitHub Pages), lines get the game's live effects. Opened straight from disk, the browser blocks
the effects chain, so lines play plainly (your Audacity effects are still there). Settings → Assistant shows which way
each file plays.
