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

showMenu();
updateHud();
requestAnimationFrame(loop);
