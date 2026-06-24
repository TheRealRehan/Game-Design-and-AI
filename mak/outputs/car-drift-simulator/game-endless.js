const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const panel = document.querySelector(".panel");

const ui = {
  screen: document.getElementById("screen"),
  levelText: document.getElementById("levelText"),
  speedText: document.getElementById("speedText"),
  cashText: document.getElementById("cashText"),
  progressText: document.getElementById("progressText"),
};

const modes = {
  easy: { label: "Easy", lives: 5, heatRate: 1050, spawnOffset: 0.12, pickupDelay: -0.25, abilityBias: 1 },
  medium: { label: "Medium", lives: 3, heatRate: 850, spawnOffset: 0, pickupDelay: 0.55, abilityBias: 0.58 },
  hard: { label: "Hard", lives: 1, heatRate: 650, spawnOffset: -0.12, pickupDelay: 1.25, abilityBias: 0.28 },
};

const lanes = [-210, 0, 210];
const obstacleTypes = [
  { id: "cone", label: "Traffic Cone", color: "#ff8a34", width: 46, height: 54, penalty: 13 },
  { id: "barrier", label: "Barrier", color: "#f24f5f", width: 116, height: 46, penalty: 20 },
  { id: "parked", label: "Parked Car", color: "#6cd0ff", width: 112, height: 150, penalty: 26 },
  { id: "oil", label: "Oil Spill", color: "#0d0e12", width: 126, height: 68, penalty: 17 },
  { id: "roadblock", label: "Roadblock", color: "#f7f7f2", width: 150, height: 54, penalty: 30 },
];

const pickupTypes = [
  { id: "life", label: "Extra Life", color: "#ff4f64", width: 56, height: 56 },
  { id: "autopilot", label: "Autopilot", color: "#37d5ff", width: 60, height: 60 },
  { id: "immortal", label: "Immortality", color: "#ffd447", width: 60, height: 60 },
  { id: "cash", label: "Cash", color: "#f7f7f2", width: 54, height: 54 },
];

try {
  const wipeVersion = "2026-06-22-leaderboard-wipe-2";
  if (localStorage.getItem("boltHeistLeaderboardWipeVersion") !== wipeVersion) {
    localStorage.removeItem("boltHeistLeaderboards");
    localStorage.setItem("boltHeistLeaderboardWipeVersion", wipeVersion);
  }
} catch {
  // Local storage can be unavailable in some embedded previews.
}

const cosmetics = [
  { id: "lime", type: "color", name: "Street Lime Paint", cost: 100, color: "#54e08b", note: "Original getaway green." },
  { id: "midnight", type: "color", name: "Midnight Paint", cost: 180, color: "#222733", note: "Quiet, clean, hard to spot." },
  { id: "bolt-blue", type: "color", name: "Electric Blue Paint", cost: 260, color: "#37d5ff", note: "Bright arcade blue shine." },
  { id: "hot-rod", type: "color", name: "Hot Rod Red", cost: 360, color: "#ff4f64", note: "Looks fast standing still." },
  { id: "royal-gold", type: "color", name: "Royal Gold Paint", cost: 520, color: "#ffd447", note: "Flashy victory color." },
  { id: "party", type: "color", name: "Party Prism Paint", cost: 850, color: "rainbow", note: "A permanent rainbow body." },
  { id: "cap", type: "hat", name: "Tiny Driver Cap", cost: 150, hat: "cap", note: "A little classic." },
  { id: "crown", type: "hat", name: "Gold Crown", cost: 420, hat: "crown", note: "For leaderboard royalty." },
  { id: "spoiler", type: "hat", name: "Neon Roof Spoiler", cost: 650, hat: "spoiler", note: "Arcade glow on top." },
  { id: "halo", type: "hat", name: "Chrome Halo", cost: 900, hat: "halo", note: "The fanciest roof flex." },
];

const shopUpgrades = [
  { id: "launch-tune", name: "Launch Tune", cost: 160, note: "Start each run at a higher speed." },
  { id: "turbo-tune", name: "Turbo Tune", cost: 240, note: "Raises top speed a little." },
  { id: "street-grip", name: "Street Grip", cost: 260, note: "Improves lane switching." },
  { id: "cash-magnet", name: "Cash Magnet", cost: 300, note: "Cash pickups pay more." },
  { id: "reinforced-frame", name: "Reinforced Frame", cost: 380, note: "Start with one extra life." },
  { id: "impact-dampers", name: "Impact Dampers", cost: 460, note: "Crashes slow the car down less." },
  { id: "pickup-radar", name: "Pickup Radar", cost: 540, note: "Road pickups appear more often." },
  { id: "bolt-jammer", name: "Heat Shield", cost: 700, note: "Heat rises slower during each run." },
  { id: "auto-chip", name: "Auto Chip", cost: 850, note: "Autopilot lasts longer." },
  { id: "last-stand", name: "Last Stand", cost: 1100, note: "Once per run, survive a fatal crash with one life." },
];

const state = {
  mode: "menu",
  selectedMode: "medium",
  username: "",
  profile: null,
  heat: 1,
  cash: 0,
  cashBanked: false,
  score: 0,
  lastStandUsed: false,
  player: {
    lane: 1,
    x: 0,
    y: 500,
    targetX: 0,
    speed: 88,
    invulnerable: 0,
    immortal: 0,
    autopilot: 0,
  },
  lives: 3,
  maxLives: 3,
  roadOffset: 0,
  runDistance: 0,
  entities: [],
  spawnTimer: 0,
  pickupTimer: 2.4,
  crashHeat: 0,
  lastTime: 0,
  message: "",
  messageTimer: 0,
};

function getLeaderboards() {
  try {
    return JSON.parse(localStorage.getItem("boltHeistLeaderboards")) || {};
  } catch {
    return {};
  }
}

function saveLeaderboards(boards) {
  localStorage.setItem("boltHeistLeaderboards", JSON.stringify(boards));
}

function profileKey(name) {
  return (name || "Driver").trim().toLowerCase() || "driver";
}

function cleanName(name) {
  return (name || "Driver").trim().replace(/[^a-z0-9 _-]/gi, "").slice(0, 16) || "Driver";
}

function getProfiles() {
  try {
    return JSON.parse(localStorage.getItem("boltHeistProfiles")) || {};
  } catch {
    return {};
  }
}

function saveProfiles(profiles) {
  localStorage.setItem("boltHeistProfiles", JSON.stringify(profiles));
}

function defaultProfile(name) {
  return {
    name,
    wallet: 0,
    ownedCosmetics: ["lime"],
    ownedUpgrades: [],
    equippedColor: "lime",
    equippedHat: "none",
  };
}

function getProfile(name) {
  const clean = cleanName(name);
  const profiles = getProfiles();
  const key = profileKey(clean);
  if (!profiles[key]) profiles[key] = defaultProfile(clean);
  profiles[key].name = clean;
  profiles[key].ownedCosmetics ||= ["lime"];
  profiles[key].ownedUpgrades ||= [];
  profiles[key].equippedColor ||= "lime";
  profiles[key].equippedHat ||= "none";
  profiles[key].wallet ||= 0;
  saveProfiles(profiles);
  return profiles[key];
}

function saveProfile(profile) {
  const profiles = getProfiles();
  profiles[profileKey(profile.name)] = profile;
  saveProfiles(profiles);
  state.profile = profile;
}

function syncProfileFromInput() {
  const nameInput = document.getElementById("driverName");
  if (nameInput) state.username = cleanName(nameInput.value);
  else state.username = cleanName(state.username);
  state.profile = getProfile(state.username);
  return state.profile;
}

function ownsUpgrade(id) {
  return !!state.profile?.ownedUpgrades?.includes(id);
}

function bankRunCash() {
  if (state.cashBanked || !state.cash) return;
  const profile = getProfile(state.username);
  profile.wallet += state.cash;
  saveProfile(profile);
  state.cashBanked = true;
}

function topScore(mode) {
  const boards = getLeaderboards();
  return Math.max(0, ...(boards[mode] || []).map((entry) => entry.score));
}

function recordScore() {
  bankRunCash();
  const boards = getLeaderboards();
  const mode = state.selectedMode;
  const name = state.username || "Driver";
  const list = boards[mode] || [];
  const existing = list.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  if (existing) existing.score = Math.max(existing.score, Math.round(state.score));
  else list.push({ name, score: Math.round(state.score) });
  boards[mode] = list.sort((a, b) => b.score - a.score).slice(0, 6);
  saveLeaderboards(boards);
}

function difficulty() {
  const mode = modes[state.selectedMode] || modes.medium;
  const heat = state.heat;
  const turbo = ownsUpgrade("turbo-tune") ? 9 : 0;
  const grip = ownsUpgrade("street-grip") ? 1.8 : 0;
  const radar = ownsUpgrade("pickup-radar") ? -0.45 : 0;
  return {
    topSpeed: 116 + turbo,
    accel: 18,
    handling: 8.9 + grip,
    spawnEvery: Math.max(0.32, 0.96 + mode.spawnOffset - heat * 0.055),
    pickupEvery: Math.max(1.75, 3.8 + mode.pickupDelay + radar - heat * 0.05),
    obstacleSpeed: 385 + heat * 27,
  };
}

function menuHtml() {
  const profile = getProfile(state.username || "Driver");
  const boards = getLeaderboards();
  const boardHtml = ["easy", "medium", "hard"].map((mode) => {
    const rows = (boards[mode] || []).length
      ? boards[mode].map((entry, index) => `<li><span>${index + 1}. ${entry.name}</span><strong>${entry.score} m</strong></li>`).join("")
      : "<li><span>No runs yet</span><strong>--</strong></li>";
    return `<section class="leaderboard"><h3>${modes[mode].label}</h3><ol>${rows}</ol></section>`;
  }).join("");

  return `
    <p class="eyebrow">Endless arcade driving</p>
    <h1>Bolt Heist</h1>
    <p class="subtitle">You stole a high-speed getaway car. Pick a difficulty, enter a driver name, and survive traffic for as long as you can.</p>
    <label class="name-field">
      <span>Driver name</span>
      <input id="driverName" maxlength="16" placeholder="Your name" value="${state.username}">
    </label>
    <p class="wallet-line">Wallet for ${profile.name}: <strong>$${profile.wallet}</strong></p>
    <div class="mode-grid">
      <button data-start="easy" type="button">Easy <small>5 lives</small></button>
      <button data-start="medium" type="button">Medium <small>3 lives</small></button>
      <button data-start="hard" type="button">Hard <small>1 life</small></button>
    </div>
    <div class="menu-actions">
      <button data-view="shop" type="button">Shop</button>
      <button data-view="info" type="button">Information</button>
    </div>
    <h2>Leaderboards</h2>
    <div class="leaderboards">${boardHtml}</div>
  `;
}

function cosmeticPreview(item) {
  if (item.type === "color") {
    const style = item.color === "rainbow"
      ? "background: linear-gradient(90deg, #ff4f64, #ffd447, #54e08b, #37d5ff, #b97cff)"
      : `background: ${item.color}`;
    return `<div class="shop-preview car-preview" style="${style}">Car</div>`;
  }
  return `<div class="shop-preview hat-preview ${item.hat}">${item.name.split(" ")[0]}</div>`;
}

function shopHtml() {
  const profile = getProfile(state.username || "Driver");
  const cosmeticCards = cosmetics.map((item) => {
    const owned = profile.ownedCosmetics.includes(item.id);
    const equipped = item.type === "color" ? profile.equippedColor === item.id : profile.equippedHat === item.id;
    const action = owned
      ? `<button data-equip-cosmetic="${item.id}" type="button" ${equipped ? "disabled" : ""}>${equipped ? "Equipped" : "Equip"}</button>`
      : `<button data-buy-cosmetic="${item.id}" type="button" ${profile.wallet < item.cost ? "disabled" : ""}>Buy $${item.cost}</button>`;
    return `
      <article class="shop-card">
        ${cosmeticPreview(item)}
        <strong>${item.name}</strong>
        <span>${item.note}</span>
        ${action}
      </article>
    `;
  }).join("");

  const upgradeCards = shopUpgrades.map((item) => {
    const owned = profile.ownedUpgrades.includes(item.id);
    return `
      <article class="shop-card">
        <div class="shop-preview upgrade-preview">${item.name.slice(0, 2).toUpperCase()}</div>
        <strong>${item.name}</strong>
        <span>${item.note}</span>
        <button data-buy-upgrade="${item.id}" type="button" ${owned || profile.wallet < item.cost ? "disabled" : ""}>${owned ? "Owned" : `Buy $${item.cost}`}</button>
      </article>
    `;
  }).join("");

  return `
    <p class="eyebrow">Driver shop</p>
    <h1>Shop</h1>
    <p class="wallet-line">Shopping as ${profile.name}: <strong>$${profile.wallet}</strong></p>
    <h2>Cosmetics</h2>
    <div class="shop-grid">${cosmeticCards}</div>
    <h2>Permanent Upgrades</h2>
    <div class="shop-grid">${upgradeCards}</div>
    <div class="actions"><button data-view="menu" type="button">Back to Menu</button></div>
  `;
}

function infoHtml() {
  return `
    <p class="eyebrow">About the game</p>
    <h1>Information</h1>
    <p>Switch lanes to avoid hazards. Grab upgrades only when the lane is worth the risk.</p>
    <h2>Obstacles to avoid</h2>
    <div class="visual-grid avoid-grid">
      <article><div class="sample cone-sample"></div><strong>Traffic Cone</strong><span>Small hazard. Costs one life.</span></article>
      <article><div class="sample barrier-sample"></div><strong>Barrier</strong><span>Wide blocker. Switch lanes early.</span></article>
      <article><div class="sample parked-sample"></div><strong>Parked Car</strong><span>Tall hazard. Stays dangerous longer.</span></article>
      <article><div class="sample oil-sample"></div><strong>Oil Spill</strong><span>Dark slick. Costs one life and slows you.</span></article>
      <article><div class="sample roadblock-sample"></div><strong>Roadblock</strong><span>Large blocker. Find the open lane.</span></article>
    </div>
    <h2>Road upgrades</h2>
    <div class="visual-grid upgrade-grid">
      <article><div class="sample pickup-sample life-sample">+</div><strong>Extra Life</strong><span>Adds one life and raises your life capacity. Car stays green.</span><div class="car-chip green-car">Car</div></article>
      <article><div class="sample pickup-sample auto-sample">A</div><strong>Autopilot</strong><span>Steers away from danger for 5 seconds.</span><div class="car-chip blue-car">Car turns blue</div></article>
      <article><div class="sample pickup-sample immortal-sample">I</div><strong>Immortality</strong><span>Hit obstacles safely for 5 seconds.</span><div class="car-chip rainbow-car">Car turns rainbow</div></article>
      <article><div class="sample pickup-sample cash-sample">$</div><strong>Cash</strong><span>Adds cash to your run score.</span><div class="car-chip green-car">Car stays green</div></article>
    </div>
    <div class="actions"><button data-view="menu" type="button">Back to Menu</button></div>
  `;
}

function showMenu() {
  state.mode = "menu";
  ui.screen.classList.remove("hidden");
  panel.innerHTML = menuHtml();
}

function showInfo() {
  state.mode = "info";
  ui.screen.classList.remove("hidden");
  panel.innerHTML = infoHtml();
}

function showShop() {
  syncProfileFromInput();
  state.mode = "shop";
  ui.screen.classList.remove("hidden");
  panel.innerHTML = shopHtml();
}

function buyCosmetic(id) {
  const profile = syncProfileFromInput();
  const item = cosmetics.find((cosmetic) => cosmetic.id === id);
  if (!item || profile.ownedCosmetics.includes(id) || profile.wallet < item.cost) return;
  profile.wallet -= item.cost;
  profile.ownedCosmetics.push(id);
  if (item.type === "color") profile.equippedColor = id;
  else profile.equippedHat = id;
  saveProfile(profile);
  showShop();
}

function equipCosmetic(id) {
  const profile = syncProfileFromInput();
  const item = cosmetics.find((cosmetic) => cosmetic.id === id);
  if (!item || !profile.ownedCosmetics.includes(id)) return;
  if (item.type === "color") profile.equippedColor = id;
  else profile.equippedHat = id;
  saveProfile(profile);
  showShop();
}

function buyUpgrade(id) {
  const profile = syncProfileFromInput();
  const item = shopUpgrades.find((upgrade) => upgrade.id === id);
  if (!item || profile.ownedUpgrades.includes(id) || profile.wallet < item.cost) return;
  profile.wallet -= item.cost;
  profile.ownedUpgrades.push(id);
  saveProfile(profile);
  showShop();
}

function showGameOver(reason) {
  state.mode = "gameover";
  recordScore();
  const modeLabel = modes[state.selectedMode].label;
  ui.screen.classList.remove("hidden");
  panel.innerHTML = `
    <p class="eyebrow">${modeLabel} run complete</p>
    <h1>${reason}</h1>
    <p>You escaped ${Math.round(state.score)} m as ${state.username || "Driver"} and grabbed $${state.cash}. ${modeLabel} best: ${topScore(state.selectedMode)} m.</p>
    <div class="actions">
      <button data-retry type="button">Retry ${modeLabel}</button>
      <button data-view="menu" type="button">Menu</button>
    </div>
  `;
}

function showPause() {
  if (state.mode !== "playing") return;
  state.mode = "paused";
  ui.screen.classList.remove("hidden");
  panel.innerHTML = `
    <p class="eyebrow">Run paused</p>
    <h1>Paused</h1>
    <p>You escaped ${Math.round(state.score)} m and collected $${state.cash} so far.</p>
    <div class="actions">
      <button data-resume type="button">Resume</button>
      <button data-exit-menu type="button">Exit to Menu</button>
    </div>
  `;
}

function resumeRun() {
  if (state.mode !== "paused") return;
  state.mode = "playing";
  ui.screen.classList.add("hidden");
}

function exitToMenuFromPause() {
  bankRunCash();
  showMenu();
}

function setMessage(message) {
  state.message = message;
  state.messageTimer = message ? 1.25 : 0;
}

function resetRun(mode) {
  syncProfileFromInput();
  const config = modes[mode] || modes.medium;
  const bonusLife = ownsUpgrade("reinforced-frame") ? 1 : 0;
  const launchBonus = ownsUpgrade("launch-tune") ? 18 : 0;
  state.mode = "playing";
  state.selectedMode = mode;
  state.maxLives = config.lives + bonusLife;
  state.lives = config.lives + bonusLife;
  state.heat = 1;
  state.cash = 0;
  state.cashBanked = false;
  state.score = 0;
  state.lastStandUsed = false;
  state.player.lane = 1;
  state.player.x = 0;
  state.player.targetX = 0;
  state.player.speed = 90 + launchBonus;
  state.player.invulnerable = 0;
  state.player.immortal = 0;
  state.player.autopilot = 0;
  state.runDistance = 0;
  state.entities = [];
  state.spawnTimer = 0.45;
  state.pickupTimer = 1.8;
  state.crashHeat = 0;
  setMessage("");
  ui.screen.classList.add("hidden");
}

function switchLane(dir) {
  if (state.mode !== "playing" || state.player.autopilot > 0) return;
  state.player.lane = Math.max(0, Math.min(2, state.player.lane + dir));
  state.player.targetX = lanes[state.player.lane];
}

function pickClearLane(blocked) {
  const available = [0, 1, 2].filter((lane) => !blocked.includes(lane));
  return available[Math.floor(Math.random() * available.length)] ?? 1;
}

function spawnObstacleWave() {
  const d = difficulty();
  const laneCount = state.heat >= 3 && Math.random() < 0.45 ? 2 : 1;
  const blocked = [];
  while (blocked.length < laneCount) {
    const lane = Math.floor(Math.random() * 3);
    if (!blocked.includes(lane)) blocked.push(lane);
  }
  blocked.forEach((lane, index) => {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    state.entities.push({ ...type, kind: "obstacle", lane, x: lanes[lane], y: -130 - index * 46, speed: d.obstacleSpeed + Math.random() * 95, hit: false });
  });
}

function weightedPickupType() {
  const mode = modes[state.selectedMode] || modes.medium;
  const heatPressure = Math.max(0.2, 1 - (state.heat - 1) * 0.06);
  const abilityWeight = mode.abilityBias * heatPressure;
  const weights = [
    ["life", 1.05 * abilityWeight],
    ["autopilot", 0.82 * abilityWeight],
    ["immortal", 0.62 * abilityWeight],
    ["cash", 1.1 + state.heat * 0.16 + (1 - mode.abilityBias) * 2.4],
  ];
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [id, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return pickupTypes.find((pickup) => pickup.id === id);
  }
  return pickupTypes.find((pickup) => pickup.id === "cash");
}

function spawnPickup() {
  const d = difficulty();
  const blocked = state.entities.filter((entity) => entity.kind === "obstacle" && entity.y < 150).map((entity) => entity.lane);
  const type = weightedPickupType();
  const lane = pickClearLane(blocked.length >= 3 ? [] : blocked);
  state.entities.push({ ...type, kind: "pickup", lane, x: lanes[lane], y: -110, speed: d.obstacleSpeed * 0.94, hit: false });
}

function collide(a, b) {
  return Math.abs(a.x - b.x) < (a.width + b.width) * 0.5 &&
    Math.abs(a.y - b.y) < (a.height + b.height) * 0.5;
}

function findSafeLane() {
  const danger = state.entities
    .filter((entity) => entity.kind === "obstacle" && entity.y > 120 && entity.y < state.player.y + 30)
    .map((entity) => entity.lane);
  if (!danger.includes(state.player.lane)) return state.player.lane;
  return pickClearLane(danger);
}

function hitObstacle(entity) {
  const p = state.player;
  entity.hit = true;
  if (p.immortal > 0) {
    p.speed = Math.max(70, p.speed - 4);
    setMessage("Immortal hit. No life lost.");
    return;
  }
  state.lives -= 1;
  p.invulnerable = 0.85;
  const penalty = entity.penalty * (ownsUpgrade("impact-dampers") ? 0.55 : 1);
  p.speed = Math.max(46, p.speed - penalty);
  state.crashHeat += 1.7;
  if (state.lives <= 0 && ownsUpgrade("last-stand") && !state.lastStandUsed) {
    state.lastStandUsed = true;
    state.lives = 1;
    p.invulnerable = 1.4;
    setMessage("Last Stand saved you. One life left.");
    return;
  }
  setMessage(`Hit ${entity.label}. ${state.lives}/${state.maxLives} lives left.`);
  if (state.lives <= 0) showGameOver("Totaled");
}

function collectPickup(entity) {
  const p = state.player;
  entity.hit = true;
  if (entity.id === "life") {
    state.maxLives += 1;
    state.lives += 1;
    setMessage(`Extra life collected. ${state.lives}/${state.maxLives} lives.`);
  } else if (entity.id === "autopilot") {
    p.autopilot = ownsUpgrade("auto-chip") ? 7.5 : 5;
    setMessage(`Autopilot active for ${Math.round(p.autopilot)} seconds.`);
  } else if (entity.id === "immortal") {
    p.immortal = 5;
    setMessage("Immortality active for 5 seconds.");
  } else {
    const value = Math.round((25 + state.heat * 8) * (ownsUpgrade("cash-magnet") ? 1.5 : 1));
    state.cash += value;
    setMessage(`Grabbed $${value}.`);
  }
}

function update(dt) {
  if (state.mode !== "playing") return;
  const d = difficulty();
  const p = state.player;

  p.autopilot = Math.max(0, p.autopilot - dt);
  p.immortal = Math.max(0, p.immortal - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  if (p.autopilot > 0) {
    p.lane = findSafeLane();
    p.targetX = lanes[p.lane];
  }
  p.x += (p.targetX - p.x) * Math.min(1, dt * d.handling);
  p.speed += d.accel * dt;
  p.speed = Math.min(d.topSpeed, p.speed);

  state.runDistance += p.speed * dt;
  state.score = Math.max(state.score, state.runDistance);
  const heatRate = modes[state.selectedMode].heatRate + (ownsUpgrade("bolt-jammer") ? 220 : 0);
  state.heat = 1 + Math.floor(state.runDistance / heatRate);
  state.roadOffset += (p.speed * 5.4) * dt;
  state.spawnTimer -= dt;
  state.pickupTimer -= dt;
  state.crashHeat = Math.max(0, state.crashHeat - dt * 0.45);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (state.messageTimer <= 0) state.message = "";

  if (state.spawnTimer <= 0) {
    spawnObstacleWave();
    state.spawnTimer = d.spawnEvery + Math.random() * 0.18;
  }
  if (state.pickupTimer <= 0) {
    spawnPickup();
    state.pickupTimer = d.pickupEvery + Math.random() * 1.25;
  }

  const carBox = { x: p.x, y: p.y, width: 82, height: 128 };
  state.entities.forEach((entity) => {
    entity.y += (entity.speed + p.speed * 2.15) * dt;
    if (entity.hit || !collide(carBox, entity)) return;
    if (entity.kind === "pickup") collectPickup(entity);
    else if (p.invulnerable <= 0) hitObstacle(entity);
  });
  state.entities = state.entities.filter((entity) => entity.y < canvas.height + 180 && !entity.hit);

  updateHud();
}

function roadX(x) {
  return canvas.width / 2 + x;
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawRoad() {
  ctx.fillStyle = "#171a20";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const roadLeft = 145;
  const roadWidth = canvas.width - roadLeft * 2;
  ctx.fillStyle = "#2a2e35";
  ctx.fillRect(roadLeft, 0, roadWidth, canvas.height);
  ctx.fillStyle = "#555b64";
  ctx.fillRect(roadLeft - 10, 0, 10, canvas.height);
  ctx.fillRect(roadLeft + roadWidth, 0, 10, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.44)";
  ctx.lineWidth = 6;
  ctx.setLineDash([34, 30]);
  ctx.lineDashOffset = -state.roadOffset;
  [canvas.width / 2 - 105, canvas.width / 2 + 105].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, -60);
    ctx.lineTo(x, canvas.height + 60);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function equippedCosmetic(type) {
  const profile = state.profile || getProfile(state.username || "Driver");
  const id = type === "color" ? profile.equippedColor : profile.equippedHat;
  return cosmetics.find((item) => item.id === id);
}

function carColor() {
  if (state.player.immortal > 0) {
    const hue = Math.floor((performance.now() / 8) % 360);
    return `hsl(${hue}, 96%, 58%)`;
  }
  if (state.player.invulnerable > 0) return "#ff4f64";
  if (state.player.autopilot > 0) return "#37d5ff";
  const paint = equippedCosmetic("color");
  if (paint?.color === "rainbow") {
    const hue = Math.floor((performance.now() / 16) % 360);
    return `hsl(${hue}, 90%, 58%)`;
  }
  return paint?.color || "#54e08b";
}

function drawCar(x, y, body, trim = "#111318") {
  const hat = equippedCosmetic("hat")?.hat;
  ctx.save();
  ctx.translate(roadX(x), y);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundedRect(-48, -58, 96, 132, 18);
  ctx.fillStyle = body;
  roundedRect(-42, -68, 84, 136, 16);
  ctx.fillStyle = trim;
  roundedRect(-30, -45, 60, 38, 10);
  roundedRect(-28, 14, 56, 34, 10);
  ctx.fillStyle = "#f7f7f2";
  ctx.fillRect(-32, -70, 18, 8);
  ctx.fillRect(14, -70, 18, 8);
  if (hat === "cap") {
    ctx.fillStyle = "#f7f7f2";
    roundedRect(-24, -92, 48, 14, 6);
    ctx.fillStyle = "#37d5ff";
    ctx.fillRect(6, -84, 28, 6);
  } else if (hat === "crown") {
    ctx.fillStyle = "#ffd447";
    ctx.beginPath();
    ctx.moveTo(-28, -82);
    ctx.lineTo(-18, -104);
    ctx.lineTo(-5, -84);
    ctx.lineTo(8, -106);
    ctx.lineTo(20, -84);
    ctx.lineTo(30, -102);
    ctx.lineTo(28, -78);
    ctx.lineTo(-28, -78);
    ctx.closePath();
    ctx.fill();
  } else if (hat === "spoiler") {
    ctx.fillStyle = "#37d5ff";
    roundedRect(-44, -92, 88, 10, 5);
    ctx.fillStyle = "#b97cff";
    ctx.fillRect(-34, -82, 68, 7);
  } else if (hat === "halo") {
    ctx.strokeStyle = "#f7f7f2";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, -92, 34, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();
  ctx.translate(roadX(o.x), o.y);
  if (o.id === "cone") {
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(28, 30);
    ctx.lineTo(-28, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff5d0";
    ctx.fillRect(-22, 12, 44, 8);
  } else if (o.id === "oil") {
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 32, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(55,213,255,0.25)";
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.fillStyle = o.color;
    roundedRect(-o.width / 2, -o.height / 2, o.width, o.height, 8);
    ctx.fillStyle = o.id === "roadblock" ? "#16181d" : "rgba(255,255,255,0.22)";
    ctx.fillRect(-o.width / 2 + 10, -6, o.width - 20, 12);
  }
  ctx.restore();
}

function drawPickup(pickup) {
  ctx.save();
  ctx.translate(roadX(pickup.x), pickup.y);
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath();
  ctx.arc(4, 5, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pickup.color;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111318";
  ctx.font = "bold 21px sans-serif";
  ctx.textAlign = "center";
  const label = { life: "+", autopilot: "A", immortal: "I", cash: "$" }[pickup.id];
  ctx.fillText(label, 0, 8);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawMessage() {
  if (!state.message || state.mode !== "playing") return;
  ctx.fillStyle = "rgba(16,18,23,0.72)";
  roundedRect(canvas.width / 2 - 230, 86, 460, 34, 8);
  ctx.fillStyle = "#f7f7f2";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(state.message, canvas.width / 2, 109);
  ctx.textAlign = "left";
}

function drawScoreStrip() {
  ctx.fillStyle = "rgba(16,18,23,0.72)";
  roundedRect(canvas.width - 222, 84, 200, 76, 8);
  ctx.fillStyle = "#f7f7f2";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`${Math.round(state.score)} m`, canvas.width - 204, 108);
  ctx.fillStyle = "#b7b8bd";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${modes[state.selectedMode].label} best ${topScore(state.selectedMode)} m`, canvas.width - 204, 128);
  const active = [];
  if (state.player.autopilot > 0) active.push(`Auto ${Math.ceil(state.player.autopilot)}s`);
  if (state.player.immortal > 0) active.push(`Immortal ${Math.ceil(state.player.immortal)}s`);
  ctx.fillText(active.join("  ") || "No power active", canvas.width - 204, 148);
}

function draw() {
  drawRoad();
  state.entities.forEach((entity) => entity.kind === "pickup" ? drawPickup(entity) : drawObstacle(entity));
  drawCar(state.player.x, state.player.y, carColor());
  drawScoreStrip();
  drawMessage();
}

function updateHud() {
  ui.levelText.textContent = String(state.heat);
  ui.speedText.textContent = `${Math.round(state.player.speed)} mph`;
  ui.cashText.textContent = `$${state.cash}`;
  ui.progressText.textContent = `${Math.max(0, state.lives)}/${state.maxLives}`;
}

function loop(time) {
  const dt = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

panel.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const nameInput = document.getElementById("driverName");
  if (nameInput) syncProfileFromInput();
  if (target.dataset.start) resetRun(target.dataset.start);
  if (target.dataset.view === "menu") showMenu();
  if (target.dataset.view === "info") showInfo();
  if (target.dataset.view === "shop") showShop();
  if (target.dataset.buyCosmetic) buyCosmetic(target.dataset.buyCosmetic);
  if (target.dataset.equipCosmetic) equipCosmetic(target.dataset.equipCosmetic);
  if (target.dataset.buyUpgrade) buyUpgrade(target.dataset.buyUpgrade);
  if (target.dataset.resume !== undefined) resumeRun();
  if (target.dataset.exitMenu !== undefined) exitToMenuFromPause();
  if (target.dataset.retry !== undefined) resetRun(state.selectedMode);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    if (state.mode === "playing") showPause();
    else if (state.mode === "paused") resumeRun();
    return;
  }
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") switchLane(-1);
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") switchLane(1);
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  switchLane(x < rect.width / 2 ? -1 : 1);
});

/* Visual quality upgrade: richer canvas rendering */
function drawMountains(base, light, dark, speed) {
  const offset = -(state.roadOffset * speed) % 150;
  ctx.beginPath();
  ctx.moveTo(-120, base + 120);
  for (let x = offset - 160; x < canvas.width + 220; x += 150) {
    const peak = base - 96 - Math.abs(Math.sin(x * 0.018)) * 70;
    ctx.lineTo(x + 75, peak);
    ctx.lineTo(x + 160, base + 120);
  }
  ctx.lineTo(canvas.width + 160, canvas.height);
  ctx.lineTo(-120, canvas.height);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, base - 180, 0, canvas.height);
  grad.addColorStop(0, light);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawRoad() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#122a47");
  sky.addColorStop(0.45, "#244761");
  sky.addColorStop(1, "#121820");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 7; i++) {
    const x = (i * 190 - state.roadOffset * 0.04) % (canvas.width + 220) - 100;
    ctx.beginPath();
    ctx.ellipse(x, 72 + (i % 3) * 42, 74, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 45, 78 + (i % 3) * 42, 48, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  drawMountains(245, "#cddbe0", "#536b76", 0.13);
  drawMountains(340, "#71877f", "#263b36", 0.24);

  const roadWidth = 590;
  const roadLeft = canvas.width / 2 - roadWidth / 2;
  const roadRight = canvas.width / 2 + roadWidth / 2;
  const ground = ctx.createLinearGradient(0, canvas.height * 0.45, 0, canvas.height);
  ground.addColorStop(0, "#334939");
  ground.addColorStop(1, "#0f1b18");
  ctx.fillStyle = ground;
  ctx.fillRect(0, canvas.height * 0.44, canvas.width, canvas.height * 0.56);

  const road = ctx.createLinearGradient(0, 0, 0, canvas.height);
  road.addColorStop(0, "#3d4652");
  road.addColorStop(0.5, "#252d36");
  road.addColorStop(1, "#171d24");
  ctx.fillStyle = road;
  ctx.beginPath();
  ctx.moveTo(roadLeft + 70, 0);
  ctx.lineTo(roadRight - 70, 0);
  ctx.lineTo(roadRight + 72, canvas.height);
  ctx.lineTo(roadLeft - 72, canvas.height);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = "#ffffff";
  for (let i = 0; i < 52; i++) {
    const y = (i * 47 + state.roadOffset * 2.3) % (canvas.height + 80) - 80;
    const x = roadLeft + 60 + (i * 73) % (roadWidth - 120);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 42, y + 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,225,145,0.92)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(roadLeft + 70, 0);
  ctx.lineTo(roadLeft - 72, canvas.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(roadRight - 70, 0);
  ctx.lineTo(roadRight + 72, canvas.height);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 5;
  ctx.setLineDash([30, 34]);
  ctx.lineDashOffset = state.roadOffset * 1.8;
  [-105, 105].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 + x * 0.72, 0);
    ctx.lineTo(canvas.width / 2 + x, canvas.height);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function drawCar(x, y, body, trim = "#111318") {
  const hat = equippedCosmetic("hat")?.hat;
  ctx.save();
  ctx.translate(roadX(x), y);
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.beginPath();
  ctx.ellipse(0, 28, 58, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#05080c";
  roundedRect(-44, -66, 20, 22, 5); ctx.fill();
  roundedRect(24, -66, 20, 22, 5); ctx.fill();
  roundedRect(-44, 42, 20, 22, 5); ctx.fill();
  roundedRect(24, 42, 20, 22, 5); ctx.fill();
  const paint = ctx.createLinearGradient(-46, -70, 46, 70);
  paint.addColorStop(0, "#ffffff");
  paint.addColorStop(0.08, body);
  paint.addColorStop(0.76, body);
  paint.addColorStop(1, "#14202b");
  ctx.fillStyle = paint;
  roundedRect(-44, -72, 88, 144, 18); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = trim;
  roundedRect(-30, -48, 60, 40, 11); ctx.fill();
  roundedRect(-28, 14, 56, 36, 11); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  ctx.fillRect(-20, -42, 18, 30);
  ctx.fillStyle = "#ffe58b";
  ctx.fillRect(-32, -75, 18, 8);
  ctx.fillRect(14, -75, 18, 8);
  ctx.fillStyle = "#ff5d58";
  ctx.fillRect(-32, 67, 18, 7);
  ctx.fillRect(14, 67, 18, 7);

  if (hat === "cap") {
    ctx.fillStyle = "#f7f7f2";
    roundedRect(-24, -96, 48, 14, 6); ctx.fill();
    ctx.fillStyle = "#37d5ff"; ctx.fillRect(6, -88, 28, 6);
  } else if (hat === "crown") {
    ctx.fillStyle = "#ffd447";
    ctx.beginPath(); ctx.moveTo(-28, -86); ctx.lineTo(-18, -108); ctx.lineTo(-5, -88); ctx.lineTo(8, -110); ctx.lineTo(20, -88); ctx.lineTo(30, -106); ctx.lineTo(28, -82); ctx.lineTo(-28, -82); ctx.closePath(); ctx.fill();
  } else if (hat === "spoiler") {
    ctx.fillStyle = "#37d5ff"; roundedRect(-44, -96, 88, 10, 5); ctx.fill();
    ctx.fillStyle = "#b97cff"; ctx.fillRect(-34, -86, 68, 7);
  } else if (hat === "halo") {
    ctx.strokeStyle = "#f7f7f2"; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, -96, 34, 10, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();
  ctx.translate(roadX(o.x), o.y);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 14, o.width * 0.48, o.height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (o.id === "cone") {
    ctx.fillStyle = "#ff8a34";
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(28, 30); ctx.lineTo(-28, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-22, 12, 44, 8);
  } else if (o.id === "oil") {
    ctx.fillStyle = "#06080c";
    ctx.scale(1.3, 0.55);
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.beginPath(); ctx.arc(-10, -8, 12, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = o.color;
    roundedRect(-o.width / 2, -o.height / 2, o.width, o.height, 8); ctx.fill();
    ctx.fillStyle = o.id === "roadblock" ? "#16181d" : "rgba(255,255,255,0.24)";
    ctx.fillRect(-o.width / 2 + 10, -6, o.width - 20, 12);
  }
  ctx.restore();
}

function drawPickup(pickup) {
  ctx.save();
  ctx.translate(roadX(pickup.x), pickup.y);
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath(); ctx.arc(4, 5, 35, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = pickup.color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = pickup.color;
  ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(performance.now() / 140) * 2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#111318";
  ctx.font = "900 21px sans-serif";
  ctx.textAlign = "center";
  const label = { life: "+", autopilot: "A", immortal: "I", cash: "$" }[pickup.id];
  ctx.fillText(label, 0, 8);
  ctx.textAlign = "left";
  ctx.restore();
}

/* Gameplay tuning: rarer powers, cash multiplier, recovery shield */
if (!pickupTypes.some((pickup) => pickup.id === "cash-multiplier")) {
  pickupTypes.push({ id: "cash-multiplier", label: "Cash Multiplier", color: "#38e39f", width: 60, height: 60 });
}

function weightedPickupType() {
  const mode = modes[state.selectedMode] || modes.medium;
  const heatPressure = Math.max(0.14, 1 - (state.heat - 1) * 0.085);
  const abilityWeight = mode.abilityBias * heatPressure;
  const weights = [
    ["life", 0.34 * abilityWeight],
    ["autopilot", 0.24 * abilityWeight],
    ["immortal", 0.2 * abilityWeight],
    ["cash-multiplier", 0.72 + state.heat * 0.08],
    ["cash", 2.45 + state.heat * 0.24 + (1 - mode.abilityBias) * 2.8],
  ];
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [id, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return pickupTypes.find((pickup) => pickup.id === id);
  }
  return pickupTypes.find((pickup) => pickup.id === "cash");
}

function resetRun(mode) {
  syncProfileFromInput();
  const config = modes[mode] || modes.medium;
  const bonusLife = ownsUpgrade("reinforced-frame") ? 1 : 0;
  const launchBonus = ownsUpgrade("launch-tune") ? 18 : 0;
  state.mode = "playing";
  state.selectedMode = mode;
  state.maxLives = config.lives + bonusLife;
  state.lives = config.lives + bonusLife;
  state.heat = 1;
  state.cash = 0;
  state.cashBanked = false;
  state.score = 0;
  state.lastStandUsed = false;
  state.player.lane = 1;
  state.player.x = 0;
  state.player.targetX = 0;
  state.player.speed = 90 + launchBonus;
  state.player.invulnerable = 0;
  state.player.immortal = 0;
  state.player.autopilot = 0;
  state.player.recoveryShield = 0;
  state.cashMultiplier = 1;
  state.cashMultiplierTimer = 0;
  state.runDistance = 0;
  state.entities = [];
  state.spawnTimer = 0.45;
  state.pickupTimer = 1.8;
  state.crashHeat = 0;
  setMessage("");
  ui.screen.classList.add("hidden");
}

function hitObstacle(entity) {
  const p = state.player;
  entity.hit = true;
  if (p.immortal > 0 || p.recoveryShield > 0) {
    p.speed = Math.max(70, p.speed - 4);
    setMessage(p.recoveryShield > 0 ? "Recovery shield. No life lost." : "Immortal hit. No life lost.");
    return;
  }
  state.lives -= 1;
  p.invulnerable = 0.85;
  const penalty = entity.penalty * (ownsUpgrade("impact-dampers") ? 0.55 : 1);
  p.speed = Math.max(46, p.speed - penalty);
  state.crashHeat += 1.7;
  if (state.lives <= 0 && ownsUpgrade("last-stand") && !state.lastStandUsed) {
    state.lastStandUsed = true;
    state.lives = 1;
    p.invulnerable = 1.4;
    setMessage("Last Stand saved you. One life left.");
    return;
  }
  setMessage(`Hit ${entity.label}. ${state.lives}/${state.maxLives} lives left.`);
  if (state.lives <= 0) showGameOver("Totaled");
}

function collectPickup(entity) {
  const p = state.player;
  entity.hit = true;
  if (entity.id === "life") {
    state.maxLives += 1;
    state.lives += 1;
    setMessage(`Extra life collected. ${state.lives}/${state.maxLives} lives.`);
  } else if (entity.id === "autopilot") {
    p.autopilot = ownsUpgrade("auto-chip") ? 7.5 : 5;
    p.recoveryShield = 0;
    setMessage(`Autopilot active for ${Math.round(p.autopilot)} seconds.`);
  } else if (entity.id === "immortal") {
    p.immortal = 5;
    p.recoveryShield = 0;
    setMessage("Immortality active for 5 seconds.");
  } else if (entity.id === "cash-multiplier") {
    state.cashMultiplier = 2;
    state.cashMultiplierTimer = 8;
    setMessage("Cash multiplier active. Cash grabs are doubled.");
  } else {
    const base = 25 + state.heat * 8;
    const magnet = ownsUpgrade("cash-magnet") ? 1.5 : 1;
    const value = Math.round(base * magnet * (state.cashMultiplier || 1));
    state.cash += value;
    setMessage(`Grabbed $${value}.`);
  }
}

function update(dt) {
  if (state.mode !== "playing") return;
  const d = difficulty();
  const p = state.player;
  const hadAutopilot = p.autopilot > 0;
  const hadImmortal = p.immortal > 0;

  p.autopilot = Math.max(0, p.autopilot - dt);
  p.immortal = Math.max(0, p.immortal - dt);
  if ((hadAutopilot && p.autopilot <= 0) || (hadImmortal && p.immortal <= 0)) {
    p.recoveryShield = Math.max(p.recoveryShield || 0, 3);
    setMessage("Recovery shield active for 3 seconds.");
  }
  p.recoveryShield = Math.max(0, (p.recoveryShield || 0) - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  state.cashMultiplierTimer = Math.max(0, (state.cashMultiplierTimer || 0) - dt);
  if (state.cashMultiplierTimer <= 0) state.cashMultiplier = 1;

  if (p.autopilot > 0) {
    p.lane = findSafeLane();
    p.targetX = lanes[p.lane];
  }
  p.x += (p.targetX - p.x) * Math.min(1, d.handling * dt);
  p.speed = Math.min(d.topSpeed, p.speed + d.accel * dt);
  state.heat += dt / modes[state.selectedMode].heatRate;
  state.heat = Math.min(12, state.heat + dt * 0.115 * (ownsUpgrade("bolt-jammer") ? 0.72 : 1));
  state.score += p.speed * dt * 0.55;
  state.runDistance += p.speed * dt;
  state.roadOffset += (p.speed * dt) / 2;
  state.crashHeat = Math.max(0, state.crashHeat - dt * 0.85);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (state.messageTimer <= 0) state.message = "";

  state.spawnTimer -= dt;
  state.pickupTimer -= dt;
  state.entities.forEach((entity) => { entity.y += entity.speed * dt; });
  state.entities = state.entities.filter((entity) => entity.y < canvas.height + 150 && !entity.hit);
  if (state.spawnTimer <= 0) {
    spawnObstacleWave();
    state.spawnTimer = d.spawnEvery + Math.random() * 0.18;
  }
  if (state.pickupTimer <= 0) {
    spawnPickup();
    state.pickupTimer = d.pickupEvery + Math.random() * 1.25;
  }

  const playerBox = { x: p.x, y: p.y, width: 82, height: 122, lane: p.lane };
  for (const entity of state.entities) {
    if (collide(playerBox, entity)) {
      if (entity.kind === "pickup") collectPickup(entity);
      else hitObstacle(entity);
    }
  }
  updateHud();
}

function carColor() {
  if (state.player.recoveryShield > 0) {
    const flash = Math.floor(performance.now() / 115) % 2 === 0;
    if (flash) return "#f8fbff";
  }
  if (state.player.immortal > 0) {
    const hue = Math.floor((performance.now() / 8) % 360);
    return `hsl(${hue}, 96%, 58%)`;
  }
  if (state.player.invulnerable > 0) return "#ff4f64";
  if (state.player.autopilot > 0) return "#37d5ff";
  const paint = equippedCosmetic("color");
  if (paint?.color === "rainbow") {
    const hue = Math.floor((performance.now() / 16) % 360);
    return `hsl(${hue}, 90%, 58%)`;
  }
  return paint?.color || "#54e08b";
}

function drawPickup(pickup) {
  ctx.save();
  ctx.translate(roadX(pickup.x), pickup.y);
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath(); ctx.arc(4, 5, 35, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = pickup.color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = pickup.color;
  ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(performance.now() / 140) * 2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#111318";
  ctx.font = "900 21px sans-serif";
  ctx.textAlign = "center";
  const label = { life: "+", autopilot: "A", immortal: "I", cash: "$", "cash-multiplier": "x2" }[pickup.id];
  ctx.fillText(label, 0, pickup.id === "cash-multiplier" ? 7 : 8);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawScoreStrip() {
  ctx.fillStyle = "rgba(16,18,23,0.72)";
  roundedRect(canvas.width - 232, 84, 210, 96, 8);
  ctx.fillStyle = "#f7f7f2";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`${Math.round(state.score)} m`, canvas.width - 214, 108);
  ctx.fillStyle = "#b7b8bd";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${modes[state.selectedMode].label} best ${topScore(state.selectedMode)} m`, canvas.width - 214, 128);
  const active = [];
  if (state.player.autopilot > 0) active.push(`Auto ${Math.ceil(state.player.autopilot)}s`);
  if (state.player.immortal > 0) active.push(`Immortal ${Math.ceil(state.player.immortal)}s`);
  if (state.player.recoveryShield > 0) active.push(`Shield ${Math.ceil(state.player.recoveryShield)}s`);
  if ((state.cashMultiplierTimer || 0) > 0) active.push(`Cash x2 ${Math.ceil(state.cashMultiplierTimer)}s`);
  ctx.fillText(active.join("  ") || "No power active", canvas.width - 214, 148);
  ctx.fillText("Cash pickups are more common", canvas.width - 214, 168);
}

function infoHtml() {
  return `
    <p class="eyebrow">About the game</p>
    <h1>Information</h1>
    <p>Switch lanes to avoid hazards. Grab upgrades only when the lane is worth the risk.</p>
    <h2>Obstacles to avoid</h2>
    <div class="visual-grid avoid-grid">
      <article><div class="sample cone-sample"></div><strong>Traffic Cone</strong><span>Small hazard. Costs one life.</span></article>
      <article><div class="sample barrier-sample"></div><strong>Barrier</strong><span>Wide blocker. Switch lanes early.</span></article>
      <article><div class="sample parked-sample"></div><strong>Parked Car</strong><span>Tall hazard. Stays dangerous longer.</span></article>
      <article><div class="sample oil-sample"></div><strong>Oil Spill</strong><span>Dark slick. Costs one life and slows you.</span></article>
      <article><div class="sample roadblock-sample"></div><strong>Roadblock</strong><span>Large blocker. Find the open lane.</span></article>
    </div>
    <h2>Road upgrades</h2>
    <div class="visual-grid upgrade-grid">
      <article><div class="sample pickup-sample life-sample">+</div><strong>Extra Life</strong><span>Rare pickup. Adds one life and raises your life capacity.</span><div class="car-chip green-car">Car stays green</div></article>
      <article><div class="sample pickup-sample auto-sample">A</div><strong>Autopilot</strong><span>Rare pickup. Steers away from danger for 5 seconds.</span><div class="car-chip blue-car">Car turns blue</div></article>
      <article><div class="sample pickup-sample immortal-sample">I</div><strong>Immortality</strong><span>Rare pickup. Hit obstacles safely for 5 seconds.</span><div class="car-chip rainbow-car">Car turns rainbow</div></article>
      <article><div class="sample pickup-sample cash-sample">$</div><strong>Cash</strong><span>More common pickup. Adds cash to your run score.</span><div class="car-chip green-car">Car stays normal</div></article>
      <article><div class="sample pickup-sample multiplier-sample">x2</div><strong>Cash Multiplier</strong><span>Doubles cash grabs for 8 seconds.</span><div class="car-chip green-car">Car stays normal</div></article>
    </div>
    <p>After Autopilot or Immortality ends, the car flashes white and stays protected for 3 seconds.</p>
    <div class="actions"><button data-view="menu" type="button">Back to Menu</button></div>
  `;
}

/* Car animation upgrade: wheel spin, driving bob, lane tilt, tire streaks */
function drawAnimatedWheel(x, y, angle, side) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle * side);
  ctx.fillStyle = "#05080c";
  roundedRect(-9, -15, 18, 30, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.58)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.stroke();
  ctx.restore();
}

function drawCar(x, y, body, trim = "#111318") {
  const hat = equippedCosmetic("hat")?.hat;
  const speedFactor = Math.min(1, state.player.speed / 128);
  const wheelSpin = state.roadOffset * 0.18 + performance.now() * 0.008 * speedFactor;
  const bob = Math.sin(performance.now() * 0.018) * 2.2 * speedFactor;
  const laneLean = Math.max(-0.16, Math.min(0.16, (state.player.targetX - state.player.x) * 0.003));
  const engineShake = Math.sin(performance.now() * 0.04) * 0.012 * speedFactor;

  ctx.save();
  ctx.translate(roadX(x), y + bob);
  ctx.rotate(laneLean + engineShake);

  ctx.save();
  ctx.globalAlpha = 0.32 * speedFactor;
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.lineWidth = 3;
  [-31, 31].forEach((sx) => {
    ctx.beginPath();
    ctx.moveTo(sx, 58);
    ctx.lineTo(sx + Math.sin(performance.now() * 0.02 + sx) * 5, 93 + speedFactor * 16);
    ctx.stroke();
  });
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 30, 62, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  drawAnimatedWheel(-47, -48, wheelSpin, 1);
  drawAnimatedWheel(47, -48, wheelSpin, -1);
  drawAnimatedWheel(-47, 43, wheelSpin, 1);
  drawAnimatedWheel(47, 43, wheelSpin, -1);

  const paint = ctx.createLinearGradient(-46, -74, 48, 74);
  paint.addColorStop(0, "#ffffff");
  paint.addColorStop(0.08, body);
  paint.addColorStop(0.76, body);
  paint.addColorStop(1, "#14202b");
  ctx.fillStyle = paint;
  roundedRect(-44, -74, 88, 148, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(7,17,26,0.8)";
  roundedRect(-30, -50, 60, 40, 11);
  ctx.fill();
  roundedRect(-28, 14, 56, 38, 11);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.moveTo(-20, -44);
  ctx.lineTo(3, -44);
  ctx.lineTo(-7, -15);
  ctx.lineTo(-24, -15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-5, -72, 10, 144);
  ctx.fillStyle = "#ffe58b";
  const headlightGlow = 0.65 + Math.sin(performance.now() * 0.025) * 0.18;
  ctx.globalAlpha = headlightGlow;
  ctx.fillRect(-33, -78, 18, 9);
  ctx.fillRect(15, -78, 18, 9);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ff5d58";
  ctx.fillRect(-33, 69, 18, 7);
  ctx.fillRect(15, 69, 18, 7);

  ctx.save();
  ctx.globalAlpha = 0.28 * speedFactor;
  ctx.strokeStyle = "#59cfff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-44, -68);
  ctx.lineTo(-44, 66);
  ctx.moveTo(44, -68);
  ctx.lineTo(44, 66);
  ctx.stroke();
  ctx.restore();

  if (hat === "cap") {
    ctx.fillStyle = "#f7f7f2";
    roundedRect(-24, -98, 48, 14, 6); ctx.fill();
    ctx.fillStyle = "#37d5ff"; ctx.fillRect(6, -90, 28, 6);
  } else if (hat === "crown") {
    ctx.fillStyle = "#ffd447";
    ctx.beginPath(); ctx.moveTo(-28, -88); ctx.lineTo(-18, -110); ctx.lineTo(-5, -90); ctx.lineTo(8, -112); ctx.lineTo(20, -90); ctx.lineTo(30, -108); ctx.lineTo(28, -84); ctx.lineTo(-28, -84); ctx.closePath(); ctx.fill();
  } else if (hat === "spoiler") {
    ctx.fillStyle = "#37d5ff"; roundedRect(-44, -98, 88, 10, 5); ctx.fill();
    ctx.fillStyle = "#b97cff"; ctx.fillRect(-34, -88, 68, 7);
  } else if (hat === "halo") {
    ctx.strokeStyle = "#f7f7f2"; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, -98, 34, 10, 0, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
}

/* Rehan unlocks, pfps, safer spawns, gold jackpot powerup, premium menu */
try {
  const wipeVersion = "2026-06-23-rehan-pfp-gold-wipe-1";
  if (localStorage.getItem("boltHeistLeaderboardWipeVersion") !== wipeVersion) {
    localStorage.removeItem("boltHeistLeaderboards");
    localStorage.setItem("boltHeistLeaderboardWipeVersion", wipeVersion);
  }
} catch {}

const pfps = [
  { id: "driver", name: "Driver", cost: 0, icon: "D", colors: ["#54e08b", "#102019"], note: "Starter profile." },
  { id: "racer", name: "Racer", cost: 0, icon: "R", colors: ["#37d5ff", "#0b1f2a"], note: "Clean arcade look." },
  { id: "spark", name: "Spark", cost: 0, icon: "S", colors: ["#ffd447", "#271f08"], note: "Bright and simple." },
  { id: "ghost", name: "Ghost", cost: 0, icon: "G", colors: ["#f7f7f2", "#20242c"], note: "Cool neutral style." },
  { id: "comet", name: "Comet", cost: 0, icon: "C", colors: ["#b97cff", "#1c1028"], note: "Starter cosmic badge." },
  { id: "ace", name: "Ace", cost: 260, icon: "A", colors: ["#37d5ff", "#061823"], group: "male", note: "Sharp blue profile." },
  { id: "captain", name: "Captain", cost: 360, icon: "CP", colors: ["#ffd447", "#2a1d08"], group: "male", note: "Gold leader badge." },
  { id: "shadow", name: "Shadow", cost: 520, icon: "SH", colors: ["#303744", "#080b10"], group: "male", note: "Sleek dark profile." },
  { id: "neon-king", name: "Neon King", cost: 760, icon: "NK", colors: ["#37d5ff", "#b97cff"], group: "male", note: "Flashier arcade profile." },
  { id: "gold-legend", name: "Gold Legend", cost: 1100, icon: "GL", colors: ["#ffd447", "#fff3ad"], group: "male", note: "Premium gold profile." },
  { id: "star", name: "Star", cost: 260, icon: "ST", colors: ["#ff7eb6", "#2a1020"], group: "female", note: "Bright pink profile." },
  { id: "nova", name: "Nova", cost: 360, icon: "NV", colors: ["#b97cff", "#1d1230"], group: "female", note: "Purple space badge." },
  { id: "diamond", name: "Diamond", cost: 520, icon: "DM", colors: ["#d9fbff", "#16404a"], group: "female", note: "Clean crystal profile." },
  { id: "neon-queen", name: "Neon Queen", cost: 760, icon: "NQ", colors: ["#ff7eb6", "#37d5ff"], group: "female", note: "Flashier arcade profile." },
  { id: "ruby-legend", name: "Ruby Legend", cost: 1100, icon: "RL", colors: ["#ff4f64", "#ffd447"], group: "female", note: "Premium ruby profile." },
];

if (!pickupTypes.some((pickup) => pickup.id === "gold-jackpot")) {
  pickupTypes.push({ id: "gold-jackpot", label: "Gold Jackpot", color: "#ffd447", width: 66, height: 66 });
}

function grantRehan(profile) {
  if (profileKey(profile.name) !== "rehan") return profile;
  profile.wallet = Math.max(profile.wallet || 0, 999999);
  profile.ownedCosmetics = cosmetics.map((item) => item.id);
  profile.ownedUpgrades = shopUpgrades.map((item) => item.id);
  profile.ownedPfps = pfps.map((item) => item.id);
  profile.equippedPfp ||= "gold-legend";
  return profile;
}

function defaultProfile(name) {
  return grantRehan({
    name,
    wallet: 0,
    ownedCosmetics: ["lime"],
    ownedUpgrades: [],
    ownedPfps: ["driver", "racer", "spark", "ghost", "comet"],
    equippedColor: "lime",
    equippedHat: "none",
    equippedPfp: "driver",
  });
}

function getProfile(name) {
  const clean = cleanName(name);
  const profiles = getProfiles();
  const key = profileKey(clean);
  if (!profiles[key]) profiles[key] = defaultProfile(clean);
  profiles[key].name = clean;
  profiles[key].ownedCosmetics ||= ["lime"];
  profiles[key].ownedUpgrades ||= [];
  profiles[key].ownedPfps ||= ["driver", "racer", "spark", "ghost", "comet"];
  profiles[key].equippedColor ||= "lime";
  profiles[key].equippedHat ||= "none";
  profiles[key].equippedPfp ||= "driver";
  profiles[key].wallet ||= 0;
  profiles[key] = grantRehan(profiles[key]);
  saveProfiles(profiles);
  return profiles[key];
}

function pfpHtml(id, size = "normal") {
  const item = pfps.find((pfp) => pfp.id === id) || pfps[0];
  return `<div class="pfp ${size}" style="--pfp-a:${item.colors[0]};--pfp-b:${item.colors[1]}">${item.icon}</div>`;
}

function menuHtml() {
  const profile = getProfile(state.username || "Driver");
  const boards = getLeaderboards();
  const ownedPfps = pfps.filter((item) => profile.ownedPfps.includes(item.id));
  const boardHtml = ["easy", "medium", "hard"].map((mode) => {
    const rows = (boards[mode] || []).length
      ? boards[mode].map((entry, index) => `<li><span>${index + 1}. ${entry.name}</span><strong>${entry.score} m</strong></li>`).join("")
      : "<li><span>No runs yet</span><strong>--</strong></li>";
    return `<section class="leaderboard"><h3>${modes[mode].label}</h3><ol>${rows}</ol></section>`;
  }).join("");

  return `
    <section class="hero-menu">
      <div>
        <p class="eyebrow">Endless arcade driving</p>
        <h1 class="animated-title">Bolt Heist</h1>
        <p class="subtitle">Pick a driver, choose a difficulty, dodge traffic, grab road cash, and see how long your getaway lasts.</p>
      </div>
      <div class="profile-badge">
        ${pfpHtml(profile.equippedPfp, "large")}
        <span>${profile.name}</span>
        <strong>$${profile.wallet}</strong>
      </div>
    </section>
    <label class="name-field premium-name">
      <span>Driver name</span>
      <input id="driverName" maxlength="16" placeholder="Your name" value="${state.username}">
    </label>
    <div class="pfp-picker">${ownedPfps.map((item) => `<button data-equip-pfp="${item.id}" type="button" class="pfp-choice ${profile.equippedPfp === item.id ? "selected" : ""}">${pfpHtml(item.id)}<span>${item.name}</span></button>`).join("")}</div>
    ${profileKey(profile.name) === "rehan" ? `<p class="rehan-banner">Rehan mode unlocked: every shop skin, pfp, and upgrade is yours.</p>` : ""}
    <div class="mode-grid premium-modes">
      <button data-start="easy" type="button">Easy <small>5 lives</small></button>
      <button data-start="medium" type="button">Medium <small>3 lives</small></button>
      <button data-start="hard" type="button">Hard <small>1 life</small></button>
    </div>
    <div class="menu-actions big-actions">
      <button data-view="shop" type="button">Shop</button>
      <button data-view="info" type="button">Information</button>
    </div>
    <h2>Leaderboards</h2>
    <div class="leaderboards">${boardHtml}</div>
  `;
}

function pfpCard(item, profile) {
  const owned = profile.ownedPfps.includes(item.id);
  const equipped = profile.equippedPfp === item.id;
  const action = owned
    ? `<button data-equip-pfp="${item.id}" type="button" ${equipped ? "disabled" : ""}>${equipped ? "Equipped" : "Equip"}</button>`
    : `<button data-buy-pfp="${item.id}" type="button" ${profile.wallet < item.cost ? "disabled" : ""}>Buy $${item.cost}</button>`;
  return `<article class="shop-card pfp-card">${pfpHtml(item.id)}<strong>${item.name}</strong><span>${item.note}${item.group ? ` ${item.group === "male" ? "Male" : "Female"} set.` : ""}</span>${action}</article>`;
}

function shopHtml() {
  const profile = getProfile(state.username || "Driver");
  const cosmeticCards = cosmetics.map((item) => {
    const owned = profile.ownedCosmetics.includes(item.id);
    const equipped = item.type === "color" ? profile.equippedColor === item.id : profile.equippedHat === item.id;
    const action = owned
      ? `<button data-equip-cosmetic="${item.id}" type="button" ${equipped ? "disabled" : ""}>${equipped ? "Equipped" : "Equip"}</button>`
      : `<button data-buy-cosmetic="${item.id}" type="button" ${profile.wallet < item.cost ? "disabled" : ""}>Buy $${item.cost}</button>`;
    return `<article class="shop-card">${cosmeticPreview(item)}<strong>${item.name}</strong><span>${item.note}</span>${action}</article>`;
  }).join("");

  const upgradeCards = shopUpgrades.map((item) => {
    const owned = profile.ownedUpgrades.includes(item.id);
    return `<article class="shop-card"><div class="shop-preview upgrade-preview">${item.name.slice(0, 2).toUpperCase()}</div><strong>${item.name}</strong><span>${item.note}</span><button data-buy-upgrade="${item.id}" type="button" ${owned || profile.wallet < item.cost ? "disabled" : ""}>${owned ? "Owned" : `Buy $${item.cost}`}</button></article>`;
  }).join("");

  return `
    <p class="eyebrow">Driver shop</p>
    <h1>Shop</h1>
    <p class="wallet-line">Shopping as ${profile.name}: <strong>$${profile.wallet}</strong></p>
    <h2>Cosmetics</h2>
    <div class="shop-grid">${cosmeticCards}</div>
    <h2>Profile Pictures</h2>
    <h3>Basic</h3><div class="shop-grid pfp-shop">${pfps.filter((item) => !item.group).map((item) => pfpCard(item, profile)).join("")}</div>
    <h3>Male Set</h3><div class="shop-grid pfp-shop">${pfps.filter((item) => item.group === "male").map((item) => pfpCard(item, profile)).join("")}</div>
    <h3>Female Set</h3><div class="shop-grid pfp-shop">${pfps.filter((item) => item.group === "female").map((item) => pfpCard(item, profile)).join("")}</div>
    <h2>Permanent Upgrades</h2>
    <div class="shop-grid">${upgradeCards}</div>
    <div class="actions"><button data-view="menu" type="button">Back to Menu</button></div>
  `;
}

function buyPfp(id) {
  const profile = syncProfileFromInput();
  const item = pfps.find((pfp) => pfp.id === id);
  if (!item || profile.ownedPfps.includes(id) || profile.wallet < item.cost) return;
  profile.wallet -= item.cost;
  profile.ownedPfps.push(id);
  profile.equippedPfp = id;
  saveProfile(grantRehan(profile));
  showShop();
}

function equipPfp(id) {
  const profile = syncProfileFromInput();
  if (!profile.ownedPfps.includes(id)) return;
  profile.equippedPfp = id;
  saveProfile(grantRehan(profile));
  if (state.mode === "shop") showShop();
  else showMenu();
}

panel.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const nameInput = document.getElementById("driverName");
  if (nameInput) syncProfileFromInput();
  if (target.dataset.buyPfp) buyPfp(target.dataset.buyPfp);
  if (target.dataset.equipPfp) equipPfp(target.dataset.equipPfp);
});

function spawnObstacleWave() {
  const d = difficulty();
  const laneCount = state.heat >= 3 && Math.random() < 0.45 ? 2 : 1;
  const blocked = [];
  while (blocked.length < laneCount) {
    const lane = Math.floor(Math.random() * 3);
    if (!blocked.includes(lane)) blocked.push(lane);
  }
  blocked.forEach((lane, index) => {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    state.entities.push({ ...type, kind: "obstacle", lane, x: lanes[lane], y: -150 - index * 58, speed: d.obstacleSpeed + Math.random() * 95, hit: false });
  });
}

function weightedPickupType() {
  const mode = modes[state.selectedMode] || modes.medium;
  const heatPressure = Math.max(0.14, 1 - (state.heat - 1) * 0.085);
  const abilityWeight = mode.abilityBias * heatPressure;
  const cashWeight = 2.45 + state.heat * 0.24 + (1 - mode.abilityBias) * 2.8;
  const weights = [
    ["life", 0.62 * abilityWeight],
    ["autopilot", 0.24 * abilityWeight],
    ["immortal", 0.2 * abilityWeight],
    ["cash-multiplier", 0.72 + state.heat * 0.08],
    ["gold-jackpot", cashWeight * 0.01],
    ["cash", cashWeight],
  ];
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [id, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return pickupTypes.find((pickup) => pickup.id === id);
  }
  return pickupTypes.find((pickup) => pickup.id === "cash");
}

function spawnPickup() {
  const d = difficulty();
  const danger = state.entities
    .filter((entity) => entity.kind === "obstacle" && entity.y > -240 && entity.y < 260)
    .map((entity) => entity.lane);
  const safeLanes = [0, 1, 2].filter((lane) => !danger.includes(lane));
  const type = weightedPickupType();
  const lane = safeLanes.length ? safeLanes[Math.floor(Math.random() * safeLanes.length)] : Math.floor(Math.random() * 3);
  state.entities.push({ ...type, kind: "pickup", lane, x: lanes[lane], y: -110, speed: d.obstacleSpeed * 0.94, hit: false });
}

function resetRun(mode) {
  syncProfileFromInput();
  const config = modes[mode] || modes.medium;
  const bonusLife = ownsUpgrade("reinforced-frame") ? 1 : 0;
  const launchBonus = ownsUpgrade("launch-tune") ? 18 : 0;
  state.mode = "playing";
  state.selectedMode = mode;
  state.maxLives = config.lives + bonusLife;
  state.lives = config.lives + bonusLife;
  state.heat = 1;
  state.cash = 0;
  state.cashBanked = false;
  state.score = 0;
  state.lastStandUsed = false;
  state.player.lane = 1;
  state.player.x = 0;
  state.player.targetX = 0;
  state.player.speed = 90 + launchBonus;
  state.player.invulnerable = 0;
  state.player.immortal = 0;
  state.player.autopilot = 0;
  state.player.recoveryShield = 0;
  state.player.goldJackpot = false;
  state.cashMultiplier = 1;
  state.cashMultiplierTimer = 0;
  state.runDistance = 0;
  state.entities = [];
  state.spawnTimer = 0.45;
  state.pickupTimer = 1.8;
  state.crashHeat = 0;
  setMessage("");
  ui.screen.classList.add("hidden");
}

function collectPickup(entity) {
  const p = state.player;
  entity.hit = true;
  if (entity.id === "life") {
    state.maxLives += 1;
    state.lives += 1;
    setMessage(`Extra life collected. ${state.lives}/${state.maxLives} lives.`);
  } else if (entity.id === "autopilot") {
    p.autopilot = ownsUpgrade("auto-chip") ? 7.5 : 5;
    p.recoveryShield = 0;
    setMessage(`Autopilot active for ${Math.round(p.autopilot)} seconds.`);
  } else if (entity.id === "immortal") {
    p.immortal = 5;
    p.recoveryShield = 0;
    setMessage("Immortality active for 5 seconds.");
  } else if (entity.id === "cash-multiplier") {
    state.cashMultiplier = 2;
    state.cashMultiplierTimer = 8;
    setMessage("Cash multiplier active. Cash grabs are doubled.");
  } else if (entity.id === "gold-jackpot") {
    p.goldJackpot = true;
    p.autopilot = Infinity;
    p.immortal = Infinity;
    state.cashMultiplier = 100;
    state.cashMultiplierTimer = Infinity;
    state.cash += 1000;
    setMessage("SUPER GOLD JACKPOT. Infinite immunity, autopilot, and x100 cash.");
  } else {
    const base = 25 + state.heat * 8;
    const magnet = ownsUpgrade("cash-magnet") ? 1.5 : 1;
    const value = Math.round(base * magnet * (state.cashMultiplier || 1));
    state.cash += value;
    setMessage(`Grabbed $${value}.`);
  }
}

function hitObstacle(entity) {
  const p = state.player;
  entity.hit = true;
  if (p.goldJackpot || p.immortal > 0 || p.recoveryShield > 0) {
    p.speed = Math.max(70, p.speed - 4);
    setMessage(p.goldJackpot ? "Gold Jackpot smashed through it." : p.recoveryShield > 0 ? "Recovery shield. No life lost." : "Immortal hit. No life lost.");
    return;
  }
  state.lives -= 1;
  p.invulnerable = 0.85;
  const penalty = entity.penalty * (ownsUpgrade("impact-dampers") ? 0.55 : 1);
  p.speed = Math.max(46, p.speed - penalty);
  state.crashHeat += 1.7;
  if (state.lives <= 0 && ownsUpgrade("last-stand") && !state.lastStandUsed) {
    state.lastStandUsed = true;
    state.lives = 1;
    p.invulnerable = 1.4;
    setMessage("Last Stand saved you. One life left.");
    return;
  }
  setMessage(`Hit ${entity.label}. ${state.lives}/${state.maxLives} lives left.`);
  if (state.lives <= 0) showGameOver("Totaled");
}

function carColor() {
  if (state.player.goldJackpot) return "gold";
  if (state.player.recoveryShield > 0) {
    const flash = Math.floor(performance.now() / 115) % 2 === 0;
    if (flash) return "#f8fbff";
  }
  if (state.player.immortal > 0) {
    const hue = Math.floor((performance.now() / 8) % 360);
    return `hsl(${hue}, 96%, 58%)`;
  }
  if (state.player.invulnerable > 0) return "#ff4f64";
  if (state.player.autopilot > 0) return "#37d5ff";
  const paint = equippedCosmetic("color");
  if (paint?.color === "rainbow") {
    const hue = Math.floor((performance.now() / 16) % 360);
    return `hsl(${hue}, 90%, 58%)`;
  }
  return paint?.color || "#54e08b";
}

function drawPickup(pickup) {
  ctx.save();
  ctx.translate(roadX(pickup.x), pickup.y);
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath(); ctx.arc(4, 5, pickup.id === "gold-jackpot" ? 41 : 35, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = pickup.color;
  ctx.shadowBlur = pickup.id === "gold-jackpot" ? 30 : 18;
  const grad = ctx.createRadialGradient(-8, -10, 4, 0, 0, pickup.id === "gold-jackpot" ? 36 : 29);
  grad.addColorStop(0, "#fff8bf");
  grad.addColorStop(0.45, pickup.color);
  grad.addColorStop(1, pickup.id === "gold-jackpot" ? "#b97800" : pickup.color);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, (pickup.id === "gold-jackpot" ? 34 : 28) + Math.sin(performance.now() / 140) * 2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#111318";
  ctx.font = pickup.id === "gold-jackpot" ? "900 20px sans-serif" : "900 21px sans-serif";
  ctx.textAlign = "center";
  const label = { life: "+", autopilot: "A", immortal: "I", cash: "$", "cash-multiplier": "x2", "gold-jackpot": "G!" }[pickup.id];
  ctx.fillText(label, 0, 8);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawScoreStrip() {
  ctx.fillStyle = "rgba(16,18,23,0.72)";
  roundedRect(canvas.width - 232, 84, 210, 96, 8);
  ctx.fillStyle = "#f7f7f2";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`${Math.round(state.score)} m`, canvas.width - 214, 108);
  ctx.fillStyle = "#b7b8bd";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${modes[state.selectedMode].label} best ${topScore(state.selectedMode)} m`, canvas.width - 214, 128);
  const active = [];
  if (state.player.goldJackpot) active.push("GOLD JACKPOT");
  else {
    if (state.player.autopilot > 0) active.push(`Auto ${Math.ceil(state.player.autopilot)}s`);
    if (state.player.immortal > 0) active.push(`Immortal ${Math.ceil(state.player.immortal)}s`);
  }
  if (state.player.recoveryShield > 0) active.push(`Shield ${Math.ceil(state.player.recoveryShield)}s`);
  if ((state.cashMultiplierTimer || 0) > 0) active.push(state.cashMultiplier === 100 ? "Cash x100" : `Cash x2 ${Math.ceil(state.cashMultiplierTimer)}s`);
  ctx.fillText(active.join("  ") || "No power active", canvas.width - 214, 148);
  ctx.fillText("Cash pickups are more common", canvas.width - 214, 168);
}

function infoHtml() {
  return `
    <p class="eyebrow">About the game</p>
    <h1>Information</h1>
    <p>Switch lanes to avoid hazards. Grab upgrades only when the lane is worth the risk.</p>
    <h2>Obstacles to avoid</h2>
    <div class="visual-grid avoid-grid">
      <article><div class="sample cone-sample"></div><strong>Traffic Cone</strong><span>Small hazard. Costs one life.</span></article>
      <article><div class="sample barrier-sample"></div><strong>Barrier</strong><span>Wide blocker. Switch lanes early.</span></article>
      <article><div class="sample parked-sample"></div><strong>Parked Car</strong><span>Tall hazard. Stays dangerous longer.</span></article>
      <article><div class="sample oil-sample"></div><strong>Oil Spill</strong><span>Dark slick. Costs one life and slows you.</span></article>
      <article><div class="sample roadblock-sample"></div><strong>Roadblock</strong><span>Large blocker. Find the open lane.</span></article>
    </div>
    <h2>Road upgrades</h2>
    <div class="visual-grid upgrade-grid">
      <article><div class="sample pickup-sample life-sample">+</div><strong>Extra Life</strong><span>Rare, but more common now. Adds one life and raises capacity.</span><div class="car-chip green-car">Car stays green</div></article>
      <article><div class="sample pickup-sample auto-sample">A</div><strong>Autopilot</strong><span>Rare pickup. Steers away from danger for 5 seconds.</span><div class="car-chip blue-car">Car turns blue</div></article>
      <article><div class="sample pickup-sample immortal-sample">I</div><strong>Immortality</strong><span>Rare pickup. Hit obstacles safely for 5 seconds.</span><div class="car-chip rainbow-car">Car turns rainbow</div></article>
      <article><div class="sample pickup-sample cash-sample">$</div><strong>Cash</strong><span>Common pickup. Adds cash to your run score.</span><div class="car-chip green-car">Car stays normal</div></article>
      <article><div class="sample pickup-sample multiplier-sample">x2</div><strong>Cash Multiplier</strong><span>Doubles cash grabs for 8 seconds.</span><div class="car-chip green-car">Car stays normal</div></article>
      <article><div class="sample pickup-sample gold-sample">G!</div><strong>Gold Jackpot</strong><span>Super rare. Infinite immunity, autopilot, shiny gold car, and x100 cash.</span><div class="car-chip gold-car">Gold car</div></article>
    </div>
    <p>After Autopilot or Immortality ends, the car flashes white and stays protected for 3 seconds.</p>
    <div class="actions"><button data-view="menu" type="button">Back to Menu</button></div>
  `;
}

/* Final polish: avoid pickup lanes when spawning obstacles, shiny jackpot car */
function spawnObstacleWave() {
  const d = difficulty();
  const pickupLanes = state.entities
    .filter((entity) => entity.kind === "pickup" && entity.y > -260 && entity.y < 280)
    .map((entity) => entity.lane);
  const available = [0, 1, 2].filter((lane) => !pickupLanes.includes(lane));
  const laneCount = state.heat >= 3 && Math.random() < 0.45 && available.length > 1 ? 2 : 1;
  const blocked = [];
  while (blocked.length < laneCount) {
    const source = available.length ? available : [0, 1, 2];
    const lane = source[Math.floor(Math.random() * source.length)];
    if (!blocked.includes(lane)) blocked.push(lane);
  }
  blocked.forEach((lane, index) => {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    state.entities.push({ ...type, kind: "obstacle", lane, x: lanes[lane], y: -150 - index * 58, speed: d.obstacleSpeed + Math.random() * 95, hit: false });
  });
}

function drawCar(x, y, body, trim = "#111318") {
  const hat = equippedCosmetic("hat")?.hat;
  const speedFactor = Math.min(1, state.player.speed / 128);
  const wheelSpin = state.roadOffset * 0.18 + performance.now() * 0.008 * speedFactor;
  const bob = Math.sin(performance.now() * 0.018) * 2.2 * speedFactor;
  const laneLean = Math.max(-0.16, Math.min(0.16, (state.player.targetX - state.player.x) * 0.003));
  const engineShake = Math.sin(performance.now() * 0.04) * 0.012 * speedFactor;
  const jackpot = state.player.goldJackpot || body === "gold";

  ctx.save();
  ctx.translate(roadX(x), y + bob);
  ctx.rotate(laneLean + engineShake);

  ctx.save();
  ctx.globalAlpha = jackpot ? 0.42 : 0.32 * speedFactor;
  ctx.strokeStyle = jackpot ? "rgba(255, 244, 176, 0.72)" : "rgba(255,255,255,0.34)";
  ctx.lineWidth = jackpot ? 4 : 3;
  [-31, 31].forEach((sx) => {
    ctx.beginPath();
    ctx.moveTo(sx, 58);
    ctx.lineTo(sx + Math.sin(performance.now() * 0.02 + sx) * 5, 93 + speedFactor * 16);
    ctx.stroke();
  });
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath(); ctx.ellipse(0, 30, 62, 25, 0, 0, Math.PI * 2); ctx.fill();
  drawAnimatedWheel(-47, -48, wheelSpin, 1);
  drawAnimatedWheel(47, -48, wheelSpin, -1);
  drawAnimatedWheel(-47, 43, wheelSpin, 1);
  drawAnimatedWheel(47, 43, wheelSpin, -1);

  const paint = ctx.createLinearGradient(-50, -76, 50, 76);
  if (jackpot) {
    paint.addColorStop(0, "#fff8bf");
    paint.addColorStop(0.2, "#ffd447");
    paint.addColorStop(0.52, "#fff3a3");
    paint.addColorStop(0.78, "#d39a09");
    paint.addColorStop(1, "#8c5f00");
    ctx.shadowColor = "rgba(255, 212, 71, 0.6)";
    ctx.shadowBlur = 22;
  } else {
    paint.addColorStop(0, "#ffffff");
    paint.addColorStop(0.08, body);
    paint.addColorStop(0.76, body);
    paint.addColorStop(1, "#14202b");
  }
  ctx.fillStyle = paint;
  roundedRect(-44, -74, 88, 148, 18); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = jackpot ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.34)";
  ctx.lineWidth = jackpot ? 3 : 2;
  ctx.stroke();

  ctx.fillStyle = jackpot ? "rgba(50, 30, 0, 0.72)" : "rgba(7,17,26,0.8)";
  roundedRect(-30, -50, 60, 40, 11); ctx.fill();
  roundedRect(-28, 14, 56, 38, 11); ctx.fill();
  ctx.fillStyle = jackpot ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.28)";
  ctx.beginPath(); ctx.moveTo(-20, -44); ctx.lineTo(3, -44); ctx.lineTo(-7, -15); ctx.lineTo(-24, -15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = jackpot ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.18)";
  ctx.fillRect(-5, -72, 10, 144);
  ctx.fillStyle = jackpot ? "#fff8bf" : "#ffe58b";
  ctx.fillRect(-33, -78, 18, 9); ctx.fillRect(15, -78, 18, 9);
  ctx.fillStyle = jackpot ? "#ffef8a" : "#ff5d58";
  ctx.fillRect(-33, 69, 18, 7); ctx.fillRect(15, 69, 18, 7);

  ctx.save();
  ctx.globalAlpha = jackpot ? 0.68 : 0.28 * speedFactor;
  ctx.strokeStyle = jackpot ? "#fff8bf" : "#59cfff";
  ctx.lineWidth = jackpot ? 3 : 2;
  ctx.beginPath(); ctx.moveTo(-44, -68); ctx.lineTo(-44, 66); ctx.moveTo(44, -68); ctx.lineTo(44, 66); ctx.stroke();
  ctx.restore();

  const hatGold = jackpot ? "#ffd447" : null;
  if (hat === "cap") {
    ctx.fillStyle = hatGold || "#f7f7f2"; roundedRect(-24, -98, 48, 14, 6); ctx.fill();
    ctx.fillStyle = jackpot ? "#fff8bf" : "#37d5ff"; ctx.fillRect(6, -90, 28, 6);
  } else if (hat === "crown") {
    ctx.fillStyle = hatGold || "#ffd447";
    ctx.beginPath(); ctx.moveTo(-28, -88); ctx.lineTo(-18, -110); ctx.lineTo(-5, -90); ctx.lineTo(8, -112); ctx.lineTo(20, -90); ctx.lineTo(30, -108); ctx.lineTo(28, -84); ctx.lineTo(-28, -84); ctx.closePath(); ctx.fill();
  } else if (hat === "spoiler") {
    ctx.fillStyle = hatGold || "#37d5ff"; roundedRect(-44, -98, 88, 10, 5); ctx.fill();
    ctx.fillStyle = jackpot ? "#fff8bf" : "#b97cff"; ctx.fillRect(-34, -88, 68, 7);
  } else if (hat === "halo") {
    ctx.strokeStyle = hatGold || "#f7f7f2"; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, -98, 34, 10, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/* v3 boot disabled; v4 boot runs after all premium mode data is loaded. */

/* v4: emoji pfps, nicer menu, lane-expansion mode, safer spacing */
const pfpEmojiUpgrade = {
  driver: { name: "Ninja", icon: "??", note: "Silent getaway style." },
  racer: { name: "Dinosaur", icon: "??", note: "Big stomp energy." },
  spark: { name: "Robot", icon: "??", note: "Clean machine focus." },
  ghost: { name: "Ghost", icon: "??", note: "Spooky smooth driver." },
  comet: { name: "Alien", icon: "??", note: "Out of this world." },
  ace: { name: "Knight", icon: "???", note: "Armored road hero." },
  captain: { name: "Wizard", icon: "??", note: "Magic behind the wheel." },
  shadow: { name: "Pirate", icon: "?????", note: "Treasure hunter profile." },
  "neon-king": { name: "Dragon", icon: "??", note: "Legendary neon beast." },
  "gold-legend": { name: "Pharaoh", icon: "??", note: "Premium golden ruler." },
  star: { name: "Princess", icon: "??", note: "Royal pink profile." },
  nova: { name: "Fairy", icon: "??", note: "Glowing magic profile." },
  diamond: { name: "Mermaid", icon: "?????", note: "Crystal ocean profile." },
  "neon-queen": { name: "Unicorn", icon: "??", note: "Colorful neon legend." },
  "ruby-legend": { name: "Valkyrie", icon: "??", note: "Premium sky warrior." },
};
pfps.forEach((pfp) => Object.assign(pfp, pfpEmojiUpgrade[pfp.id] || {}));

modes.laneSurge = { label: "Lane Surge", lives: 3, heatRate: 810, spawnOffset: 0.05, pickupDelay: 0.35, abilityBias: 0.52, laneGrowth: true };

function currentLaneCount() {
  if (!modes[state.selectedMode]?.laneGrowth) return 3;
  return Math.min(7, 3 + Math.floor((state.score || 0) / 1000));
}

function setLaneCount(count) {
  const safeCount = Math.max(3, Math.min(7, count));
  if (lanes.length === safeCount) return;
  const span = Math.min(660, canvas.width - 260);
  const spacing = safeCount === 1 ? 0 : span / (safeCount - 1);
  lanes.length = 0;
  for (let i = 0; i < safeCount; i++) lanes.push((i - (safeCount - 1) / 2) * spacing);
  state.player.lane = Math.max(0, Math.min(safeCount - 1, state.player.lane));
  state.player.targetX = lanes[state.player.lane];
}

function syncLaneCountForMode() {
  setLaneCount(currentLaneCount());
}

function pfpHtml(id, size = "normal") {
  const item = pfps.find((pfp) => pfp.id === id) || pfps[0];
  return `<div class="pfp emoji-pfp ${size}" style="--pfp-a:${item.colors[0]};--pfp-b:${item.colors[1]}"><span>${item.icon}</span></div>`;
}

function menuHtml() {
  const profile = getProfile(state.username || "Driver");
  const boards = getLeaderboards();
  const ownedPfps = pfps.filter((item) => profile.ownedPfps.includes(item.id));
  const boardHtml = ["easy", "medium", "hard", "laneSurge"].map((mode) => {
    const rows = (boards[mode] || []).length
      ? boards[mode].map((entry, index) => `<li><span class="rank">#${index + 1}</span><span class="driver-name">${entry.name}</span><strong>${entry.score} m</strong></li>`).join("")
      : `<li><span class="rank">--</span><span class="driver-name">No runs yet</span><strong>0 m</strong></li>`;
    return `<section class="leaderboard premium-board"><h3>${modes[mode].label}</h3><ol>${rows}</ol></section>`;
  }).join("");

  return `
    <section class="hero-menu cinematic-menu">
      <div class="hero-copy">
        <p class="eyebrow">Endless arcade driving</p>
        <h1 class="animated-title">Bolt Heist</h1>
        <p class="subtitle">Dodge traffic, grab road cash, unlock wild cosmetics, and survive long enough for the road itself to change.</p>
      </div>
      <div class="profile-badge premium-profile">
        ${pfpHtml(profile.equippedPfp, "large")}
        <span>${profile.name}</span>
        <strong>$${profile.wallet}</strong>
      </div>
      <div class="menu-road-art" aria-hidden="true"><span></span><span></span><span></span></div>
    </section>
    <label class="name-field premium-name">
      <span>Driver name</span>
      <input id="driverName" maxlength="16" placeholder="Your name" value="${state.username}">
    </label>
    <div class="pfp-picker emoji-picker">${ownedPfps.map((item) => `<button data-equip-pfp="${item.id}" type="button" class="pfp-choice ${profile.equippedPfp === item.id ? "selected" : ""}">${pfpHtml(item.id)}<span>${item.name}</span></button>`).join("")}</div>
    ${profileKey(profile.name) === "rehan" ? `<p class="rehan-banner">Rehan mode unlocked: every skin, pfp, and upgrade is yours.</p>` : ""}
    <h2>Choose Mode</h2>
    <div class="mode-grid premium-modes four-modes">
      <button data-start="easy" type="button">Easy <small>5 lives</small></button>
      <button data-start="medium" type="button">Medium <small>3 lives</small></button>
      <button data-start="hard" type="button">Hard <small>1 life</small></button>
      <button data-start="laneSurge" type="button">Lane Surge <small>New lanes every 1000 m</small></button>
    </div>
    <div class="menu-actions big-actions">
      <button data-view="shop" type="button">Shop</button>
      <button data-view="info" type="button">Information</button>
    </div>
    <h2>Leaderboards</h2>
    <div class="leaderboards aesthetic-leaderboards">${boardHtml}</div>
  `;
}

function switchLane(dir) {
  if (state.mode !== "playing" || state.player.autopilot > 0) return;
  syncLaneCountForMode();
  state.player.lane = Math.max(0, Math.min(lanes.length - 1, state.player.lane + dir));
  state.player.targetX = lanes[state.player.lane];
}

function pickClearLane(blocked) {
  syncLaneCountForMode();
  const available = lanes.map((_, lane) => lane).filter((lane) => !blocked.includes(lane));
  return available[Math.floor(Math.random() * available.length)] ?? Math.floor(lanes.length / 2);
}

function findSafeLane() {
  syncLaneCountForMode();
  const danger = state.entities
    .filter((entity) => entity.kind === "obstacle" && entity.y > 120 && entity.y < state.player.y + 30)
    .map((entity) => entity.lane);
  if (!danger.includes(state.player.lane)) return state.player.lane;
  return pickClearLane(danger);
}

function resetRun(mode) {
  syncProfileFromInput();
  const config = modes[mode] || modes.medium;
  const bonusLife = ownsUpgrade("reinforced-frame") ? 1 : 0;
  const launchBonus = ownsUpgrade("launch-tune") ? 18 : 0;
  state.mode = "playing";
  state.selectedMode = mode;
  state.maxLives = config.lives + bonusLife;
  state.lives = config.lives + bonusLife;
  state.heat = 1;
  state.cash = 0;
  state.cashBanked = false;
  state.score = 0;
  state.lastStandUsed = false;
  state.player.lane = 1;
  state.player.x = 0;
  state.player.speed = 90 + launchBonus;
  state.player.invulnerable = 0;
  state.player.immortal = 0;
  state.player.autopilot = 0;
  state.player.recoveryShield = 0;
  state.player.goldJackpot = false;
  state.cashMultiplier = 1;
  state.cashMultiplierTimer = 0;
  state.runDistance = 0;
  state.entities = [];
  state.spawnTimer = 0.75;
  state.pickupTimer = 1.8;
  state.crashHeat = 0;
  setLaneCount(3);
  state.player.lane = Math.floor(lanes.length / 2);
  state.player.x = lanes[state.player.lane];
  state.player.targetX = lanes[state.player.lane];
  setMessage("");
  ui.screen.classList.add("hidden");
}

function difficulty() {
  const mode = modes[state.selectedMode] || modes.medium;
  const heat = state.heat;
  const turbo = ownsUpgrade("turbo-tune") ? 9 : 0;
  const grip = ownsUpgrade("street-grip") ? 1.8 : 0;
  const radar = ownsUpgrade("pickup-radar") ? -0.45 : 0;
  const lanePressure = Math.max(0, currentLaneCount() - 3) * 0.02;
  return {
    topSpeed: 116 + turbo,
    accel: 18,
    handling: 8.9 + grip,
    spawnEvery: Math.max(0.5, 1.18 + mode.spawnOffset - heat * 0.04 + lanePressure),
    pickupEvery: Math.max(1.75, 3.8 + mode.pickupDelay + radar - heat * 0.05),
    obstacleSpeed: 385 + heat * 27,
  };
}

function spawnObstacleWave() {
  syncLaneCountForMode();
  const d = difficulty();
  const pickupLanes = state.entities
    .filter((entity) => entity.kind === "pickup" && entity.y > -320 && entity.y < 340)
    .map((entity) => entity.lane);
  const available = lanes.map((_, lane) => lane).filter((lane) => !pickupLanes.includes(lane));
  const maxBlocked = Math.max(1, Math.min(lanes.length - 1, state.heat >= 3 ? 2 : 1));
  const laneCount = state.heat >= 3 && Math.random() < 0.42 && available.length > 1 ? maxBlocked : 1;
  const blocked = [];
  while (blocked.length < laneCount) {
    const source = available.length ? available : lanes.map((_, lane) => lane);
    const lane = source[Math.floor(Math.random() * source.length)];
    if (!blocked.includes(lane)) blocked.push(lane);
  }
  blocked.forEach((lane, index) => {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    state.entities.push({ ...type, kind: "obstacle", lane, x: lanes[lane], y: -230 - index * 148, speed: d.obstacleSpeed + Math.random() * 82, hit: false });
  });
}

function spawnPickup() {
  syncLaneCountForMode();
  const d = difficulty();
  const danger = state.entities
    .filter((entity) => entity.kind === "obstacle" && entity.y > -340 && entity.y < 360)
    .map((entity) => entity.lane);
  const safeLanes = lanes.map((_, lane) => lane).filter((lane) => !danger.includes(lane));
  const type = weightedPickupType();
  const lane = safeLanes.length ? safeLanes[Math.floor(Math.random() * safeLanes.length)] : Math.floor(Math.random() * lanes.length);
  state.entities.push({ ...type, kind: "pickup", lane, x: lanes[lane], y: -120, speed: d.obstacleSpeed * 0.94, hit: false });
}

function update(dt) {
  if (state.mode !== "playing") return;
  syncLaneCountForMode();
  const d = difficulty();
  const p = state.player;
  const hadAutopilot = p.autopilot > 0;
  const hadImmortal = p.immortal > 0;

  p.autopilot = Math.max(0, p.autopilot - dt);
  p.immortal = Math.max(0, p.immortal - dt);
  if ((hadAutopilot && p.autopilot <= 0) || (hadImmortal && p.immortal <= 0)) {
    p.recoveryShield = Math.max(p.recoveryShield || 0, 3);
    setMessage("Recovery shield active for 3 seconds.");
  }
  p.recoveryShield = Math.max(0, (p.recoveryShield || 0) - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  state.cashMultiplierTimer = Math.max(0, (state.cashMultiplierTimer || 0) - dt);
  if (state.cashMultiplierTimer <= 0) state.cashMultiplier = 1;

  if (p.autopilot > 0) {
    p.lane = findSafeLane();
    p.targetX = lanes[p.lane];
  }
  p.lane = Math.max(0, Math.min(lanes.length - 1, p.lane));
  p.targetX = lanes[p.lane];
  p.x += (p.targetX - p.x) * Math.min(1, d.handling * dt);
  p.speed = Math.min(d.topSpeed, p.speed + d.accel * dt);
  state.heat += dt / modes[state.selectedMode].heatRate;
  state.heat = Math.min(12, state.heat + dt * 0.115 * (ownsUpgrade("bolt-jammer") ? 0.72 : 1));
  state.score += p.speed * dt * 0.55;
  state.runDistance += p.speed * dt;
  state.roadOffset += (p.speed * dt) / 2;
  syncLaneCountForMode();
  state.crashHeat = Math.max(0, state.crashHeat - dt * 0.85);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (state.messageTimer <= 0) state.message = "";

  state.spawnTimer -= dt;
  state.pickupTimer -= dt;
  state.entities.forEach((entity) => { entity.y += entity.speed * dt; });
  state.entities = state.entities.filter((entity) => entity.y < canvas.height + 180 && !entity.hit);
  if (state.spawnTimer <= 0) {
    spawnObstacleWave();
    state.spawnTimer = d.spawnEvery + 0.32 + Math.random() * 0.28;
  }
  if (state.pickupTimer <= 0) {
    spawnPickup();
    state.pickupTimer = d.pickupEvery + Math.random() * 1.25;
  }

  const playerBox = { x: p.x, y: p.y, width: 82, height: 122, lane: p.lane };
  for (const entity of state.entities) {
    if (collide(playerBox, entity)) {
      if (entity.kind === "pickup") collectPickup(entity);
      else hitObstacle(entity);
    }
  }
  updateHud();
}

function drawRoad() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#122a47");
  sky.addColorStop(0.45, "#244761");
  sky.addColorStop(1, "#121820");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 7; i++) {
    const x = (i * 190 - state.roadOffset * 0.04) % (canvas.width + 220) - 100;
    ctx.beginPath(); ctx.ellipse(x, 72 + (i % 3) * 42, 74, 15, 0, 0, Math.PI * 2); ctx.ellipse(x + 45, 78 + (i % 3) * 42, 48, 12, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  drawMountains(245, "#cddbe0", "#536b76", 0.13);
  drawMountains(340, "#71877f", "#263b36", 0.24);
  const roadPadding = Math.max(90, 170 - lanes.length * 10);
  const roadLeft = roadPadding;
  const roadRight = canvas.width - roadPadding;
  const roadWidth = roadRight - roadLeft;
  const ground = ctx.createLinearGradient(0, canvas.height * 0.45, 0, canvas.height);
  ground.addColorStop(0, "#334939"); ground.addColorStop(1, "#0f1b18");
  ctx.fillStyle = ground; ctx.fillRect(0, canvas.height * 0.44, canvas.width, canvas.height * 0.56);
  const road = ctx.createLinearGradient(0, 0, 0, canvas.height);
  road.addColorStop(0, "#3d4652"); road.addColorStop(0.5, "#252d36"); road.addColorStop(1, "#171d24");
  ctx.fillStyle = road; ctx.beginPath(); ctx.moveTo(roadLeft + 70, 0); ctx.lineTo(roadRight - 70, 0); ctx.lineTo(roadRight + 72, canvas.height); ctx.lineTo(roadLeft - 72, canvas.height); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,225,145,0.92)"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(roadLeft + 70, 0); ctx.lineTo(roadLeft - 72, canvas.height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(roadRight - 70, 0); ctx.lineTo(roadRight + 72, canvas.height); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.72)"; ctx.lineWidth = 4; ctx.setLineDash([28, 34]); ctx.lineDashOffset = state.roadOffset * 1.8;
  for (let i = 1; i < lanes.length; i++) {
    const x = (lanes[i - 1] + lanes[i]) / 2;
    ctx.beginPath(); ctx.moveTo(roadX(x * 0.72), 0); ctx.lineTo(roadX(x), canvas.height); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(8,13,21,0.64)"; roundedRect(18, canvas.height - 56, 218, 38, 8);
  ctx.fillStyle = "#f8fbff"; ctx.font = "900 14px sans-serif"; ctx.fillText(`${lanes.length} lanes active`, 36, canvas.height - 32);
}

state.buildVersion = "premium-rehan-gold-v4";
if (!state.booted) {
  state.booted = true;
  showMenu();
  updateHud();
  requestAnimationFrame(loop);
} else if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
}

/* v5: browser-safe emoji PFPs. Numeric entities avoid Windows encoding turning emoji into question marks. */
const pfpEntityUpgrade = {
  rookie: { name: "Spark", icon: "&#9889;", cost: 0, gender: "starter" },
  blaze: { name: "Fire", icon: "&#128293;", cost: 0, gender: "starter" },
  neon: { name: "Star", icon: "&#11088;", cost: 0, gender: "starter" },
  mint: { name: "Diamond", icon: "&#128142;", cost: 0, gender: "starter" },
  royal: { name: "Crown", icon: "&#128081;", cost: 0, gender: "starter" },
  driver: { name: "Ninja", icon: "&#129399;", cost: 180, gender: "male" },
  racer: { name: "Dinosaur", icon: "&#129430;", cost: 260, gender: "male" },
  spark: { name: "Robot", icon: "&#129302;", cost: 360, gender: "male" },
  shadow: { name: "Pirate", icon: "&#9760;&#65039;", cost: 520, gender: "male" },
  king: { name: "Dragon", icon: "&#128009;", cost: 820, gender: "male" },
  queen: { name: "Princess", icon: "&#128120;", cost: 180, gender: "female" },
  comet: { name: "Fairy", icon: "&#129498;", cost: 260, gender: "female" },
  starlet: { name: "Unicorn", icon: "&#129412;", cost: 360, gender: "female" },
  valkyrie: { name: "Valkyrie", icon: "&#9876;&#65039;", cost: 520, gender: "female" },
  nebula: { name: "Galaxy", icon: "&#127756;", cost: 820, gender: "female" },
};
pfps.forEach((pfp) => Object.assign(pfp, pfpEntityUpgrade[pfp.id] || {}));
function pfpHtml(id, size = "normal") {
  const item = pfps.find((pfp) => pfp.id === id) || pfps[0];
  return `<div class="pfp emoji-pfp ${size}" style="--pfp-a:${item.colors[0]};--pfp-b:${item.colors[1]}"><span class="pfp-emoji">${item.icon}</span></div>`;
}
state.buildVersion = "premium-rehan-gold-v5";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v6: complete emoji pass for the actual active PFP ids. */
const pfpEntityUpgradeComplete = {
  driver: { name: "Ninja", icon: "&#129399;", note: "Silent getaway style." },
  racer: { name: "Dinosaur", icon: "&#129430;", note: "Big stomp energy." },
  spark: { name: "Robot", icon: "&#129302;", note: "Clean machine focus." },
  ghost: { name: "Ghost", icon: "&#128123;", note: "Spooky smooth driver." },
  comet: { name: "Alien", icon: "&#128125;", note: "Out of this world." },
  ace: { name: "Knight", icon: "&#128737;&#65039;", note: "Armored road hero." },
  captain: { name: "Wizard", icon: "&#129497;", note: "Magic behind the wheel." },
  shadow: { name: "Pirate", icon: "&#9760;&#65039;", note: "Treasure hunter profile." },
  "neon-king": { name: "Dragon", icon: "&#128009;", note: "Legendary neon profile." },
  "gold-legend": { name: "Gold Crown", icon: "&#128081;", note: "Premium golden ruler." },
  star: { name: "Princess", icon: "&#128120;", note: "Royal pink profile." },
  nova: { name: "Fairy", icon: "&#129498;", note: "Glowing magic profile." },
  diamond: { name: "Mermaid", icon: "&#129500;&#8205;&#9792;&#65039;", note: "Crystal ocean profile." },
  "neon-queen": { name: "Unicorn", icon: "&#129412;", note: "Colorful neon legend." },
  "ruby-legend": { name: "Valkyrie", icon: "&#9876;&#65039;", note: "Premium sky warrior." },
};
pfps.forEach((pfp) => Object.assign(pfp, pfpEntityUpgradeComplete[pfp.id] || {}));
state.buildVersion = "premium-rehan-gold-v6";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v7: Lane Surge gets denser as the road grows. More lanes now means more hazards per wave. */
function laneSurgeObstacleCount() {
  const extraLanes = Math.max(0, lanes.length - 3);
  if (!modes[state.selectedMode]?.laneGrowth) {
    return state.heat >= 3 && Math.random() < 0.42 ? 2 : 1;
  }
  let count = 1 + Math.floor(extraLanes / 2);
  if (extraLanes >= 1 && Math.random() < 0.45) count += 1;
  if (extraLanes >= 3 && Math.random() < 0.35) count += 1;
  if (state.heat >= 5 && Math.random() < 0.28) count += 1;
  return Math.max(1, Math.min(lanes.length - 1, count));
}

function spawnObstacleWave() {
  syncLaneCountForMode();
  const d = difficulty();
  const pickupLanes = state.entities
    .filter((entity) => entity.kind === "pickup" && entity.y > -320 && entity.y < 340)
    .map((entity) => entity.lane);
  const allLanes = lanes.map((_, lane) => lane);
  const available = allLanes.filter((lane) => !pickupLanes.includes(lane));
  const laneCount = Math.min(laneSurgeObstacleCount(), Math.max(1, (available.length || allLanes.length) - 1));
  const blocked = [];
  while (blocked.length < laneCount) {
    const source = available.length ? available : allLanes;
    const lane = source[Math.floor(Math.random() * source.length)];
    if (!blocked.includes(lane)) blocked.push(lane);
  }
  blocked.forEach((lane, index) => {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const surgeSpacing = modes[state.selectedMode]?.laneGrowth ? 166 : 148;
    state.entities.push({ ...type, kind: "obstacle", lane, x: lanes[lane], y: -230 - index * surgeSpacing, speed: d.obstacleSpeed + Math.random() * 82, hit: false });
  });
}

state.buildVersion = "premium-rehan-gold-v7";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v8: Lane Surge lane snap fix and Split Heist two-player mode. */
modes.duoDash = { label: "Split Heist", lives: 3, heatRate: 820, spawnOffset: 0.02, pickupDelay: 0.45, abilityBias: 0.5, duo: true };

const collideBeforeV8 = collide;
function entityLaneX(entity) {
  if (entity && typeof entity.lane === "number" && entity.road === undefined && lanes[entity.lane] !== undefined) {
    return lanes[entity.lane];
  }
  return entity?.x ?? 0;
}

function collide(a, b) {
  const bx = entityLaneX(b);
  return Math.abs(a.x - bx) < (a.width + b.width) * 0.5 &&
    Math.abs(a.y - b.y) < (a.height + b.height) * 0.5;
}

const drawObstacleBeforeV8 = drawObstacle;
function drawObstacle(o) {
  if (o && o.road === undefined && typeof o.lane === "number" && lanes[o.lane] !== undefined) o.x = lanes[o.lane];
  drawObstacleBeforeV8(o);
}

const drawPickupBeforeV8 = drawPickup;
function drawPickup(pickup) {
  if (pickup && pickup.road === undefined && typeof pickup.lane === "number" && lanes[pickup.lane] !== undefined) pickup.x = lanes[pickup.lane];
  drawPickupBeforeV8(pickup);
}

const roadXBeforeV8 = roadX;
function roadX(x) {
  return (state.roadCenterOverride ?? canvas.width / 2) + x;
}

const menuHtmlBeforeV8 = menuHtml;
function menuHtml() {
  let html = menuHtmlBeforeV8();
  if (!html.includes('data-start="duoDash"')) {
    html = html.replace(
      '<button data-start="laneSurge" type="button">Lane Surge <small>New lanes every 1000 m</small></button>',
      '<button data-start="laneSurge" type="button">Lane Surge <small>New lanes every 1000 m</small></button><button data-start="duoDash" type="button">Split Heist <small>Left WASD, right arrow keys</small></button>'
    );
    html = html.replace('four-modes', 'five-modes');
  }
  return html;
}

var showMenuBeforeV8 = showMenu;
function showMenu() {
  if (state.duo) state.duo.active = false;
  state.roadCenterOverride = null;
  if (typeof showMenuBeforeV8 === "function") showMenuBeforeV8();
  else {
    state.mode = "menu";
    ui.screen.classList.remove("hidden");
    panel.innerHTML = menuHtml();
  }
}

function duoRoads() {
  return [
    { id: 0, label: "WASD", center: canvas.width * 0.27, left: 58, right: canvas.width * 0.47, lanes: [-96, 0, 96], color: "#54e08b" },
    { id: 1, label: "Arrow Keys", center: canvas.width * 0.73, left: canvas.width * 0.53, right: canvas.width - 58, lanes: [-96, 0, 96], color: "#37d5ff" },
  ];
}

function makeDuoPlayer(index, label, color) {
  return {
    index,
    label,
    color,
    lane: 1,
    x: 0,
    targetX: 0,
    y: 505,
    lives: 3,
    maxLives: 3,
    speed: 92,
    invulnerable: 0,
    immortal: 0,
    autopilot: 0,
    recoveryShield: 0,
    cash: 0,
    alive: true,
  };
}

function resetDuoIntro() {
  syncProfileFromInput();
  state.selectedMode = "duoDash";
  state.mode = "duoIntro";
  state.heat = 1;
  state.cash = 0;
  state.cashBanked = false;
  state.score = 0;
  state.runDistance = 0;
  state.roadOffset = 0;
  state.duo = {
    active: true,
    roads: duoRoads(),
    players: [makeDuoPlayer(0, "Left Driver", "#54e08b"), makeDuoPlayer(1, "Right Driver", "#37d5ff")],
    entities: [],
    spawnTimer: 0.85,
    pickupTimer: 1.9,
    message: "",
    messageTimer: 0,
  };
  ui.screen.classList.remove("hidden");
  panel.innerHTML = `
    <p class="eyebrow">Two-player mode</p>
    <h1>Split Heist</h1>
    <p>Two separate roads. The left side is controlled with WASD. The right side is controlled with the arrow keys.</p>
    <div class="mode-grid premium-modes duo-instructions">
      <button type="button" disabled>Left Road <small>WASD / A and D to switch lanes</small></button>
      <button type="button" disabled>Right Road <small>Arrow keys / left and right to switch lanes</small></button>
    </div>
    <div class="actions"><button data-duo-go type="button">Start Split Heist</button><button data-view="menu" type="button">Back to Menu</button></div>
  `;
  updateHud();
}

const resetRunBeforeV8 = resetRun;
function resetRun(mode) {
  if (mode === "duoDash") {
    resetDuoIntro();
    return;
  }
  if (state.duo) state.duo.active = false;
  state.roadCenterOverride = null;
  resetRunBeforeV8(mode);
}

function startDuoPlay() {
  if (!state.duo?.active) resetDuoIntro();
  state.mode = "playing";
  ui.screen.classList.add("hidden");
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.duoGo !== undefined) startDuoPlay();
});

const switchLaneBeforeV8 = switchLane;
function switchLane(dir) {
  if (state.duo?.active) return;
  switchLaneBeforeV8(dir);
}

function switchDuoLane(playerIndex, dir) {
  if (!state.duo?.active || state.mode !== "playing") return;
  const player = state.duo.players[playerIndex];
  if (!player || !player.alive || player.autopilot > 0) return;
  const road = state.duo.roads[playerIndex];
  player.lane = Math.max(0, Math.min(road.lanes.length - 1, player.lane + dir));
  player.targetX = road.lanes[player.lane];
}

window.addEventListener("keydown", (event) => {
  if (!state.duo?.active || state.mode !== "playing") return;
  const key = event.key.toLowerCase();
  if (key === "a") { event.preventDefault(); switchDuoLane(0, -1); }
  if (key === "d") { event.preventDefault(); switchDuoLane(0, 1); }
  if (event.key === "ArrowLeft") { event.preventDefault(); switchDuoLane(1, -1); }
  if (event.key === "ArrowRight") { event.preventDefault(); switchDuoLane(1, 1); }
});

function duoDifficulty() {
  const heat = state.heat || 1;
  return {
    topSpeed: 118,
    accel: 17,
    handling: 8.7,
    spawnEvery: Math.max(0.58, 1.08 - heat * 0.035),
    pickupEvery: Math.max(1.9, 4.1 - heat * 0.04),
    obstacleSpeed: 382 + heat * 25,
  };
}

function randomDuoLane(road, blocked = []) {
  const choices = road.lanes.map((_, lane) => lane).filter((lane) => !blocked.includes(lane));
  return (choices.length ? choices : road.lanes.map((_, lane) => lane))[Math.floor(Math.random() * (choices.length || road.lanes.length))];
}

function spawnDuoObstacleWave() {
  const d = duoDifficulty();
  for (const road of state.duo.roads) {
    const pickupLanes = state.duo.entities.filter((e) => e.road === road.id && e.kind === "pickup" && e.y > -280 && e.y < 320).map((e) => e.lane);
    const count = state.heat >= 4 && Math.random() < 0.34 ? 2 : 1;
    const blocked = [];
    while (blocked.length < count) {
      const lane = randomDuoLane(road, [...pickupLanes, ...blocked]);
      if (!blocked.includes(lane)) blocked.push(lane);
      if (blocked.length >= road.lanes.length - 1) break;
    }
    blocked.forEach((lane, index) => {
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      state.duo.entities.push({ ...type, kind: "obstacle", road: road.id, lane, x: road.lanes[lane], y: -220 - index * 150, speed: d.obstacleSpeed + Math.random() * 70, hit: false });
    });
  }
}

function spawnDuoPickup() {
  const d = duoDifficulty();
  const road = state.duo.roads[Math.floor(Math.random() * state.duo.roads.length)];
  const danger = state.duo.entities.filter((e) => e.road === road.id && e.kind === "obstacle" && e.y > -320 && e.y < 340).map((e) => e.lane);
  const type = weightedPickupType();
  const lane = randomDuoLane(road, danger);
  state.duo.entities.push({ ...type, kind: "pickup", road: road.id, lane, x: road.lanes[lane], y: -130, speed: d.obstacleSpeed * 0.94, hit: false });
}

function duoSetMessage(text) {
  state.duo.message = text;
  state.duo.messageTimer = text ? 1.5 : 0;
}

function duoCollectPickup(player, entity) {
  entity.hit = true;
  if (entity.id === "life") {
    player.maxLives += 1;
    player.lives += 1;
    duoSetMessage(`${player.label} grabbed an extra life.`);
  } else if (entity.id === "autopilot") {
    player.autopilot = 5;
    player.recoveryShield = 0;
    duoSetMessage(`${player.label} autopilot active.`);
  } else if (entity.id === "immortal") {
    player.immortal = 5;
    player.recoveryShield = 0;
    duoSetMessage(`${player.label} is immortal.`);
  } else if (entity.id === "cash-boost") {
    state.cashMultiplier = 2;
    state.cashMultiplierTimer = 8;
    duoSetMessage("Cash multiplier active.");
  } else if (entity.id === "gold-jackpot") {
    player.immortal = 9999;
    player.autopilot = 9999;
    player.goldJackpot = true;
    state.cashMultiplier = 100;
    state.cashMultiplierTimer = 9999;
    duoSetMessage(`${player.label} hit the Gold Jackpot.`);
  } else {
    const amount = Math.round((12 + state.heat * 2) * (state.cashMultiplier || 1));
    player.cash += amount;
    state.cash += amount;
    duoSetMessage(`${player.label} grabbed $${amount}.`);
  }
}

function duoHitObstacle(player, entity) {
  entity.hit = true;
  if (player.goldJackpot || player.immortal > 0 || player.recoveryShield > 0) {
    player.speed = Math.max(70, player.speed - 4);
    duoSetMessage(`${player.label} smashed through safely.`);
    return;
  }
  if (player.invulnerable > 0) return;
  player.lives -= 1;
  player.invulnerable = 0.85;
  player.speed = Math.max(45, player.speed - entity.penalty);
  duoSetMessage(`${player.label} lost a life.`);
  if (player.lives <= 0) {
    player.alive = false;
    player.speed = 0;
    duoSetMessage(`${player.label} is out.`);
  }
}

function safeDuoLane(playerIndex) {
  const player = state.duo.players[playerIndex];
  const road = state.duo.roads[playerIndex];
  const danger = state.duo.entities.filter((e) => e.road === playerIndex && e.kind === "obstacle" && e.y > 110 && e.y < player.y + 35).map((e) => e.lane);
  if (!danger.includes(player.lane)) return player.lane;
  return randomDuoLane(road, danger);
}

function updateDuo(dt) {
  if (!state.duo?.active || state.mode !== "playing") return;
  const d = duoDifficulty();
  state.heat = Math.min(12, state.heat + dt * 0.12);
  state.score += Math.max(...state.duo.players.map((p) => p.speed)) * dt * 0.5;
  state.runDistance = state.score;
  state.roadOffset += Math.max(...state.duo.players.map((p) => p.speed)) * dt / 2;
  state.cashMultiplierTimer = Math.max(0, (state.cashMultiplierTimer || 0) - dt);
  if (state.cashMultiplierTimer <= 0) state.cashMultiplier = 1;
  state.duo.messageTimer = Math.max(0, state.duo.messageTimer - dt);
  if (state.duo.messageTimer <= 0) state.duo.message = "";

  state.duo.players.forEach((player, index) => {
    if (!player.alive) return;
    const hadAutopilot = player.autopilot > 0;
    const hadImmortal = player.immortal > 0 && player.immortal < 9000;
    player.autopilot = Math.max(0, player.autopilot - dt);
    player.immortal = Math.max(0, player.immortal - dt);
    if ((hadAutopilot && player.autopilot <= 0) || (hadImmortal && player.immortal <= 0)) player.recoveryShield = Math.max(player.recoveryShield || 0, 3);
    player.recoveryShield = Math.max(0, (player.recoveryShield || 0) - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.autopilot > 0) {
      player.lane = safeDuoLane(index);
      player.targetX = state.duo.roads[index].lanes[player.lane];
    }
    player.x += (player.targetX - player.x) * Math.min(1, d.handling * dt);
    player.speed = Math.min(d.topSpeed, player.speed + d.accel * dt);
  });

  state.duo.spawnTimer -= dt;
  state.duo.pickupTimer -= dt;
  state.duo.entities.forEach((entity) => {
    const road = state.duo.roads[entity.road];
    entity.x = road.lanes[entity.lane];
    entity.y += entity.speed * dt;
  });
  state.duo.entities = state.duo.entities.filter((entity) => entity.y < canvas.height + 180 && !entity.hit);
  if (state.duo.spawnTimer <= 0) {
    spawnDuoObstacleWave();
    state.duo.spawnTimer = d.spawnEvery + 0.24 + Math.random() * 0.22;
  }
  if (state.duo.pickupTimer <= 0) {
    spawnDuoPickup();
    state.duo.pickupTimer = d.pickupEvery + Math.random() * 1.1;
  }

  for (const player of state.duo.players) {
    if (!player.alive) continue;
    const playerBox = { x: player.x, y: player.y, width: 82, height: 122, lane: player.lane };
    for (const entity of state.duo.entities) {
      if (entity.road !== player.index || entity.hit || entity.lane !== player.lane) continue;
      if (Math.abs(playerBox.x - entity.x) < (playerBox.width + entity.width) * 0.5 && Math.abs(playerBox.y - entity.y) < (playerBox.height + entity.height) * 0.5) {
        if (entity.kind === "pickup") duoCollectPickup(player, entity);
        else duoHitObstacle(player, entity);
      }
    }
  }

  if (state.duo.players.every((player) => !player.alive)) showDuoGameOver();
  updateHud();
}

function duoCarColor(player) {
  if (player.goldJackpot) return "gold";
  if (player.recoveryShield > 0 && Math.floor(performance.now() / 115) % 2 === 0) return "#f8fbff";
  if (player.immortal > 0) return `hsl(${Math.floor((performance.now() / 8) % 360)}, 96%, 58%)`;
  if (player.invulnerable > 0) return "#ff4f64";
  if (player.autopilot > 0) return "#37d5ff";
  return player.color;
}

function drawDuoRoad(road) {
  const left = road.left;
  const right = road.right;
  const roadGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  roadGradient.addColorStop(0, "#3d4652");
  roadGradient.addColorStop(0.55, "#252d36");
  roadGradient.addColorStop(1, "#171d24");
  ctx.fillStyle = roadGradient;
  ctx.beginPath();
  ctx.moveTo(left + 40, 0);
  ctx.lineTo(right - 40, 0);
  ctx.lineTo(right + 34, canvas.height);
  ctx.lineTo(left - 34, canvas.height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,225,145,0.88)";
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(left + 40, 0); ctx.lineTo(left - 34, canvas.height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(right - 40, 0); ctx.lineTo(right + 34, canvas.height); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.66)";
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 30]);
  ctx.lineDashOffset = state.roadOffset * 1.8;
  for (let i = 1; i < road.lanes.length; i++) {
    const x = road.center + (road.lanes[i - 1] + road.lanes[i]) / 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(8,13,21,0.58)";
  roundedRect(left + 10, 16, right - left - 20, 34, 8); ctx.fill();
  ctx.fillStyle = "#f8fbff";
  ctx.font = "900 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(road.id === 0 ? "LEFT SIDE: WASD" : "RIGHT SIDE: ARROW KEYS", road.center, 38);
  ctx.textAlign = "left";
}

function drawDuo() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#132947");
  sky.addColorStop(0.45, "#244761");
  sky.addColorStop(1, "#101820");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#102018";
  ctx.fillRect(0, canvas.height * 0.44, canvas.width, canvas.height * 0.56);
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.fillRect(canvas.width / 2 - 3, 0, 6, canvas.height);
  state.duo.roads.forEach(drawDuoRoad);
  state.duo.entities.forEach((entity) => {
    const road = state.duo.roads[entity.road];
    entity.x = road.lanes[entity.lane];
    state.roadCenterOverride = road.center;
    entity.kind === "pickup" ? drawPickupBeforeV8(entity) : drawObstacleBeforeV8(entity);
  });
  state.duo.players.forEach((player, index) => {
    const road = state.duo.roads[index];
    state.roadCenterOverride = road.center;
    const oldPlayer = state.player;
    state.player = player;
    if (player.alive) drawCar(player.x, player.y, duoCarColor(player));
    else {
      ctx.save();
      ctx.translate(road.center + player.x, player.y);
      ctx.globalAlpha = 0.42;
      drawCarBeforeDuoFallback(player.x, player.y, "#3a3f48");
      ctx.restore();
    }
    state.player = oldPlayer;
  });
  state.roadCenterOverride = null;
  drawDuoHudStrip();
}

const drawCarBeforeDuoFallback = drawCar;
function drawDuoHudStrip() {
  ctx.fillStyle = "rgba(8,13,21,0.74)";
  roundedRect(18, canvas.height - 62, canvas.width - 36, 44, 10); ctx.fill();
  const left = state.duo.players[0];
  const right = state.duo.players[1];
  ctx.fillStyle = "#f8fbff";
  ctx.font = "900 14px sans-serif";
  ctx.fillText(`Split Heist  |  ${Math.round(state.score)} m  |  Cash $${state.cash}`, 34, canvas.height - 35);
  ctx.fillStyle = left.alive ? "#9ff2bd" : "#ff7b87";
  ctx.fillText(`WASD lives ${Math.max(0, left.lives)}/${left.maxLives}`, 354, canvas.height - 35);
  ctx.fillStyle = right.alive ? "#9fdfff" : "#ff7b87";
  ctx.fillText(`Arrows lives ${Math.max(0, right.lives)}/${right.maxLives}`, 560, canvas.height - 35);
  if (state.duo.message) {
    ctx.fillStyle = "#ffd447";
    ctx.font = "900 16px sans-serif";
    ctx.fillText(state.duo.message, 34, canvas.height - 82);
  }
}

const updateBeforeV8 = update;
function update(dt) {
  if (state.duo?.active) {
    updateDuo(dt);
    return;
  }
  updateBeforeV8(dt);
}

const drawBeforeV8 = draw;
function draw() {
  if (state.duo?.active) {
    drawDuo();
    return;
  }
  state.roadCenterOverride = null;
  state.entities.forEach((entity) => {
    if (entity.road === undefined && typeof entity.lane === "number" && lanes[entity.lane] !== undefined) entity.x = lanes[entity.lane];
  });
  drawBeforeV8();
}

var updateHudBeforeV8 = updateHud;
function updateHud() {
  if (state.duo?.active) {
    const left = state.duo.players?.[0];
    const right = state.duo.players?.[1];
    ui.levelText.textContent = "Duo";
    ui.speedText.textContent = `${Math.round(Math.max(left?.speed || 0, right?.speed || 0))} mph`;
    ui.cashText.textContent = `$${state.cash || 0}`;
    ui.progressText.textContent = left && right ? `L ${Math.max(0, left.lives)}/${left.maxLives} | R ${Math.max(0, right.lives)}/${right.maxLives}` : "3 | 3";
    return;
  }
  if (typeof updateHudBeforeV8 === "function") updateHudBeforeV8();
  else {
    ui.levelText.textContent = String(state.heat || 1);
    ui.speedText.textContent = `${Math.round(state.player?.speed || 0)} mph`;
    ui.cashText.textContent = `$${state.cash || 0}`;
    ui.progressText.textContent = `${Math.max(0, state.lives || 0)}/${state.maxLives || 0}`;
  }
}

function showDuoGameOver() {
  state.mode = "gameover";
  bankRunCash();
  recordScore();
  ui.screen.classList.remove("hidden");
  panel.innerHTML = `
    <p class="eyebrow">Split Heist complete</p>
    <h1>Both drivers crashed out</h1>
    <p>Your team survived ${Math.round(state.score)} m and grabbed $${state.cash}. Left road used WASD. Right road used arrow keys.</p>
    <div class="actions"><button data-start="duoDash" type="button">Retry Split Heist</button><button data-view="menu" type="button">Menu</button></div>
  `;
}

state.buildVersion = "premium-rehan-gold-v8";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v9: Split Heist visual cleanup and leaderboard card. */
const menuHtmlBeforeV9 = menuHtml;
function menuHtml() {
  let html = menuHtmlBeforeV9();
  if (!html.includes('<h3>Split Heist</h3>')) {
    const boards = getLeaderboards();
    const rows = (boards.duoDash || []).length
      ? boards.duoDash.map((entry, index) => `<li><span class="rank">#${index + 1}</span><span class="driver-name">${entry.name}</span><strong>${entry.score} m</strong></li>`).join("")
      : `<li><span class="rank">--</span><span class="driver-name">No runs yet</span><strong>0 m</strong></li>`;
    const duoBoard = `<section class="leaderboard premium-board"><h3>Split Heist</h3><ol>${rows}</ol></section>`;
    html = html.replace('</div>\n  ', `${duoBoard}</div>\n  `);
  }
  return html;
}

function drawDuo() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#132947");
  sky.addColorStop(0.45, "#244761");
  sky.addColorStop(1, "#101820");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#102018";
  ctx.fillRect(0, canvas.height * 0.44, canvas.width, canvas.height * 0.56);
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.fillRect(canvas.width / 2 - 3, 0, 6, canvas.height);
  state.duo.roads.forEach(drawDuoRoad);
  state.duo.entities.forEach((entity) => {
    const road = state.duo.roads[entity.road];
    entity.x = road.lanes[entity.lane];
    state.roadCenterOverride = road.center;
    entity.kind === "pickup" ? drawPickupBeforeV8(entity) : drawObstacleBeforeV8(entity);
  });
  state.duo.players.forEach((player, index) => {
    const road = state.duo.roads[index];
    state.roadCenterOverride = road.center;
    const oldPlayer = state.player;
    state.player = player;
    if (player.alive) {
      drawCar(player.x, player.y, duoCarColor(player));
    } else {
      ctx.save();
      ctx.globalAlpha = 0.36;
      drawCar(player.x, player.y, "#3a3f48");
      ctx.restore();
      ctx.save();
      ctx.translate(road.center + player.x, player.y - 8);
      ctx.strokeStyle = "#ff7b87";
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-42, -42); ctx.lineTo(42, 42); ctx.moveTo(42, -42); ctx.lineTo(-42, 42); ctx.stroke();
      ctx.restore();
    }
    state.player = oldPlayer;
  });
  state.roadCenterOverride = null;
  drawDuoHudStrip();
}

state.buildVersion = "premium-rehan-gold-v9";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v10: rebuild the main menu cleanly to avoid broken string insertion. */
function leaderboardCardHtml(mode) {
  const boards = getLeaderboards();
  const modeInfo = modes[mode] || { label: mode };
  const rows = (boards[mode] || []).length
    ? boards[mode].map((entry, index) => `<li><span class="rank">#${index + 1}</span><span class="driver-name">${entry.name}</span><strong>${entry.score} m</strong></li>`).join("")
    : `<li><span class="rank">--</span><span class="driver-name">No runs yet</span><strong>0 m</strong></li>`;
  return `<section class="leaderboard premium-board"><h3>${modeInfo.label}</h3><ol>${rows}</ol></section>`;
}

function menuHtml() {
  const profile = getProfile(state.username || "Driver");
  const ownedPfps = pfps.filter((item) => profile.ownedPfps.includes(item.id));
  const boardHtml = ["easy", "medium", "hard", "laneSurge", "duoDash"].map(leaderboardCardHtml).join("");
  return `
    <section class="hero-menu cinematic-menu">
      <div class="hero-copy">
        <p class="eyebrow">Endless arcade driving</p>
        <h1 class="animated-title">Bolt Heist</h1>
        <p class="subtitle">Dodge traffic, grab road cash, unlock wild cosmetics, and survive the wildest getaway modes.</p>
      </div>
      <div class="profile-badge premium-profile">
        ${pfpHtml(profile.equippedPfp, "large")}
        <span>${profile.name}</span>
        <strong>$${profile.wallet}</strong>
      </div>
      <div class="menu-road-art" aria-hidden="true"><span></span><span></span><span></span></div>
    </section>
    <label class="name-field premium-name">
      <span>Driver name</span>
      <input id="driverName" maxlength="16" placeholder="Your name" value="${state.username}">
    </label>
    <div class="pfp-picker emoji-picker">${ownedPfps.map((item) => `<button data-equip-pfp="${item.id}" type="button" class="pfp-choice ${profile.equippedPfp === item.id ? "selected" : ""}">${pfpHtml(item.id)}<span>${item.name}</span></button>`).join("")}</div>
    ${profileKey(profile.name) === "rehan" ? `<p class="rehan-banner">Rehan mode unlocked: every skin, pfp, and upgrade is yours.</p>` : ""}
    <h2>Choose Mode</h2>
    <div class="mode-grid premium-modes five-modes">
      <button data-start="easy" type="button">Easy <small>5 lives</small></button>
      <button data-start="medium" type="button">Medium <small>3 lives</small></button>
      <button data-start="hard" type="button">Hard <small>1 life</small></button>
      <button data-start="laneSurge" type="button">Lane Surge <small>New lanes every 1000 m</small></button>
      <button data-start="duoDash" type="button">Split Heist <small>Left WASD, right arrow keys</small></button>
    </div>
    <div class="menu-actions big-actions">
      <button data-view="shop" type="button">Shop</button>
      <button data-view="info" type="button">Information</button>
    </div>
    <h2>Leaderboards</h2>
    <div class="leaderboards aesthetic-leaderboards five-boards">${boardHtml}</div>
  `;
}

state.buildVersion = "premium-rehan-gold-v10";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v13: stable direct runtime core. Avoid wrapper recursion from hoisted function declarations. */
function showMenu() {
  if (state.duo) state.duo.active = false;
  state.roadCenterOverride = null;
  state.mode = "menu";
  ui.screen.classList.remove("hidden");
  panel.innerHTML = menuHtml();
}

function updateHud() {
  if (state.duo?.active) {
    const left = state.duo.players?.[0];
    const right = state.duo.players?.[1];
    ui.levelText.textContent = "Duo";
    ui.speedText.textContent = `${Math.round(Math.max(left?.speed || 0, right?.speed || 0))} mph`;
    ui.cashText.textContent = `$${state.cash || 0}`;
    ui.progressText.textContent = left && right ? `L ${Math.max(0, left.lives)}/${left.maxLives} | R ${Math.max(0, right.lives)}/${right.maxLives}` : "3 | 3";
    return;
  }
  ui.levelText.textContent = String(Math.round(state.heat || 1));
  ui.speedText.textContent = `${Math.round(state.player?.speed || 0)} mph`;
  ui.cashText.textContent = `$${state.cash || 0}`;
  ui.progressText.textContent = `${Math.max(0, state.lives || 0)}/${state.maxLives || 0}`;
}

function roadX(x) {
  return (state.roadCenterOverride ?? canvas.width / 2) + x;
}

function switchLane(dir) {
  if (state.duo?.active) return;
  if (state.mode !== "playing" || state.player.autopilot > 0) return;
  syncLaneCountForMode();
  state.player.lane = Math.max(0, Math.min(lanes.length - 1, state.player.lane + dir));
  state.player.targetX = lanes[state.player.lane];
}

function drawObstacle(o) {
  const laneX = o && o.road === undefined && typeof o.lane === "number" && lanes[o.lane] !== undefined ? lanes[o.lane] : o.x;
  o.x = laneX;
  ctx.save();
  ctx.translate(roadX(laneX), o.y);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 14, o.width * 0.48, o.height * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  if (o.id === "cone") {
    ctx.fillStyle = "#ff8a34"; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(28, 30); ctx.lineTo(-28, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-22, 12, 44, 8);
  } else if (o.id === "barrier") {
    ctx.fillStyle = "#f24f5f"; roundedRect(-58, -23, 116, 46, 8); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-44, -7, 88, 12);
  } else if (o.id === "parked") {
    ctx.fillStyle = "#6cd0ff"; roundedRect(-50, -74, 100, 148, 15); ctx.fill();
    ctx.fillStyle = "#10202d"; roundedRect(-31, -44, 62, 36, 8); ctx.fill(); roundedRect(-29, 16, 58, 34, 8); ctx.fill();
    ctx.fillStyle = "#f7f7f2"; ctx.fillRect(-36, -76, 18, 8); ctx.fillRect(18, -76, 18, 8);
  } else if (o.id === "oil") {
    ctx.fillStyle = "#08090d"; ctx.beginPath(); ctx.ellipse(0, 0, 64, 32, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.ellipse(-18, -8, 22, 9, -0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = "#f7f7f2"; roundedRect(-72, -27, 144, 54, 8); ctx.fill();
    ctx.fillStyle = "#ff4f64"; for (let x = -58; x < 60; x += 36) ctx.fillRect(x, -24, 18, 48);
  }
  ctx.restore();
}

function drawPickup(pickup) {
  const laneX = pickup && pickup.road === undefined && typeof pickup.lane === "number" && lanes[pickup.lane] !== undefined ? lanes[pickup.lane] : pickup.x;
  pickup.x = laneX;
  ctx.save();
  ctx.translate(roadX(laneX), pickup.y);
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath(); ctx.arc(4, 5, pickup.id === "gold-jackpot" ? 41 : 35, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = pickup.color;
  ctx.shadowBlur = pickup.id === "gold-jackpot" ? 30 : 18;
  const grad = ctx.createRadialGradient(-8, -10, 4, 0, 0, pickup.id === "gold-jackpot" ? 36 : 29);
  grad.addColorStop(0, "#fff8bf"); grad.addColorStop(0.45, pickup.color); grad.addColorStop(1, pickup.id === "gold-jackpot" ? "#b97800" : pickup.color);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, pickup.id === "gold-jackpot" ? 34 : 28 + Math.sin(performance.now() / 140) * 2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#111318";
  ctx.font = pickup.id === "gold-jackpot" ? "900 22px sans-serif" : "900 20px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const label = pickup.id === "life" ? "+" : pickup.id === "autopilot" ? "A" : pickup.id === "immortal" ? "I" : pickup.id === "cash-boost" ? "x2" : pickup.id === "gold-jackpot" ? "G" : "$";
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function update(dt) {
  if (state.duo?.active) {
    updateDuo(dt);
    return;
  }
  if (state.mode !== "playing") return;
  syncLaneCountForMode();
  const d = difficulty();
  const p = state.player;
  const hadAutopilot = p.autopilot > 0;
  const hadImmortal = p.immortal > 0;
  p.autopilot = Math.max(0, p.autopilot - dt);
  p.immortal = Math.max(0, p.immortal - dt);
  if ((hadAutopilot && p.autopilot <= 0) || (hadImmortal && p.immortal <= 0)) {
    p.recoveryShield = Math.max(p.recoveryShield || 0, 3);
    setMessage("Recovery shield active for 3 seconds.");
  }
  p.recoveryShield = Math.max(0, (p.recoveryShield || 0) - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  state.cashMultiplierTimer = Math.max(0, (state.cashMultiplierTimer || 0) - dt);
  if (state.cashMultiplierTimer <= 0) state.cashMultiplier = 1;
  if (p.autopilot > 0) {
    p.lane = findSafeLane();
    p.targetX = lanes[p.lane];
  }
  p.lane = Math.max(0, Math.min(lanes.length - 1, p.lane));
  p.targetX = lanes[p.lane];
  p.x += (p.targetX - p.x) * Math.min(1, d.handling * dt);
  p.speed = Math.min(d.topSpeed, p.speed + d.accel * dt);
  state.heat += dt / modes[state.selectedMode].heatRate;
  state.heat = Math.min(12, state.heat + dt * 0.115 * (ownsUpgrade("bolt-jammer") ? 0.72 : 1));
  state.score += p.speed * dt * 0.55;
  state.runDistance += p.speed * dt;
  state.roadOffset += (p.speed * dt) / 2;
  syncLaneCountForMode();
  state.crashHeat = Math.max(0, state.crashHeat - dt * 0.85);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (state.messageTimer <= 0) state.message = "";
  state.spawnTimer -= dt;
  state.pickupTimer -= dt;
  state.entities.forEach((entity) => {
    if (entity.road === undefined && typeof entity.lane === "number" && lanes[entity.lane] !== undefined) entity.x = lanes[entity.lane];
    entity.y += entity.speed * dt;
  });
  state.entities = state.entities.filter((entity) => entity.y < canvas.height + 180 && !entity.hit);
  if (state.spawnTimer <= 0) {
    spawnObstacleWave();
    state.spawnTimer = d.spawnEvery + 0.32 + Math.random() * 0.28;
  }
  if (state.pickupTimer <= 0) {
    spawnPickup();
    state.pickupTimer = d.pickupEvery + Math.random() * 1.25;
  }
  const playerBox = { x: p.x, y: p.y, width: 82, height: 122, lane: p.lane };
  for (const entity of state.entities) {
    if (entity.road === undefined && typeof entity.lane === "number" && lanes[entity.lane] !== undefined) entity.x = lanes[entity.lane];
    if (collide(playerBox, entity)) {
      if (entity.kind === "pickup") collectPickup(entity);
      else hitObstacle(entity);
    }
  }
  updateHud();
}

function draw() {
  if (state.duo?.active) {
    drawDuo();
    return;
  }
  state.roadCenterOverride = null;
  state.entities.forEach((entity) => {
    if (entity.road === undefined && typeof entity.lane === "number" && lanes[entity.lane] !== undefined) entity.x = lanes[entity.lane];
  });
  drawRoad();
  state.entities.forEach((entity) => entity.kind === "pickup" ? drawPickup(entity) : drawObstacle(entity));
  drawCar(state.player.x, state.player.y, carColor());
  drawScoreStrip();
  drawMessage();
}

state.buildVersion = "premium-rehan-gold-v13";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v14: direct run reset to avoid mode-start recursion. */
function resetRun(mode) {
  if (mode === "duoDash") {
    resetDuoIntro();
    return;
  }
  syncProfileFromInput();
  if (state.duo) state.duo.active = false;
  state.roadCenterOverride = null;
  const config = modes[mode] || modes.medium;
  const bonusLife = ownsUpgrade("reinforced-frame") ? 1 : 0;
  const launchBonus = ownsUpgrade("launch-tune") ? 18 : 0;
  state.mode = "playing";
  state.selectedMode = mode;
  state.maxLives = config.lives + bonusLife;
  state.lives = config.lives + bonusLife;
  state.heat = 1;
  state.cash = 0;
  state.cashBanked = false;
  state.score = 0;
  state.lastStandUsed = false;
  state.player.lane = 1;
  state.player.x = 0;
  state.player.speed = 90 + launchBonus;
  state.player.invulnerable = 0;
  state.player.immortal = 0;
  state.player.autopilot = 0;
  state.player.recoveryShield = 0;
  state.player.goldJackpot = false;
  state.cashMultiplier = 1;
  state.cashMultiplierTimer = 0;
  state.runDistance = 0;
  state.entities = [];
  state.spawnTimer = 0.75;
  state.pickupTimer = 1.8;
  state.crashHeat = 0;
  setLaneCount(3);
  state.player.lane = Math.floor(lanes.length / 2);
  state.player.x = lanes[state.player.lane];
  state.player.targetX = lanes[state.player.lane];
  setMessage("");
  ui.screen.classList.add("hidden");
  updateHud();
}

state.buildVersion = "premium-rehan-gold-v14";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}
/* v15: wider Lane Surge spacing and lane-aware collisions. */
function setLaneCount(count) {
  const safeCount = Math.max(3, Math.min(7, count));
  if (lanes.length === safeCount) return;
  const span = safeCount <= 3 ? 420 : Math.min(760, canvas.width - 160);
  const spacing = span / (safeCount - 1);
  lanes.length = 0;
  for (let i = 0; i < safeCount; i++) lanes.push((i - (safeCount - 1) / 2) * spacing);
  state.player.lane = Math.max(0, Math.min(safeCount - 1, state.player.lane));
  state.player.targetX = lanes[state.player.lane];
}

function collide(a, b) {
  if (typeof a?.lane === "number" && typeof b?.lane === "number" && a.lane !== b.lane) return false;
  const bx = entityLaneX(b);
  return Math.abs(a.x - bx) < (a.width + b.width) * 0.5 &&
    Math.abs(a.y - b.y) < (a.height + b.height) * 0.5;
}

state.buildVersion = "premium-rehan-gold-v15";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}
/* v16: Lane Surge compact obstacle visuals and strict same-lane obstacle hits. */
function isLaneSurgeActive() {
  return !!modes[state.selectedMode]?.laneGrowth;
}

function collide(a, b) {
  if (typeof a?.lane === "number" && typeof b?.lane === "number" && a.lane !== b.lane) return false;
  if (isLaneSurgeActive() && b?.kind === "obstacle") {
    return Math.abs(a.y - b.y) < (a.height + b.height) * 0.38;
  }
  const bx = entityLaneX(b);
  return Math.abs(a.x - bx) < (a.width + b.width) * 0.5 &&
    Math.abs(a.y - b.y) < (a.height + b.height) * 0.5;
}

function drawObstacle(o) {
  const laneX = o && o.road === undefined && typeof o.lane === "number" && lanes[o.lane] !== undefined ? lanes[o.lane] : o.x;
  o.x = laneX;
  const compact = isLaneSurgeActive() && o.road === undefined;
  ctx.save();
  ctx.translate(roadX(laneX), o.y);
  if (compact) ctx.scale(0.58, 0.82);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 14, o.width * 0.48, o.height * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  if (o.id === "cone") {
    ctx.fillStyle = "#ff8a34"; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(28, 30); ctx.lineTo(-28, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-22, 12, 44, 8);
  } else if (o.id === "barrier") {
    ctx.fillStyle = "#f24f5f"; roundedRect(-58, -23, 116, 46, 8); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-44, -7, 88, 12);
  } else if (o.id === "parked") {
    ctx.fillStyle = "#6cd0ff"; roundedRect(-50, -74, 100, 148, 15); ctx.fill();
    ctx.fillStyle = "#10202d"; roundedRect(-31, -44, 62, 36, 8); ctx.fill(); roundedRect(-29, 16, 58, 34, 8); ctx.fill();
    ctx.fillStyle = "#f7f7f2"; ctx.fillRect(-36, -76, 18, 8); ctx.fillRect(18, -76, 18, 8);
  } else if (o.id === "oil") {
    ctx.fillStyle = "#08090d"; ctx.beginPath(); ctx.ellipse(0, 0, 64, 32, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.ellipse(-18, -8, 22, 9, -0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = "#f7f7f2"; roundedRect(-72, -27, 144, 54, 8); ctx.fill();
    ctx.fillStyle = "#ff4f64"; for (let x = -58; x < 60; x += 36) ctx.fillRect(x, -24, 18, 48);
  }
  ctx.restore();
}

state.buildVersion = "premium-rehan-gold-v16";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v17: Lane Surge uses three equal wide lanes with compact car and obstacles. */
function currentLaneCount() {
  return 3;
}

function setLaneCount(count) {
  const safeCount = 3;
  const span = 540;
  const spacing = span / (safeCount - 1);
  lanes.length = 0;
  for (let i = 0; i < safeCount; i++) lanes.push((i - 1) * spacing);
  state.player.lane = Math.max(0, Math.min(safeCount - 1, state.player.lane));
  state.player.targetX = lanes[state.player.lane];
}

const drawCarBeforeV17 = drawCar;
function drawCompactLaneCar(x, y, body) {
  const jackpot = state.player.goldJackpot || body === "gold";
  ctx.save();
  ctx.translate(roadX(x), y);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath(); ctx.ellipse(0, 27, 40, 17, 0, 0, Math.PI * 2); ctx.fill();
  const paint = ctx.createLinearGradient(-32, -56, 32, 56);
  if (jackpot) {
    paint.addColorStop(0, "#fff8bf"); paint.addColorStop(0.45, "#ffd447"); paint.addColorStop(1, "#9b6a00");
  } else {
    paint.addColorStop(0, "#ffffff"); paint.addColorStop(0.12, body); paint.addColorStop(1, "#14202b");
  }
  ctx.fillStyle = paint;
  roundedRect(-30, -56, 60, 112, 13); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.36)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#06121c";
  roundedRect(-21, -37, 42, 28, 8); ctx.fill();
  roundedRect(-20, 12, 40, 27, 8); ctx.fill();
  ctx.fillStyle = "#ffe58b"; ctx.fillRect(-23, -60, 14, 7); ctx.fillRect(9, -60, 14, 7);
  ctx.fillStyle = "#ff5d58"; ctx.fillRect(-23, 53, 14, 6); ctx.fillRect(9, 53, 14, 6);
  ctx.fillStyle = "#05080c";
  roundedRect(-39, -42, 13, 20, 5); ctx.fill(); roundedRect(26, -42, 13, 20, 5); ctx.fill();
  roundedRect(-39, 27, 13, 20, 5); ctx.fill(); roundedRect(26, 27, 13, 20, 5); ctx.fill();
  ctx.restore();
}

function drawCar(x, y, body, trim = "#111318") {
  if (isLaneSurgeActive() && !state.duo?.active) {
    drawCompactLaneCar(x, y, body);
    return;
  }
  drawCarBeforeV17(x, y, body, trim);
}

function drawObstacle(o) {
  const laneX = o && o.road === undefined && typeof o.lane === "number" && lanes[o.lane] !== undefined ? lanes[o.lane] : o.x;
  o.x = laneX;
  const compact = isLaneSurgeActive() && o.road === undefined;
  ctx.save();
  ctx.translate(roadX(laneX), o.y);
  if (compact) ctx.scale(0.46, 0.72);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 14, o.width * 0.48, o.height * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  if (o.id === "cone") {
    ctx.fillStyle = "#ff8a34"; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(28, 30); ctx.lineTo(-28, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-22, 12, 44, 8);
  } else if (o.id === "barrier") {
    ctx.fillStyle = "#f24f5f"; roundedRect(-58, -23, 116, 46, 8); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-44, -7, 88, 12);
  } else if (o.id === "parked") {
    ctx.fillStyle = "#6cd0ff"; roundedRect(-50, -74, 100, 148, 15); ctx.fill();
    ctx.fillStyle = "#10202d"; roundedRect(-31, -44, 62, 36, 8); ctx.fill(); roundedRect(-29, 16, 58, 34, 8); ctx.fill();
    ctx.fillStyle = "#f7f7f2"; ctx.fillRect(-36, -76, 18, 8); ctx.fillRect(18, -76, 18, 8);
  } else if (o.id === "oil") {
    ctx.fillStyle = "#08090d"; ctx.beginPath(); ctx.ellipse(0, 0, 64, 32, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.ellipse(-18, -8, 22, 9, -0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = "#f7f7f2"; roundedRect(-72, -27, 144, 54, 8); ctx.fill();
    ctx.fillStyle = "#ff4f64"; for (let x = -58; x < 60; x += 36) ctx.fillRect(x, -24, 18, 48);
  }
  ctx.restore();
}

function collide(a, b) {
  if (typeof a?.lane === "number" && typeof b?.lane === "number" && a.lane !== b.lane) return false;
  if (isLaneSurgeActive() && b?.kind === "obstacle") {
    return Math.abs(a.y - b.y) < (a.height + b.height) * 0.34;
  }
  const bx = entityLaneX(b);
  return Math.abs(a.x - bx) < (a.width + b.width) * 0.5 &&
    Math.abs(a.y - b.y) < (a.height + b.height) * 0.5;
}

const menuHtmlBeforeV17 = menuHtml;
function menuHtml() {
  return menuHtmlBeforeV17()
    .replace('Lane Surge <small>New lanes every 1000 m</small>', 'Lane Surge <small>3 wide equal lanes</small>');
}

state.buildVersion = "premium-rehan-gold-v17";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v18: direct menu and car renderers, no wrappers. */
function menuHtml() {
  const profile = getProfile(state.username || "Driver");
  const ownedPfps = pfps.filter((item) => profile.ownedPfps.includes(item.id));
  const boardHtml = ["easy", "medium", "hard", "laneSurge", "duoDash"].map(leaderboardCardHtml).join("");
  return `
    <section class="hero-menu cinematic-menu">
      <div class="hero-copy">
        <p class="eyebrow">Endless arcade driving</p>
        <h1 class="animated-title">Bolt Heist</h1>
        <p class="subtitle">Dodge traffic, grab road cash, unlock wild cosmetics, and survive the wildest getaway modes.</p>
      </div>
      <div class="profile-badge premium-profile">
        ${pfpHtml(profile.equippedPfp, "large")}
        <span>${profile.name}</span>
        <strong>$${profile.wallet}</strong>
      </div>
      <div class="menu-road-art" aria-hidden="true"><span></span><span></span><span></span></div>
    </section>
    <label class="name-field premium-name">
      <span>Driver name</span>
      <input id="driverName" maxlength="16" placeholder="Your name" value="${state.username}">
    </label>
    <div class="pfp-picker emoji-picker">${ownedPfps.map((item) => `<button data-equip-pfp="${item.id}" type="button" class="pfp-choice ${profile.equippedPfp === item.id ? "selected" : ""}">${pfpHtml(item.id)}<span>${item.name}</span></button>`).join("")}</div>
    ${profileKey(profile.name) === "rehan" ? `<p class="rehan-banner">Rehan mode unlocked: every skin, pfp, and upgrade is yours.</p>` : ""}
    <h2>Choose Mode</h2>
    <div class="mode-grid premium-modes five-modes">
      <button data-start="easy" type="button">Easy <small>5 lives</small></button>
      <button data-start="medium" type="button">Medium <small>3 lives</small></button>
      <button data-start="hard" type="button">Hard <small>1 life</small></button>
      <button data-start="laneSurge" type="button">Lane Surge <small>3 wide equal lanes</small></button>
      <button data-start="duoDash" type="button">Split Heist <small>Left WASD, right arrow keys</small></button>
    </div>
    <div class="menu-actions big-actions">
      <button data-view="shop" type="button">Shop</button>
      <button data-view="info" type="button">Information</button>
    </div>
    <h2>Leaderboards</h2>
    <div class="leaderboards aesthetic-leaderboards five-boards">${boardHtml}</div>
  `;
}

function drawCar(x, y, body, trim = "#111318") {
  const compact = isLaneSurgeActive() && !state.duo?.active;
  const scale = compact ? 0.72 : 1;
  const jackpot = state.player.goldJackpot || body === "gold";
  ctx.save();
  ctx.translate(roadX(x), y);
  ctx.scale(scale, scale);
  const speedFactor = Math.min(1, (state.player?.speed || 90) / 128);
  const wheelSpin = state.roadOffset * 0.18 + performance.now() * 0.008 * speedFactor;
  const bob = Math.sin(performance.now() * 0.018) * 2.2 * speedFactor;
  ctx.translate(0, bob);
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath(); ctx.ellipse(0, 30, 56, 23, 0, 0, Math.PI * 2); ctx.fill();
  function wheel(wx, wy) {
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(wheelSpin); ctx.fillStyle = "#05080c"; roundedRect(-9, -15, 18, 30, 5); ctx.fill(); ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke(); ctx.restore();
  }
  wheel(-43, -47); wheel(43, -47); wheel(-43, 43); wheel(43, 43);
  const paint = ctx.createLinearGradient(-42, -70, 42, 70);
  if (jackpot) { paint.addColorStop(0, "#fff8bf"); paint.addColorStop(0.45, "#ffd447"); paint.addColorStop(1, "#9b6a00"); }
  else { paint.addColorStop(0, "#ffffff"); paint.addColorStop(0.1, body); paint.addColorStop(0.78, body); paint.addColorStop(1, "#14202b"); }
  ctx.fillStyle = paint; roundedRect(-38, -68, 76, 136, 16); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.36)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = jackpot ? "rgba(50,30,0,0.72)" : "rgba(7,17,26,0.82)";
  roundedRect(-27, -47, 54, 36, 10); ctx.fill(); roundedRect(-25, 15, 50, 34, 10); ctx.fill();
  ctx.fillStyle = jackpot ? "#fff8bf" : "#ffe58b"; ctx.fillRect(-29, -72, 16, 8); ctx.fillRect(13, -72, 16, 8);
  ctx.fillStyle = jackpot ? "#ffef8a" : "#ff5d58"; ctx.fillRect(-29, 65, 16, 7); ctx.fillRect(13, 65, 16, 7);
  ctx.restore();
}

state.buildVersion = "premium-rehan-gold-v18";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}

/* v19: extra-compact Lane Surge car, obstacles, and hitboxes. */
function laneModeCompactScale() {
  return isLaneSurgeActive() && !state.duo?.active;
}

function collide(a, b) {
  if (typeof a?.lane === "number" && typeof b?.lane === "number" && a.lane !== b.lane) return false;
  const bx = entityLaneX(b);
  const playerWidth = laneModeCompactScale() ? 28 : Math.min(a.width || 82, 58);
  const playerHeight = laneModeCompactScale() ? 74 : Math.min(a.height || 122, 96);
  const objectWidth = laneModeCompactScale() ? 28 : Math.min(b.width || 80, b.kind === "obstacle" ? 54 : 62);
  const objectHeight = laneModeCompactScale() ? Math.min(b.height || 70, 58) : Math.min(b.height || 90, 82);
  return Math.abs(a.x - bx) < (playerWidth + objectWidth) * 0.5 &&
    Math.abs(a.y - b.y) < (playerHeight + objectHeight) * 0.5;
}

function drawCar(x, y, body, trim = "#111318") {
  const scale = laneModeCompactScale() ? 0.52 : 0.86;
  const jackpot = state.player.goldJackpot || body === "gold";
  ctx.save();
  ctx.translate(roadX(x), y);
  ctx.scale(scale, scale);
  const speedFactor = Math.min(1, (state.player?.speed || 90) / 128);
  const wheelSpin = state.roadOffset * 0.18 + performance.now() * 0.008 * speedFactor;
  const bob = Math.sin(performance.now() * 0.018) * 2.2 * speedFactor;
  ctx.translate(0, bob);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath(); ctx.ellipse(0, 30, 50, 20, 0, 0, Math.PI * 2); ctx.fill();
  function wheel(wx, wy) {
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(wheelSpin); ctx.fillStyle = "#05080c"; roundedRect(-8, -14, 16, 28, 5); ctx.fill(); ctx.strokeStyle = "#7b8494"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke(); ctx.restore();
  }
  wheel(-39, -45); wheel(39, -45); wheel(-39, 41); wheel(39, 41);
  const paint = ctx.createLinearGradient(-36, -66, 36, 66);
  if (jackpot) { paint.addColorStop(0, "#fff8bf"); paint.addColorStop(0.45, "#ffd447"); paint.addColorStop(1, "#9b6a00"); }
  else { paint.addColorStop(0, "#ffffff"); paint.addColorStop(0.12, body); paint.addColorStop(0.8, body); paint.addColorStop(1, "#14202b"); }
  ctx.fillStyle = paint; roundedRect(-33, -64, 66, 128, 15); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.36)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = jackpot ? "rgba(50,30,0,0.72)" : "rgba(7,17,26,0.82)";
  roundedRect(-23, -43, 46, 32, 9); ctx.fill(); roundedRect(-22, 14, 44, 31, 9); ctx.fill();
  ctx.fillStyle = jackpot ? "#fff8bf" : "#ffe58b"; ctx.fillRect(-25, -68, 14, 7); ctx.fillRect(11, -68, 14, 7);
  ctx.fillStyle = jackpot ? "#ffef8a" : "#ff5d58"; ctx.fillRect(-25, 61, 14, 6); ctx.fillRect(11, 61, 14, 6);
  ctx.restore();
}

function drawObstacle(o) {
  const laneX = o && o.road === undefined && typeof o.lane === "number" && lanes[o.lane] !== undefined ? lanes[o.lane] : o.x;
  o.x = laneX;
  const compact = laneModeCompactScale() && o.road === undefined;
  ctx.save();
  ctx.translate(roadX(laneX), o.y);
  ctx.scale(compact ? 0.34 : 0.68, compact ? 0.58 : 0.78);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 14, o.width * 0.48, o.height * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  if (o.id === "cone") {
    ctx.fillStyle = "#ff8a34"; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(28, 30); ctx.lineTo(-28, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-22, 12, 44, 8);
  } else if (o.id === "barrier") {
    ctx.fillStyle = "#f24f5f"; roundedRect(-58, -23, 116, 46, 8); ctx.fill();
    ctx.fillStyle = "#fff5d0"; ctx.fillRect(-44, -7, 88, 12);
  } else if (o.id === "parked") {
    ctx.fillStyle = "#6cd0ff"; roundedRect(-50, -74, 100, 148, 15); ctx.fill();
    ctx.fillStyle = "#10202d"; roundedRect(-31, -44, 62, 36, 8); ctx.fill(); roundedRect(-29, 16, 58, 34, 8); ctx.fill();
    ctx.fillStyle = "#f7f7f2"; ctx.fillRect(-36, -76, 18, 8); ctx.fillRect(18, -76, 18, 8);
  } else if (o.id === "oil") {
    ctx.fillStyle = "#08090d"; ctx.beginPath(); ctx.ellipse(0, 0, 64, 32, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.ellipse(-18, -8, 22, 9, -0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = "#f7f7f2"; roundedRect(-72, -27, 144, 54, 8); ctx.fill();
    ctx.fillStyle = "#ff4f64"; for (let x = -58; x < 60; x += 36) ctx.fillRect(x, -24, 18, 48);
  }
  ctx.restore();
}

state.buildVersion = "premium-rehan-gold-v19";
if (["menu", "info", "shop"].includes(state.mode)) {
  showMenu();
  updateHud();
}
