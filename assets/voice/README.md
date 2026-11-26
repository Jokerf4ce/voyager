# Voice lines

The ship's computer voice plays mp3 files from this folder. Each file is named after its line id in
`js/voicelines.js`:

| File | Line | Triggers |
|---|---|---|
| `welcome_back.mp3` | "Welcome back, Commander." | game start; returning after 5+ minutes away |

**Voice:** British accent, female, calm ship's-computer delivery. Record it clean: the game adds the
radio filtering, light distortion, stutters, dropouts and static itself, a bit differently every time.

**Tips:** mono or stereo mp3, 44.1 kHz, about 128–192 kbps. Trim the silence at the start and end.
Normalise to around −3 dB peak.

**To add a line:** add an entry to `js/voicelines.js` (id, text, triggers), then drop `<id>.mp3` here.
Until the file exists, the line still shows on screen as a "SHIP AI" transmission.
