// Voyager — lines for the ship's computer voice (played by js/voice.js).
//
// Each line is an mp3 file named after the line id: assets/voice/<id>.mp3 (e.g. assets/voice/welcome_back.mp3).
//   text      what she says; also shown on screen as a "AI Assistant" transmission
//   triggers  game events that can play this line (see the list below)
//   glitch    0..1 how much the on-screen transmission text glitches (default 0.35); the audio plays as recorded
//   chance    0..1 probability the line plays when triggered (default 1)
//   style     optional on-screen look for this line: 'danger' = red transmission (default: the trigger's style)
//   src       optional: a different file path instead of assets/voice/<id>.mp3
//
// When a trigger fires, one matching line is picked at random. To add a line: add an entry here and put
// its mp3 in assets/voice/. Until the file exists, the line is shown on screen only.
// To add a new trigger, call Voice.trigger('your_trigger') wherever it happens in the game.
//
// Triggers in use:
//   start   the first click or key press after the game loads
//   return  coming back after more than 5 minutes away (tab hidden or no activity)
//   test    the Test button in Settings (Assistant): plays any line at random
//   random  ship announcements at a random moment every 5 to 30 minutes while you play
//           (never the same line twice in a row if there is a choice; skipped while the tab is hidden)
//   combat  the start of every battle (attacks and raid defenses); shown in danger red
//
// When several lines share a trigger, one of them is picked at random each time.
// Trigger options below: cooldown (seconds), noRepeat (never the same line twice in a row),
// style (on-screen look of the transmission: 'danger' = red instead of the normal blue).
//
// Lines with an empty text play without an on-screen transmission.
// The mp3 is played exactly as recorded: add the robotic effect in the file (see assets/voice/README.md).

const VoiceLines = {
  wake_up:        { text: 'Wake up, Commander, all systems operational.', triggers: ['first'], glitch: 0.35 },
  welcome_back:   { text: 'Welcome back, Commander.', triggers: ['start', 'return'], glitch: 0.35 },
  gagarin:        { text: 'Attention! Colonel Gagarin, please report to Medbay!', triggers: ['random'], glitch: 0.35 },
  shepard:        { text: 'Attention! Rear admiral Shepard, your keycard was found in engineering!', triggers: ['random'], glitch: 0.35 },
  still_here:     { text: 'Hey, are you still here?', triggers: ['random', 'return'], glitch: 0.35 },
  hydrated:       { text: 'Commander, Make sure you stay hydrated!', triggers: ['random'], glitch: 0.35 },
  second_monitor: { text: 'Commander, what is that on your second monitor?', triggers: ['random'], glitch: 0.35 },
  posture:        { text: 'Commander, make sure to keep a healthy posture!', triggers: ['random'], glitch: 0.35 },
  ripley:         { text: 'Attention! Warrant Officer Ripley, the cat is loose in the cargo bay again.', triggers: ['random'], glitch: 0.35 },
  cryopod:        { text: 'Cryo pod seven reports an occupant who is... awake. Please stand by.', triggers: ['random'], glitch: 0.45 },
  coffee:         { text: 'Reminder: the coffee in the officers lounge is not a fuel substitute.', triggers: ['random'], glitch: 0.35 },
  airlock:        { text: 'Airlock three cycling. Whoever is in there, please knock twice.', triggers: ['random'], glitch: 0.4 },
  blink:          { text: 'Commander, remember to blink. Your crew finds it unsettling.', triggers: ['random'], glitch: 0.35 },
  slipspace:      { text: 'Warning! Slipspace rupture detected!', triggers: ['combat'], glitch: 0.35 },
  forces:         { text: 'Warning! Hostile forces inbound!', triggers: ['combat'], glitch: 0.35 },
  signatures:     { text: 'Warning! Unknown signatures detected!', triggers: ['combat'], glitch: 0.35 },
  hell:           { text: 'Commander! Give them hell!', triggers: ['combat'], glitch: 0.35 },
  construction:   { text: 'Construction completed!', triggers: ['construction'], glitch: 0.35 },
};

// Per-trigger settings: cooldown (seconds) stops the same trigger from repeating too often.
const VoiceTriggers = {
  first:  { cooldown: 0 },          // a brand-new game (instead of 'start')
  start:  { cooldown: 0 },
  return: { cooldown: 60, idleMinutes: 5 },
  test:   { cooldown: 0 },
  random: { cooldown: 0, minMinutes: 5, maxMinutes: 30, noRepeat: true },
  combat: { cooldown: 0, style: 'danger' },
};
