// Voyager — research. Research points pile up and flow into the current project each Cycle.

const Research = {
  level(id) { return G.techs[id] || 0; },

  cost(id) {
    const t = DATA.techs[id];
    return Math.ceil(t.repeat ? t.cost * Math.pow(t.growth, this.level(id)) : t.cost);
  },

  available(id) {
    const t = DATA.techs[id];
    return t.repeat || this.level(id) === 0;
  },

  select(id) {
    if (!this.available(id)) return;
    if (G.researching !== id) { G.researching = id; G.researchProgress = 0; }
  },

  // Moves stockpiled research into the project. Returns names of completed techs.
  tick() {
    const done = [];
    let guard = 0;
    while (G.researching && G.res.compute > 0 && guard++ < 50) {
      const id = G.researching;
      const need = this.cost(id) - G.researchProgress;
      const put = Math.min(need, G.res.compute);
      G.researchProgress += put;
      G.res.compute -= put;
      if (G.researchProgress >= this.cost(id) - 1e-9) {
        G.techs[id] = this.level(id) + 1;
        G.researchProgress = 0;
        const t = DATA.techs[id];
        done.push(t.name);
        Log.add(`Research complete: ${t.name}${t.repeat ? ' ' + G.techs[id] : ''}. ${t.desc}.`, 'good');
        if (!t.repeat) G.researching = this.nextSuggestion();
      }
    }
    return done;
  },

  nextSuggestion() {
    const ids = Object.keys(DATA.techs).filter((id) => this.available(id));
    return ids.sort((a, b) => this.cost(a) - this.cost(b))[0] || null;
  },
};
