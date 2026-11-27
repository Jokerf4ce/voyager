// Voyager — research. Research points pile up and flow into the current project each Cycle.

const Research = {
  level(id) { return G.techs[id] || 0; },

  max(id) { return DATA.techs[id].max || DATA.techMax; },
  maxed(id) { return this.level(id) >= this.max(id); },
  // Cost of the next level: cost × growth^(level).
  cost(id) { const t = DATA.techs[id]; return Math.ceil(t.cost * Math.pow(t.growth, this.level(id))); },
  available(id) { return !this.maxed(id); },

  select(id) {
    if (!this.available(id)) return;
    // locked techs can't be picked
    if (G.researching !== id) { G.researching = id; G.researchProgress = 0; }
  },

  // Moves stockpiled research into the project. Returns names of completed techs.
  tick() {
    const done = [];
    let guard = 0;
    while (G.researching && G.res.research > 0 && guard++ < 50) {
      const id = G.researching;
      const need = this.cost(id) - G.researchProgress;
      const put = Math.min(need, G.res.research);
      G.researchProgress += put;
      G.res.research -= put;
      if (G.researchProgress >= this.cost(id) - 1e-9) {
        G.techs[id] = this.level(id) + 1;
        G.researchProgress = 0;
        const t = DATA.techs[id];
        done.push(t.name);
        Log.add(`Research complete: ${t.name} ${G.techs[id]}/${this.max(id)}. ${t.desc} (now ${this.total(id)}).`, 'good');
        if (this.maxed(id)) G.researching = this.nextSuggestion(); // otherwise the next level follows
      }
    }
    return done;
  },

  // The bonus all levels of a tech give together, as text ("+15 % Metals").
  total(id, lvl = this.level(id)) {
    const t = DATA.techs[id], [k, v] = Object.entries(t.mods)[0];
    const pct = Math.round(Math.abs(v) * lvl * 100);
    return t.desc.replace(/\d+ %/, `${pct} %`).replace(/^[+−]/, v < 0 ? '−' : '+').replace(/ from the same inputs$/, '');
  },

  nextSuggestion() {
    const ids = Object.keys(DATA.techs).filter((id) => this.available(id));
    return ids.sort((a, b) => this.cost(a) - this.cost(b))[0] || null;
  },
};
