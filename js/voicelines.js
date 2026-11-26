// Voyager — lines for the ship's computer voice (played by js/voice.js).
//
// Each line is an mp3 file named after the line id: assets/voice/<id>.mp3 (e.g. assets/voice/welcome_back.mp3).
//   text      what she says; also shown on screen as a "SHIP AI" transmission
//   triggers  game events that can play this line (see the list below)
//   glitch    0..1 how much the on-screen transmission text glitches (default 0.35); the audio plays as recorded
//   chance    0..1 probability the line plays when triggered (default 1)
//   src       optional: a different file path instead of assets/voice/<id>.mp3
//
// When a trigger fires, one matching line is picked at random. To add a line: add an entry here and put
// its mp3 in assets/voice/. Until the file exists, the line is shown on screen only.
// To add a new trigger, call Voice.trigger('your_trigger') wherever it happens in the game.
//
// Triggers in use:
//   start   the first click or key press after the game loads
//   return  coming back after more than 5 minutes away (tab hidden or no activity)
//   test    the Test button in Settings (Assistant)
//
// Lines with an empty text play without an on-screen transmission.
// The mp3 is played exactly as recorded: add the robotic effect in the file (see assets/voice/README.md).

const VoiceLines = {
  welcome_back: { text: 'Welcome back, Commander.', triggers: ['start', 'return'], glitch: 0.35 },
  slipspace:    { text: 'Slipspace rupture detected!', triggers: ['test'], glitch: 0.35 }, // played by the Test button in Settings
};

// Per-trigger settings: cooldown (seconds) stops the same trigger from repeating too often.
const VoiceTriggers = {
  start:  { cooldown: 0 },
  return: { cooldown: 60, idleMinutes: 5 },
  test:   { cooldown: 0 },
};
