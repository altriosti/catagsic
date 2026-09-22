// CatASIC shared helpers: exact JS copy of the on-chain trait picking and layer compositing.
(function () {
  "use strict";
  const ART = window.CAT_ART;
  const LAYERS = ART.layers.length; // 11
  const totals = ART.layers.map((L) => L.traits.reduce((a, t) => a + t.weight, 0));

  function pickIndex(l, rnd) {
    const r = rnd % BigInt(totals[l]);
    let acc = 0n;
    const T = ART.layers[l].traits;
    for (let i = 0; i < T.length; i++) {
      acc += BigInt(T[i].weight);
      if (r < acc) return i;
    }
    return 0;
  }

  // same as CatRenderer.traitsOf(seed): 11 layer picks + fur index
  function traitsOf(seed) {
    const E = window.ethers;
    const t = [];
    for (let l = 0; l < LAYERS; l++) {
      t.push(pickIndex(l, BigInt(E.solidityPackedKeccak256(["bytes32", "uint256"], [seed, l]))));
    }
    t.push(Number(BigInt(E.solidityPackedKeccak256(["bytes32", "string"], [seed, "fur"])) % BigInt(ART.fur.length)));
    return t;
  }

  function randomTraits() {
    const t = ART.layers.map((L, l) => {
      let r = Math.random() * totals[l];
      for (let i = 0; i < L.traits.length; i++) { r -= L.traits[i].weight; if (r < 0) return i; }
      return 0;
    });
    t.push(Math.floor(Math.random() * ART.fur.length));
    return t;
  }

  // returns per-cell {color, layer} for a 24x24 grid, top-most layer wins
  function composite(t, uniqueId) {
    const fur = uniqueId > 0 ? ART.uniques[uniqueId - 1] : ART.fur[t[LAYERS]];
    const fm = { 250: fur[1], 251: fur[2], 252: fur[3], 253: fur[4] };
    const cells = new Array(576).fill(null);
    for (let l = 0; l < LAYERS; l++) {
      const d = ART.layers[l].traits[t[l]].data;
      for (let i = 0; i < d.length; i += 8) {
        const x = parseInt(d.substr(i, 2), 16), y = parseInt(d.substr(i + 2, 2), 16),
              n = parseInt(d.substr(i + 4, 2), 16), c = parseInt(d.substr(i + 6, 2), 16);
        const color = "#" + (c >= 250 ? fm[c] : ART.palette[c]);
        for (let k = 0; k < n && x + k < 24; k++) cells[y * 24 + x + k] = { color, layer: l };
      }
    }
    return cells;
  }

  function traitNames(t, uniqueId) {
    const out = ART.layers.map((L, l) => ({ type: L.name, value: L.traits[t[l]].name })).filter((a) => a.type !== "Body");
    out.unshift({ type: "Fur Color", value: uniqueId > 0 ? ART.uniques[uniqueId - 1][0] : ART.fur[t[LAYERS]][0] });
    return out;
  }

  window.CatCore = { traitsOf, randomTraits, composite, traitNames, LAYERS };
})();
