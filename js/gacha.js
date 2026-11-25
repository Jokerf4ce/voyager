// Voyager — Void Signals: the gacha. Pull with Void Shards earned in play. No real money, ever.

const Gacha = {
  item(id) { return DATA.gachaPool.find((x) => x.id === id); },

  rollRarity(forceAtLeastRare) {
    if (G.pity + 1 >= DATA.pity.mythic) return 'mythic';
    const r = Math.random();
    if (r < DATA.rarities.mythic.rate) return 'mythic';
    if (r < DATA.rarities.mythic.rate + DATA.rarities.rare.rate || forceAtLeastRare) return 'rare';
    return 'common';
  },

  pullOne(forceRare) {
    const rarity = this.rollRarity(forceRare);
    G.pity = rarity === 'mythic' ? 0 : G.pity + 1;
    G.pulls++;
    const item = U.pick(DATA.gachaPool.filter((x) => x.rarity === rarity));
    let result = 'new';
    if (item.kind === 'cache') {
      for (const k in item.gives) G.res[k] += item.gives[k];
      result = 'cache';
    } else if (G.collection[item.id]) {
      G.collection[item.id].rank++;
      result = item.kind === 'blueprint' ? 'dupe' : 'rankup';
      if (item.kind === 'blueprint') G.res.shards += 5; // duplicate blueprints are refunded
    } else {
      G.collection[item.id] = { rank: 1, got: G.cycle };
    }
    return { item, result, rank: G.collection[item.id] ? G.collection[item.id].rank : 0 };
  },

  pull(count) {
    const cost = count === 10 ? DATA.pullCost * 9 : DATA.pullCost * count;
    if (G.res.shards < cost) return null;
    G.res.shards -= cost;
    const out = [];
    for (let i = 0; i < count; i++) out.push(this.pullOne(count === 10 && i === 9 && !out.some((r) => r.item.rarity !== 'common')));
    for (const r of out) {
      if (r.item.rarity === 'mythic') Log.add(`◆ A MYTHIC signal answers from the deep: ${r.item.name}.`, 'mythic');
      if (r.item.kind === 'blueprint' && r.result === 'new') Log.add(`${r.item.name} decoded. New hulls can be laid down at your shipyards.`, 'good');
    }
    return out;
  },
};
