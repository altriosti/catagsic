// CatASIC website logic.
(() => {
  "use strict";
  const cfg = window.CATASIC_CONFIG;
  const ART = window.CAT_ART;
  const E = window.ethers;
  const $ = (id) => document.getElementById(id);
  const WALL = 8192;

  const NFT_ABI = [
    "function miningState() view returns (bool,uint256,uint256,uint256,uint256,uint256,bytes32,uint256)",
    "function mint(uint256 nonce,uint256 bn) payable returns (uint256)",
    "function totalPaid() view returns (uint256)",
    "function tokensOfOwner(address,uint256,uint256) view returns (uint256[])",
    "function catInfo(uint256[]) view returns (uint256[],uint256[],uint256[],uint256[])",
    "function seedOf(uint256) view returns (bytes32)",
    "function uniqueOf(uint256) view returns (uint8)",
    "function claimRent(uint256[]) returns (uint256)",
    "function burn(uint256)",
    "event Mined(address indexed miner,uint256 indexed tokenId,uint256 price,bytes32 work,uint256 epoch)",
    "error WeakHash()", "error BadBlock()", "error Underpaid()", "error WallReached()", "error NotStarted()", "error NotOwner()",
  ];
  const TOKEN_ABI = ["function totalSupply() view returns (uint256)"];

  const ready = !!(cfg && cfg.nft && E.isAddress(cfg.nft));
  const rp = new E.JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true });
  const nftR = ready ? new E.Contract(cfg.nft, NFT_ABI, rp) : null;
  const tokR = ready && cfg.token && E.isAddress(cfg.token) ? new E.Contract(cfg.token, TOKEN_ABI, rp) : null;

  // ============================================================ helpers
  const fmtEth = (wei, d = 4) => Number(E.formatEther(wei)).toFixed(d);
  function fmtH(n) {
    const u = ["", "K", "M", "G", "T", "P"]; let i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0)) + " " + u[i];
  }
  const expected = (target) => Number((1n << 256n) / (BigInt(target) + 1n));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wide = () => window.innerWidth >= 1100;

  // ============================================================ terminal
  const term = $("term");
  function say(msg, cls) {
    const line = document.createElement("div");
    const t = new Date().toLocaleTimeString([], { hour12: false });
    line.innerHTML = `<span class="d">[${t}]</span> ` + (cls ? `<span class="${cls}">${esc(msg)}</span>` : esc(msg));
    const cur = term.querySelector(".cursor-line");
    term.insertBefore(line, cur);
    while (term.children.length > 200) term.firstChild.remove();
    term.scrollTop = term.scrollHeight;
  }
  term.innerHTML = '<div class="cursor-line">C:\\CATASIC&gt; <span class="cursor"></span></div>';
  let bestLine = null;
  function setBest(text) {
    if (!bestLine) {
      bestLine = document.createElement("div");
      term.insertBefore(bestLine, term.querySelector(".cursor-line"));
    }
    bestLine.innerHTML = `<span class="d">best share</span> <span class="c">${esc(text)}</span>`;
  }

  // ============================================================ windows
  let z = 10;
  const wins = [...document.querySelectorAll(".win")];
  const titles = { wMiner: "Miner.exe", wViewer: "CatViewer 3D", wNet: "Network", wCats: "My Cats", wReadme: "readme.txt" };
  function focusWin(w) {
    wins.forEach((x) => x.classList.remove("active"));
    w.classList.add("active");
    w.style.zIndex = ++z;
    renderTasks();
  }
  function openWin(id) {
    const w = $(id);
    const wasHidden = w.hidden;
    w.hidden = false;
    w.dataset.min = "";
    if (wasHidden && !reduced) { w.classList.remove("opening"); void w.offsetWidth; w.classList.add("opening"); }
    focusWin(w);
    if (!wide() && w.scrollIntoView) w.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    if (id === "wCats") loadMyCats();
  }
  function renderTasks() {
    const box = $("tasks");
    box.innerHTML = "";
    wins.filter((w) => !w.hidden || w.dataset.min === "1").forEach((w) => {
      const b = document.createElement("button");
      b.className = "btn task" + (w.classList.contains("active") && !w.hidden ? " on" : "");
      b.textContent = titles[w.id];
      b.onclick = () => {
        if (w.hidden) { w.hidden = false; w.dataset.min = ""; focusWin(w); }
        else if (w.classList.contains("active") && wide()) { w.hidden = true; w.dataset.min = "1"; renderTasks(); }
        else openWin(w.id);
      };
      box.appendChild(b);
    });
  }
  wins.forEach((w) => {
    w.addEventListener("pointerdown", () => focusWin(w));
    w.querySelector("[data-close]").onclick = (e) => { e.stopPropagation(); w.hidden = true; w.dataset.min = ""; renderTasks(); };
    w.querySelector("[data-min]").onclick = (e) => { e.stopPropagation(); w.hidden = true; w.dataset.min = "1"; renderTasks(); };
    const bar = w.querySelector(".bar");
    let sx, sy, ox, oy, drag = false;
    bar.addEventListener("pointerdown", (e) => {
      if (!wide() || e.target.closest("button")) return;
      drag = true; sx = e.clientX; sy = e.clientY; ox = w.offsetLeft; oy = w.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const maxX = window.innerWidth - 80, maxY = window.innerHeight - 90;
      w.style.left = Math.max(-w.offsetWidth + 80, Math.min(maxX, ox + e.clientX - sx)) + "px";
      w.style.top = Math.max(0, Math.min(maxY, oy + e.clientY - sy)) + "px";
    });
    const end = () => { drag = false; };
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);
  });
  document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => { openWin(b.dataset.open); closeStart(); }));

  function layout() {
    if (!wide()) return;
    const W = window.innerWidth, H = window.innerHeight - 44;
    const vw = Math.min(400, Math.floor(W * 0.3));
    const mw = Math.min(640, W - vw - 150);
    const m = $("wMiner"), v = $("wViewer"), n = $("wNet");
    Object.assign(m.style, { left: "110px", top: "16px", width: mw + "px", height: Math.min(640, H - 32) + "px" });
    Object.assign(v.style, { left: W - vw - 16 + "px", top: "16px", width: vw + "px" });
    const vh = v.offsetHeight || vw + 170;
    const top = 16 + vh + 12;
    Object.assign(n.style, { left: (top + 300 < H ? W - vw - 16 : W - vw - 60) + "px", top: Math.min(top, H - 320) + "px", width: vw + "px" });
    ["wCats", "wReadme"].forEach((id, i) => Object.assign($(id).style, { left: 160 + i * 40 + "px", top: 60 + i * 40 + "px", width: Math.min(640, W - 240) + "px" }));
  }

  // start menu
  const startMenu = $("startMenu");
  function closeStart() { startMenu.hidden = true; $("startBtn").setAttribute("aria-expanded", "false"); }
  $("startBtn").onclick = (e) => {
    e.stopPropagation();
    startMenu.hidden = !startMenu.hidden;
    $("startBtn").setAttribute("aria-expanded", String(!startMenu.hidden));
  };
  document.addEventListener("click", (e) => { if (!startMenu.contains(e.target)) closeStart(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeStart(); });
  if (ready) {
    const links = [
      [`${cfg.explorer}/address/${cfg.nft}`, "🔗 CatASIC contract"],
      cfg.token && [`${cfg.explorer}/token/${cfg.token}`, "🪙 CTASIC token"],
      cfg.buyback && [`${cfg.explorer}/address/${cfg.buyback}`, "🔥 Buyback contract"],
      cfg.token && [`https://app.uniswap.org/swap?chain=base&outputCurrency=${cfg.token}`, "💱 Buy CTASIC on Uniswap"],
      [`https://opensea.io/assets/base/${cfg.nft}/1`, "🖼️ View on OpenSea"],
    ].filter(Boolean);
    links.forEach(([href, label]) => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
      $("startList").appendChild(li);
    });
  }

  // clock
  const tick = () => { $("clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
  tick(); setInterval(tick, 10000);

  // ============================================================ 3D viewer
  let viewer = null;
  try { viewer = new window.CatViewer($("stage3d")); } catch (e) { $("stageTag").textContent = "3D not available on this device"; }
  function showCat(traits, uniqueId, label) {
    if (viewer) viewer.show(window.CatCore.composite(traits, uniqueId));
    $("stageTag").textContent = label;
    const rows = window.CatCore.traitNames(traits, uniqueId).map((a) => `<tr><td>${esc(a.type)}</td><td>${esc(a.value)}</td></tr>`).join("");
    $("traits").innerHTML = `<table>${rows}</table>`;
  }
  showCat(window.CatCore.randomTraits(), 0, "random preview");
  let flicker = null;
  function setFlicker(on) {
    clearInterval(flicker);
    if (on && !reduced) flicker = setInterval(() => showCat(window.CatCore.randomTraits(), 0, "hashing…"), 700);
  }

  // ============================================================ boot
  async function boot() {
    const el = $("boot"), txt = $("bootText");
    const gpuOk = window.CatGpuMiner && window.CatGpuMiner.supported();
    const cores = navigator.hardwareConcurrency || 4;
    const lines = [
      "CatASIC BIOS v1.0  (c) CatASIC Labs",
      "",
      `CPU: ${cores} logical cores detected ........ OK`,
      `GPU: WebGPU ${gpuOk ? "available ................ OK" : "not available .... CPU MODE"}`,
      "Memory test ................................ OK",
      "Loading art: 11 layers, 124 traits, 16 furs .. OK",
      `Network: Base (chain ${cfg.chainId}) .............. ${ready ? "OK" : "NOT CONFIGURED"}`,
      "",
      "Starting CatASIC OS…",
    ];
    let skip = false;
    const finish = () => { el.classList.add("done"); setTimeout(() => el.remove(), 600); };
    el.onclick = () => { skip = true; finish(); };
    if (reduced || sessionStorage.getItem("catasic-booted")) { finish(); return; }
    sessionStorage.setItem("catasic-booted", "1");
    for (const l of lines) {
      if (skip) return;
      const d = document.createElement("div");
      d.textContent = l || "\u00a0";
      txt.appendChild(d);
      await new Promise((r) => setTimeout(r, 170));
    }
    await new Promise((r) => setTimeout(r, 400));
    if (!skip) finish();
  }

  // ============================================================ chain state
  let state = null;
  function epochRows() {
    const cur = state ? Number(state[3]) : 0;
    let h = "";
    for (let e = 0; e < 8; e++) {
      const p0 = 0.0005 * 2 ** e, p1 = p0 * 2 * 1023 / 1024;
      const reward = e <= cur ? 1000 / 2 ** (cur - e) : 1000;
      h += `<tr class="${e === cur ? "now" : ""}"><td>${e}</td><td>${(e * 1024 + 1).toLocaleString()}–${((e + 1) * 1024).toLocaleString()}</td><td>${p0.toFixed(4)} → ${p1.toFixed(4)}</td><td>${reward.toLocaleString()} CTASIC</td></tr>`;
    }
    $("epochRows").innerHTML = h;
  }
  function drawProgress(minted) {
    const box = $("prog");
    const cells = Math.max(10, Math.floor((box.clientWidth - 6) / 12));
    const on = Math.round(cells * minted / WALL);
    if (box.childElementCount !== on) box.innerHTML = "<i></i>".repeat(on);
  }
  async function refresh() {
    if (!ready) return;
    try {
      const [s, paid, queue, supply] = await Promise.all([
        nftR.miningState(), nftR.totalPaid(),
        cfg.buyback && E.isAddress(cfg.buyback) ? rp.getBalance(cfg.buyback) : 0n,
        tokR ? tokR.totalSupply() : 0n,
      ]);
      const changed = !state || state[6] !== s[6] || state[5] !== s[5];
      const newCat = state && s[1] > state[1];
      state = s;
      const minted = Number(s[1]);
      $("nMinted").textContent = minted.toLocaleString() + " / 8,192";
      $("nAlive").textContent = Number(s[2]).toLocaleString();
      $("nPrice").textContent = minted >= WALL ? "wall" : fmtEth(s[4]) + " Ξ";
      $("nWork").textContent = fmtH(expected(s[5])) + "H";
      $("nPaid").textContent = fmtEth(paid, 3) + " Ξ";
      $("nQueue").textContent = fmtEth(queue, 3) + " Ξ";
      $("nSupply").textContent = Math.round(Number(E.formatEther(supply))).toLocaleString();
      const ago = Math.max(0, Math.floor(Date.now() / 1000 - Number(s[7])));
      $("nLast").textContent = minted ? (ago < 90 ? ago + "s ago" : Math.floor(ago / 60) + "m ago") : "none yet";
      $("stPrice").textContent = "Price: " + (minted >= WALL ? "wall reached" : fmtEth(s[4]) + " ETH");
      $("stEpoch").textContent = `Epoch ${Number(s[3])} of 7`;
      drawProgress(minted);
      epochRows();
      if (!s[0]) $("mineBtn").textContent = "Mining opens soon";
      else if (!mining) $("mineBtn").textContent = "▶ Start mining";
      if (newCat && mining && !sending && Number(s[1]) !== ownMint) say(`Cat #${minted} was mined by someone. New round.`, "a");
      if (mining && changed && !sending) startJob();
    } catch (e) { console.warn("refresh", e); }
  }

  // ============================================================ wallet
  let signer = null, account = null, nftW = null;
  async function connect() {
    if (!window.ethereum) { say("No wallet found. Open this site in your wallet's browser, or use Chrome with a wallet extension.", "r"); return false; }
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const hex = "0x" + cfg.chainId.toString(16);
    const cur = await window.ethereum.request({ method: "eth_chainId" });
    if (cur.toLowerCase() !== hex) {
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
      } catch (e) {
        if (e.code !== 4902) throw e;
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [cfg.rpc], blockExplorerUrls: [cfg.explorer] }] });
      }
    }
    signer = await new E.BrowserProvider(window.ethereum).getSigner();
    account = await signer.getAddress();
    nftW = ready ? new E.Contract(cfg.nft, NFT_ABI, signer) : null;
    const short = account.slice(0, 6) + "…" + account.slice(-4);
    $("connectBtn").textContent = short;
    $("stWallet").textContent = "Wallet: " + short;
    $("mineBtn").disabled = !ready;
    say("Wallet connected: " + short, "g");
    if (window.ethereum.on) {
      window.ethereum.on("accountsChanged", () => location.reload());
      window.ethereum.on("chainChanged", () => location.reload());
    }
    if (!$("wCats").hidden) loadMyCats();
    return true;
  }

  // ============================================================ mining
  const cores = navigator.hardwareConcurrency || 4;
  const gpuSupported = !!(window.CatGpuMiner && window.CatGpuMiner.supported());
  const threadsInput = $("cpuThreads");
  threadsInput.max = String(Math.max(1, cores));
  threadsInput.value = String(gpuSupported ? Math.min(2, cores) : Math.max(1, cores - 1));
  $("cpuThreadsVal").textContent = threadsInput.value;
  threadsInput.oninput = () => { $("cpuThreadsVal").textContent = threadsInput.value; if (mining) { rebuildCpu(); if (job) postCpuJob(); } };
  const gpuBox = $("useGpu");
  if (!gpuSupported) { gpuBox.checked = false; gpuBox.disabled = true; $("gpuName").textContent = "(not available in this browser)"; }
  gpuBox.onchange = async () => {
    if (!mining) return;
    if (gpuBox.checked) { await ensureGpu(); if (gpu && job) gpu.start(gpuJob()); } else if (gpu) gpu.stop();
    updateTray();
  };

  let mining = false, sending = false, job = null, jobId = 0, ownMint = -1;
  let workers = [], gpu = null, gpuFailed = false;
  let cpuRates = [], gpuRates = [];

  function rebuildCpu() {
    const n = Number(threadsInput.value);
    while (workers.length > n) workers.pop().terminate();
    while (workers.length < n) {
      const w = new Worker("miner.js");
      w.onmessage = onCpu;
      workers.push(w);
    }
    updateTray();
  }
  async function ensureGpu() {
    if (gpu || gpuFailed || !gpuSupported) return;
    try {
      const g = new window.CatGpuMiner();
      const name = await g.init();
      g.onRate = (h, ms) => gpuRates.push({ t: performance.now(), h, ms });
      g.onFound = (f) => found(f, "GPU");
      gpu = g;
      $("gpuName").textContent = "(" + name + ")";
      say("GPU ready: " + name, "c");
    } catch (e) {
      gpuFailed = true; gpuBox.checked = false;
      say("GPU could not start: " + (e.message || e) + ". Mining with CPU.", "r");
    }
  }
  function updateTray() {
    $("trayGpu").classList.toggle("on", mining && !!gpu && gpuBox.checked);
    $("trayCpu").classList.toggle("on", mining && workers.length > 0);
  }
  const gpuJob = () => ({ id: job.id, miner: account, lastWork: job.lastWork, blockHash: job.blockHash, bn: job.bn, target: job.targetHex });
  function postCpuJob() {
    workers.forEach((w) => w.postMessage({ type: "start", jobId: job.id, miner: account, lastWork: job.lastWork, blockHash: job.blockHash, bn: job.bn, target: job.targetHex }));
  }
  async function startJob() {
    try {
      const s = await nftR.miningState();
      state = s;
      if (!s[0]) { say("Mining has not opened yet.", "r"); stopMining(); return; }
      if (Number(s[1]) >= WALL) { say("The wall is reached. No more cats can be mined.", "r"); stopMining(); return; }
      const latest = await rp.getBlockNumber();
      const bn = latest - 1;
      const blk = await rp.getBlock(bn);
      jobId++;
      job = { id: jobId, miner: account, lastWork: s[6], blockHash: blk.hash, bn, target: BigInt(s[5]),
              targetHex: "0x" + BigInt(s[5]).toString(16).padStart(64, "0"), madeAt: latest, price: s[4] };
      bestLine = null;
      postCpuJob();
      if (gpu && gpuBox.checked) gpu.start(gpuJob());
      say(`Round for cat #${Number(s[1]) + 1}. Target needs ~${fmtH(expected(s[5]))}hashes.`, "d");
    } catch (e) { say("Could not read the chain: " + (e.shortMessage || e.message), "r"); }
  }
  function onCpu(e) {
    const m = e.data;
    if (!job || m.jobId !== job.id) return;
    if (m.type === "rate") {
      cpuRates.push({ t: performance.now(), h: m.hashes });
      if (m.best && (!job.best || BigInt(m.best) < BigInt(job.best))) { job.best = m.best; setBest(m.best.slice(0, 18) + "…"); }
    }
    if (m.type === "found") found(m, "CPU");
  }
  function stopAll() {
    workers.forEach((w) => w.postMessage({ type: "stop" }));
    if (gpu) gpu.stop();
  }
  async function found(f, who) {
    if (sending || !job || f.jobId !== job.id) return;
    sending = true;
    const thisJob = job;
    stopAll();
    say(`${who} found a ticket! Sending it with ${fmtEth(thisJob.price)} ETH…`, "g");
    try {
      const s = await nftR.miningState();
      if (s[6] !== thisJob.lastWork) { say("Someone mined this cat first. Next round.", "a"); return; }
      const value = s[4];
      const est = await nftW.mint.estimateGas(BigInt(f.nonce), f.bn, { value });
      const tx = await nftW.mint(BigInt(f.nonce), f.bn, { value, gasLimit: (est * 13n) / 10n });
      say("Transaction sent: " + tx.hash.slice(0, 18) + "…", "d");
      const rc = await tx.wait();
      const ev = rc.logs.map((l) => { try { return nftW.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "Mined");
      if (ev) {
        const id = ev.args.tokenId;
        ownMint = Number(id);
        say(`You mined CatASIC #${id}!`, "g");
        const [seed, uq] = await Promise.all([nftR.seedOf(id), nftR.uniqueOf(id)]);
        setFlicker(false);
        showCat(window.CatCore.traitsOf(seed), Number(uq), `CatASIC #${id}${Number(uq) ? "  1/1" : ""}`);
        if (viewer) viewer.celebrate();
        openWin("wViewer");
      }
      if (!$("wCats").hidden) loadMyCats();
    } catch (err) {
      const msg = (err && (err.shortMessage || err.reason || err.message)) || "failed";
      say("Mint failed: " + msg, "r");
    } finally {
      sending = false;
      if (mining) {
        setFlicker(true);
        const before = state ? state[6] : null;
        await refresh(); // starts the next round if the chain moved
        if (mining && (!state || state[6] === before)) startJob();
      }
    }
  }
  async function startMining() {
    if (!account && !(await connect())) return;
    if (!ready) return;
    mining = true;
    $("mineBtn").disabled = true; $("stopBtn").disabled = false;
    $("mineBtn").textContent = "Mining…";
    if (gpuBox.checked) await ensureGpu();
    rebuildCpu();
    if (!workers.length && !(gpu && gpuBox.checked)) { say("Turn on the GPU or add at least one CPU thread.", "r"); stopMining(); return; }
    setFlicker(true);
    say(`Mining with ${gpu && gpuBox.checked ? "GPU + " : ""}${workers.length} CPU thread${workers.length === 1 ? "" : "s"}.`, "a");
    updateTray();
    await startJob();
  }
  function stopMining() {
    mining = false;
    workers.forEach((w) => w.terminate()); workers = [];
    if (gpu) gpu.stop();
    job = null; cpuRates = []; gpuRates = [];
    $("mineBtn").disabled = !account || !ready; $("stopBtn").disabled = true;
    $("mineBtn").textContent = "▶ Start mining";
    setFlicker(false); updateTray();
    say("Stopped.");
  }
  // keep the referenced block fresh (contract accepts blocks up to 128 old; Base makes one every 2s)
  setInterval(async () => {
    if (!mining || sending || !job) return;
    const latest = await rp.getBlockNumber().catch(() => 0);
    if (latest && latest - job.madeAt > 60) startJob();
  }, 10000);

  function rate(list) {
    const now = performance.now();
    const keep = list.filter((r) => now - r.t < 4000);
    list.length = 0; list.push(...keep);
    return keep.reduce((a, r) => a + r.h, 0) / 4;
  }
  setInterval(() => {
    const c = mining ? rate(cpuRates) : 0, g = mining ? rate(gpuRates) : 0, all = c + g;
    $("cpuRate").textContent = mining && workers.length ? fmtH(c) + "H/s" : "off";
    $("gpuRate").textContent = mining && gpu && gpuBox.checked ? fmtH(g) + "H/s" : "off";
    $("allRate").textContent = fmtH(all) + "H/s";
    const max = Math.max(all, 1);
    $("cpuMeter").style.width = (c / max * 100).toFixed(1) + "%";
    $("gpuMeter").style.width = (g / max * 100).toFixed(1) + "%";
    if (state && all > 0) {
      const p = 1 - Math.exp(-all * 60 / expected(state[5]));
      $("odds").textContent = `chance of a cat in the next minute: ${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
    } else $("odds").textContent = "chance of a cat in the next minute: —";
  }, 1000);

  // ============================================================ my cats
  let myCats = [], selected = null;
  function drawThumb(canvas, traits, uq) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    window.CatCore.composite(traits, uq).forEach((c, i) => { if (c) { ctx.fillStyle = c.color; ctx.fillRect(i % 24, Math.floor(i / 24), 1, 1); } });
  }
  async function loadMyCats() {
    const grid = $("catGrid");
    if (!ready) { grid.innerHTML = '<div class="empty">Contracts are not set yet.</div>'; return; }
    if (!account) { grid.innerHTML = '<div class="empty">Connect your wallet to see your cats.</div>'; return; }
    grid.innerHTML = '<div class="empty">Loading…</div>';
    try {
      const minted = Number((await nftR.miningState())[1]);
      let ids = [];
      for (let from = 1; from <= minted; from += 2048) {
        const part = await nftR.tokensOfOwner(account, from, Math.min(minted, from + 2047));
        ids = ids.concat(part.map(Number));
      }
      if (!ids.length) {
        grid.innerHTML = '<div class="empty">No cats yet. Open Miner.exe and start mining.</div>';
        myCats = []; selected = null; updateCatButtons(); return;
      }
      const [rent, reward, epochs, uniques] = await nftR.catInfo(ids);
      const seeds = await Promise.all(ids.map((id) => nftR.seedOf(id)));
      myCats = ids.map((id, i) => ({ id, rent: rent[i], reward: reward[i], epoch: Number(epochs[i]), unique: Number(uniques[i]), traits: window.CatCore.traitsOf(seeds[i]) }));
      grid.innerHTML = "";
      myCats.forEach((c) => {
        const b = document.createElement("button");
        b.className = "cat" + (c.unique ? " one" : "");
        b.innerHTML = `<canvas width="24" height="24"></canvas>#${c.id}`;
        drawThumb(b.querySelector("canvas"), c.traits, c.unique);
        b.onclick = () => {
          grid.querySelectorAll(".cat").forEach((x) => x.classList.remove("sel"));
          b.classList.add("sel"); selected = c; updateCatButtons();
          showCat(c.traits, c.unique, `CatASIC #${c.id}${c.unique ? "  1/1" : ""}`);
        };
        grid.appendChild(b);
      });
      selected = null; updateCatButtons();
    } catch (e) {
      console.warn(e);
      grid.innerHTML = '<div class="empty">Could not load your cats. Press Refresh to try again.</div>';
    }
  }
  function updateCatButtons() {
    const total = myCats.reduce((a, c) => a + c.rent, 0n);
    $("catsTotal").textContent = `${myCats.length} cat${myCats.length === 1 ? "" : "s"}`;
    $("catsRent").textContent = `Rent: ${fmtEth(total, 6)} ETH`;
    $("claimAllBtn").disabled = total === 0n;
    $("claimOneBtn").disabled = !selected || selected.rent === 0n;
    $("burnBtn").disabled = !selected;
    $("catsSel").textContent = selected
      ? `#${selected.id}: epoch ${selected.epoch}, rent ${fmtEth(selected.rent, 6)} ETH, burn = ${Number(E.formatEther(selected.reward)).toLocaleString()} CTASIC`
      : "Nothing selected";
  }
  async function claim(ids) {
    try {
      const tx = await nftW.claimRent(ids);
      say("Claiming rent…", "d"); await tx.wait(); say("Rent claimed.", "g"); loadMyCats();
    } catch (e) { say("Claim failed: " + (e.shortMessage || e.message), "r"); }
  }
  $("claimAllBtn").onclick = () => claim(myCats.filter((c) => c.rent > 0n).map((c) => c.id));
  $("claimOneBtn").onclick = () => selected && claim([selected.id]);
  $("burnBtn").onclick = async () => {
    if (!selected) return;
    const c = selected;
    const ok = confirm(`Burn CatASIC #${c.id}?\n\nYou get ${Number(E.formatEther(c.reward)).toLocaleString()} CTASIC and ${E.formatEther(c.rent)} ETH rent.\nThe cat is gone forever.`);
    if (!ok) return;
    try {
      const tx = await nftW.burn(c.id);
      say(`Burning #${c.id}…`, "d"); await tx.wait(); say(`Burned #${c.id}.`, "g"); loadMyCats(); refresh();
    } catch (e) { say("Burn failed: " + (e.shortMessage || e.message), "r"); }
  };
  $("reloadCats").onclick = loadMyCats;

  // ============================================================ start
  $("connectBtn").onclick = () => connect().catch((e) => say(e.shortMessage || e.message, "r"));
  $("mineBtn").onclick = () => startMining().catch((e) => say(e.shortMessage || e.message, "r"));
  $("stopBtn").onclick = stopMining;

  layout();
  window.addEventListener("resize", () => { layout(); if (state) drawProgress(Number(state[1])); });
  focusWin($("wMiner"));
  epochRows();
  boot();
  say("CatASIC miner ready.", "a");
  say(gpuSupported ? "WebGPU found. GPU and CPU mining available." : "WebGPU not found in this browser. CPU mining only.", gpuSupported ? "c" : "a");
  if (ready) { refresh(); setInterval(refresh, 5000); }
  else say("Contracts are not set yet. Add addresses in config.js.", "r");
})();
