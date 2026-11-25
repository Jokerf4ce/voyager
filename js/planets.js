// Voyager — planet classification: composition × size × temperature → class, habitability, slots, bonuses.

const Planets = {
  classKey(p) { return p.comp + '_' + p.temp; },
  cls(p) { return DATA.planetClasses[this.classKey(p)]; },

  // e.g. "Large Ocean World", "Hot Gas Giant" (giants don't repeat their size)
  label(p) { return (p.size === 'giant' ? '' : DATA.planetSizes[p.size].name + ' ') + this.cls(p).name; },
  // e.g. "Silicate · Average · Temperate"
  factors(p) { return `${DATA.compositions[p.comp].name} · ${DATA.planetSizes[p.size].name} · ${DATA.temperatures[p.temp].name}`; },

  // Resource multipliers from composition and temperature, combined.
  mult(p) {
    const out = {};
    for (const src of [DATA.compositions[p.comp].mult, DATA.temperatures[p.temp].mult]) {
      for (const k in src) out[k] = Math.round((out[k] || 1) * src[k] * 100) / 100;
    }
    return out;
  },

  slots(size, hab) {
    const base = DATA.planetSizes[size].slots;
    return { surface: hab <= 1 ? 0 : base.surface, orbit: base.orbit };
  },

  // Build a planet from its three factors. hab can be forced (e.g. the capital).
  make(idx, comp, size, temp, hab) {
    const c = DATA.planetClasses[comp + '_' + temp];
    if (hab == null) hab = Math.max(1, U.randInt(c.hab[0], c.hab[1]) + (DATA.planetSizes[size].habMod || 0));
    return { idx, comp, size, temp, hab, colony: null, slots: this.slots(size, hab) };
  },

  random(idx) {
    const keys = Object.keys(DATA.planetClasses).flatMap((k) => Array(DATA.planetClasses[k].weight).fill(k));
    const [comp, temp] = U.pick(keys).split('_');
    const size = U.pick(DATA.compositions[comp].sizes);
    return this.make(idx, comp, size, temp);
  },
};
