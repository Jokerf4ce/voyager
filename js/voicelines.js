// Voyager — lines for the ship's computer voice (played by js/voice.js).
//
// Each line:
//   text      what she says (spoken by the browser's British female voice)
//   triggers  game events that can play this line (see the list below)
//   glitch    0..1 how broken-up it sounds: stutters, pitch slips, static (default 0.35)
//   chance    0..1 probability the line plays when triggered (default 1)
//   src       optional recorded audio file (e.g. 'assets/voice/welcome_back.mp3'); when set, the file is
//             played instead of the browser voice, and gets real distortion and stutter applied
//
// When a trigger fires, one matching line is picked at random. To add a line, add an entry here.
// To add a new trigger, call Voice.trigger('your_trigger') wherever it happens in the game.
//
// Triggers in use:
//   start   the first click or key press after the game loads
//   return  coming back after more than 5 minutes away (tab hidden or no activity)

const VoiceLines = {
  welcome_back: { text: 'Welcome back, Commander.', triggers: ['start', 'return'], glitch: 0.35 },
};

// Per-trigger settings: cooldown (seconds) stops the same trigger from repeating too often.
const VoiceTriggers = {
  start:  { cooldown: 0 },
  return: { cooldown: 60, idleMinutes: 5 },
};
