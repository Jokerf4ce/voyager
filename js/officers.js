// Voyager — officers rolled for each new game: name, rank, title, story, portrait (js/faces.js), two passives and an ability.
// The rolled officers live in G.officerDefs; DATA.officers reads them (see js/data.js). Saves from before v0.73 keep
// the three hand-made officers (DATA.officerPresets).

const Officers = {
  first: ['Vashti', 'Oren', 'Iszra', 'Malachai', 'Severa', 'Dravin', 'Ilse', 'Corvin', 'Thessaly', 'Bastian', 'Nerys', 'Kasimir', 'Odile',
    'Varro', 'Seraphine', 'Aldric', 'Yara', 'Lucan', 'Mireth', 'Tobias', 'Halvard', 'Ysolde', 'Caius', 'Petra', 'Ezra', 'Rhosyn', 'Gideon', 'Anouk'],
  last: ['Kroll', 'Sable', 'Voss', 'Harrow', 'Kade', 'Mournt', 'Thale', 'Grieve', 'Ashcombe', 'Vael', 'Corran', 'Steelwright', 'Duskmere', 'Ravik',
    'Halloran', 'Orsk', 'Brannoch', 'Quill', 'Venn', 'Calder', 'Marrow', 'Strand', 'Ironside', 'Lethe', 'Morrow', 'Blackwood'],
  ranks: ['Admiral', 'Vice Admiral', 'Commodore', 'Commander', 'Captain', 'Fleet Augur', 'Wing Commander', 'Lord Captain', 'Fleet Marshal'],
  titleA: ['The Iron', 'The Grey', 'The Last', 'The Hollow', 'The Burning', 'The Silent', 'The Red', 'The Pale', 'The Black', 'The Broken', 'The Patient', 'The Drowned'],
  titleB: ['Matron', 'Wolf', 'Saint', 'Lantern', 'Widow', 'Hound', 'Oracle', 'Butcher', 'Shepherd', 'Choir', 'Knife', 'Anchor', 'Crown'],
  pasts: [
    'Forty years at the helm and not one ship surrendered.',
    'Officially died at Tharsis. Unofficially, nobody who saw it there lived to file the report.',
    'Gave both eyes to the warp-choirs and got something better back.',
    'Rose from the reactor decks after the mutiny on the Penitent Star.',
    'Held the Caldera gate for nine days with three frigates and a prayer.',
    'Born on a prison hulk; earned a commission by sinking the hulk\'s captors.',
    'The only survivor of the Ninth Expedition, and does not speak of it.',
    'Was a smuggler until the Covenant made a better offer.',
    'Trained by the old admiralty, and outlived every one of them.',
    'Wears the ashes of a lost fleet in a locket and visits the memorial every Cycle.',
  ],
  quirks: [
    'Does not raise their voice; does not need to.',
    'Counts every shell fired and every one that missed.',
    'Prays before every jump and never says to whom.',
    'Keeps a deck of cards and plays one hand before each battle.',
    'Sleeps on the bridge, if at all.',
    'Has never lost a duel, at cards or at range.',
    'The crews call it luck. It calls it arithmetic.',
    'Hums old hymns over the open channel during the worst of it.',
  ],
  // passives: [stat, low, high, text]; values rolled between low and high (Battle.officerPassives applies them)
  passives: [
    ['hull', 0.08, 0.14, (v) => `+${Math.round(v * 100)} % hull for every ship`],
    ['dmgL', 0.10, 0.16, (v) => `+${Math.round(v * 100)} % damage for Large ships`],
    ['evade', 4, 8, (v) => `+${v} evasion for every ship`],
    ['speedS', 1, 3, (v) => `+${v} speed for Small ships`],
    ['acc', 0.04, 0.07, (v) => `+${Math.round(v * 100)} % hit chance`],
    ['energy', 0.10, 0.15, (v) => `+${Math.round(v * 100)} % damage with energy weapons`],
  ],
  // one ability each (Battle.abilities)
  abilities: {
    holdline: { name: 'Hold the Line', text: 'Every ship of yours regains 30 % of its max shields.' },
    smoke: { name: 'Smoke and Mirrors', text: 'Until the end of the round, enemy shots have half their hit chance.' },
    ruin: { name: 'Prophecy of Ruin', text: 'The ship your active ship targets loses all its shields.' },
  },
  palette: {
    skin: ['#f0d0b4', '#ecc8a8', '#e0b090', '#d0a080', '#c89a78', '#b08870', '#a87858', '#8a5a3c', '#6e4630', '#5e3c28', '#d8c0a8', '#b0a090', '#a0b0a0', '#9890b0'],
    hair: ['#1c1410', '#3a2a20', '#6a4024', '#a06030', '#c08040', '#d0b080', '#c0b8b0', '#e8e0d0', '#602020', '#2a3040', '#405030'],
    trim: ['#d0a040', '#c8a040', '#b0b0b8', '#c07040', '#a04040'],
  },

  // A random portrait spec for Faces.render (the Face Workshop's random face, a bit more restrained).
  face() {
    const P = Faces.parts, r = (s) => U.pick(Object.keys(P[s]));
    const hsl = (h, s, l) => `hsl(${Math.round(h)},${Math.round(s * 100)}%,${Math.round(l * 100)}%)`;
    const h = Math.random() * 360;
    return {
      head: r('head'), eyes: r('eyes'), brows: r('brows'), nose: r('nose'), mouth: r('mouth'), hair: r('hair'),
      beard: Math.random() < 0.6 ? 'none' : r('beard'), headgear: Math.random() < 0.55 ? 'none' : r('headgear'), outfit: r('outfit'),
      marks: Object.keys(P.marks).filter(() => Math.random() < 0.12).slice(0, 3), bg: r('bg'),
      colors: { skin: U.pick(this.palette.skin), hair: U.pick(this.palette.hair), iris: hsl(Math.random() * 360, 0.45, 0.5), cloth: hsl(h, 0.3, 0.2),
        cloth2: hsl(h, 0.15, 0.6), trim: U.pick(this.palette.trim), metal: hsl(h, 0.08, 0.35), glow: hsl(Math.random() * 360, 0.85, 0.62), bg: hsl(Math.random() * 360, 0.35, 0.1) },
    };
  },

  // n officers with different names and one ability each (the first leads the Home Guard). A new game rolls one (State.newGame).
  generate(n = 3) {
    const out = {}, abil = U.shuffle(Object.keys(this.abilities));
    // no two officers of a game share a first name, surname, rank, title word or story
    const [first, last, ranks, tA, tB, pasts, quirks] = [this.first, this.last, this.ranks, this.titleA, this.titleB, this.pasts, this.quirks].map((a) => U.shuffle([...a]));
    for (let i = 0; i < n; i++) {
      const name = `${first[i % first.length]} ${last[i % last.length]}`;
      const roll = (lo, hi) => (Number.isInteger(lo) && Number.isInteger(hi) ? lo + Math.floor(Math.random() * (hi - lo + 1)) : Math.round((lo + Math.random() * (hi - lo)) * 100) / 100);
      const passives = U.shuffle([...this.passives]).slice(0, 2).map(([stat, lo, hi, text]) => { const value = roll(lo, hi); return { stat, value, text: text(value) }; });
      const ak = abil[i % abil.length];
      out['o' + (i + 1)] = {
        name, rank: ranks[i % ranks.length], title: `${tA[i % tA.length]} ${tB[i % tB.length]}`,
        flavor: `${pasts[i % pasts.length]} ${quirks[i % quirks.length]}`,
        passives, ability: { key: ak, ...this.abilities[ak] }, face: this.face(),
      };
    }
    return out;
  },
};
