const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  screen: document.getElementById("screen"),
  screenText: document.getElementById("screenText"),
  upgradePanel: document.getElementById("upgradePanel"),
  primaryButton: document.getElementById("primaryButton"),
  secondaryButton: document.getElementById("secondaryButton"),
  levelText: document.getElementById("levelText"),
  speedText: document.getElementById("speedText"),
  cashText: document.getElementById("cashText"),
  progressText: document.getElementById("progressText"),
  gapText: document.getElementById("gapText"),
  gapFill: document.getElementById("gapFill"),
  speedUpgrade: document.getElementById("speedUpgrade"),
  handlingUpgrade: document.getElementById("handlingUpgrade"),
  boostUpgrade: document.getElementById("boostUpgrade"),
};

const lanes = [-210, 0, 210];
const obstacleTypes = [
  { id: "cone", label: "traffic cones", color: "#ff8a34", width: 46, height: 54, penalty: 15 },
  { id: "barrier", label: "barrier", color: "#f24f5f", width: 116, height: 46, penalty: 24 },
  { id: "parked", label: "parked car", color: "#6cd0ff", width: 112, height: 150, penalty: 30 },
  { id: "oil", label: "oil spill", color: "#0d0e12", width: 126, height: 68, penalty: 18 },
  { id: "roadblock", label: "roadblock", color: "#f7f7f2", width: 150, height: 54, penalty: 34 },
];

const state = {
  mode: "start",
  level: 1,
  cash: 0,
  upgrades: { speed: 0, handling: 0, boost: 0 },
  player: {
    lane: 1,
    x: 0,
    y: 500,
    targetX: 0,
    speed: 88,
    boostEnergy: 100,
    invulnerable: 0,
  },
  roadOffset: 0,
  distance: 90,
  progress: 0,
  obstacles: [],
  spawnTimer: 0,
  crashHeat: 0,
  lastTime: 0,
  message: "",
};

function difficulty() {
  const level = state.level;
  return {
    goal: 1450 + level * 260,
    topSpeed: 118 + state.upgrades.speed * 14,
    accel: 21 + state.upgrades.speed * 2,
    handling: 9 + state.upgrades.handling * 2.2,
    boostPower: 38 + state.upgrades.boost * 9,
    boltBase: 79 + level * 4.8,
    spawnEvery: Math.max(0.48, 1.18 - level * 0.075),
    reward: 260 + level * 90,
    obstacleSpeed: 380 + level * 24,
  };
}

function resetLevel() {
  const d = difficulty();
  state.mode = "playing";
  state.player.lane = 1;
  state.player.x = 0;
  state.player.targetX = 0;
  state.player.speed = Math.min(92, d.topSpeed - 12);
  state.player.boostEnergy = 70;
  state.player.invulnerable = 0;
  state.distance = 90;
  state.progress = 0;
  state.obstacles = [];
  state.spawnTimer = 0.5;
  state.crashHeat = 0;
  state.message = "";
  ui.screen.classList.add("hidden");
}

function showStart() {
  state.mode = "start";
  ui.screen.classList.remove("hidden");
  ui.upgradePanel.hidden = true;
  ui.primaryButton.hidden = false;
  ui.primaryButton.textContent = "Start Heist";
  ui.secondaryButton.hidden = true;
  ui.screenText.textContent = "You stole the wrong car. Switch lanes, keep your speed up, and reach the highway checkpoint before Usain Bolt catches you.";
}

function showWin() {
  const d = difficulty();
  state.mode = "upgrade";
  state.cash += d.reward;
  state.level += 1;
  state.progress = difficulty().goal;
  ui.screen.classList.remove("hidden");
  ui.upgradePanel.hidden = false;
  ui.primaryButton.hidden = false;
  ui.primaryButton.textContent = "Next Level";
  ui.secondaryButton.hidden = true;
  ui.screenText.textContent = `Checkpoint reached. You earned $${d.reward}. Upgrade the car, then take on level ${state.level}.`;
  renderUpgradeButtons();
}

function showLose(reason) {
  state.mode = "gameover";
  ui.screen.classList.remove("hidden");
  ui.upgradePanel.hidden = true;
  ui.primaryButton.hidden = true;
  ui.secondaryButton.hidden = false;
  ui.screenText.textContent = reason;
}

function upgradeCost(kind) {
  return 180 + state.upgrades[kind] * 170;
}

function buyUpgrade(kind) {
  const cost = upgradeCost(kind);
  if (state.cash < cost) return;
  state.cash -= cost;
  state.upgrades[kind] += 1;
  renderUpgradeButtons();
  updateHud();
}

function renderUpgradeButtons() {
  const labels = {
    speed: ["Top Speed", "Raises cruising speed and acceleration"],
    handling: ["Handling", "Snappier lane switching"],
    boost: ["Boost", "Stronger temporary speed burst"],
  };

  [
    ["speed", ui.speedUpgrade],
    ["handling", ui.handlingUpgrade],
    ["boost", ui.boostUpgrade],
  ].forEach(([kind, button]) => {
    const cost = upgradeCost(kind);
    button.textContent = `${labels[kind][0]} Lv ${state.upgrades[kind]} - $${cost} - ${labels[kind][1]}`;
    button.disabled = state.cash < cost;
  });
}

function switchLane(dir) {
  if (state.mode !== "playing") return;
  state.player.lane = Math.max(0, Math.min(2, state.player.lane + dir));
  state.player.targetX = lanes[state.player.lane];
}

function useBoost() {
  if (state.mode !== "playing" || state.player.boostEnergy < 28) return;
  const d = difficulty();
  state.player.speed = Math.min(d.topSpeed + d.boostPower, state.player.speed + d.boostPower);
  state.player.boostEnergy -= 28;
}

function spawnObstacle() {
  const d = difficulty();
  const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
  let lane = Math.floor(Math.random() * 3);
  const recent = state.obstacles.slice(-2);
  if (recent.length && recent.every((o) => o.lane === lane)) {
    lane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
  }

  state.obstacles.push({
    ...type,
    lane,
    x: lanes[lane],
    y: -120,
    speed: d.obstacleSpeed + Math.random() * 90,
    hit: false,
  });
}

function collide(a, b) {
  return Math.abs(a.x - b.x) < (a.width + b.width) * 0.5 &&
    Math.abs(a.y - b.y) < (a.height + b.height) * 0.5;
}

function update(dt) {
  if (state.mode !== "playing") return;
  const d = difficulty();
  const p = state.player;

  p.x += (p.targetX - p.x) * Math.min(1, dt * d.handling);
  p.speed += d.accel * dt;
  p.speed = Math.min(d.topSpeed, p.speed);
  p.boostEnergy = Math.min(100, p.boostEnergy + (10 + state.upgrades.boost * 1.5) * dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  state.progress += p.speed * dt;
  state.roadOffset += (p.speed * 5.2) * dt;
  state.spawnTimer -= dt;
  state.crashHeat = Math.max(0, state.crashHeat - dt * 0.55);

  if (state.spawnTimer <= 0) {
    spawnObstacle();
    const jitter = 0.16 + Math.random() * 0.24;
    state.spawnTimer = Math.max(0.34, d.spawnEvery - Math.random() * 0.2 - state.level * 0.012 + jitter);
  }

  const carBox = { x: p.x, y: p.y, width: 86, height: 136 };
  state.obstacles.forEach((obstacle) => {
    obstacle.y += (obstacle.speed + p.speed * 2.1) * dt;
    if (!obstacle.hit && p.invulnerable <= 0 && collide(carBox, obstacle)) {
      obstacle.hit = true;
      p.invulnerable = 0.65;
      p.speed = Math.max(42, p.speed - obstacle.penalty);
      state.distance -= 8 + obstacle.penalty * 0.28;
      state.crashHeat += 1.35;
      state.message = `Hit ${obstacle.label}. Bolt is gaining.`;
    }
  });
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.y < canvas.height + 180);

  const cleanDriving = p.speed / d.topSpeed;
  const boltSpeed = d.boltBase + state.crashHeat * 9 + (cleanDriving < 0.74 ? 9 : -4);
  const playerEscape = p.speed * 0.78;
  state.distance += (playerEscape - boltSpeed) * dt * 0.24;
  state.distance = Math.max(0, Math.min(145, state.distance));

  if (state.distance <= 0) {
    showLose("Caught. Bolt closed the gap before you reached the highway. Retry the level and keep the car moving.");
  } else if (state.progress >= d.goal) {
    showWin();
  }

  updateHud();
}

function roadX(x) {
  return canvas.width / 2 + x;
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

  ctx.fillStyle = "rgba(84, 224, 139, 0.18)";
  const markerY = canvas.height - ((state.progress / difficulty().goal) * canvas.height * 0.85 + 80);
  if (markerY > -60 && markerY < canvas.height + 60) {
    ctx.fillRect(roadLeft, markerY, roadWidth, 16);
  }
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawCar(x, y, body, trim = "#111318") {
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
  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();
  ctx.translate(roadX(o.x), o.y);
  ctx.globalAlpha = o.hit ? 0.42 : 1;
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

function drawBolt() {
  const y = canvas.height - 54 + (1 - state.distance / 145) * 44;
  const x = canvas.width / 2 + 330;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffd447";
  ctx.beginPath();
  ctx.arc(0, -30, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffd447";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(-6, 18);
  ctx.moveTo(-2, 0);
  ctx.lineTo(25, -8);
  ctx.moveTo(-5, 16);
  ctx.lineTo(-26, 38);
  ctx.moveTo(-4, 18);
  ctx.lineTo(20, 39);
  ctx.stroke();
  ctx.fillStyle = "#101217";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("BOLT", -18, -52);
  ctx.restore();
}

function drawBoostBar() {
  const w = 160;
  const h = 12;
  const x = canvas.width - w - 22;
  const y = canvas.height - 30;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  roundedRect(x, y, w, h, 8);
  ctx.fillStyle = "#37d5ff";
  roundedRect(x, y, w * (state.player.boostEnergy / 100), h, 8);
  ctx.fillStyle = "#f7f7f2";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("BOOST", x, y - 8);
}

function drawMessage() {
  if (!state.message || state.mode !== "playing") return;
  ctx.fillStyle = "rgba(16,18,23,0.72)";
  roundedRect(canvas.width / 2 - 185, 86, 370, 34, 8);
  ctx.fillStyle = "#f7f7f2";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(state.message, canvas.width / 2, 109);
  ctx.textAlign = "left";
}

function draw() {
  drawRoad();
  state.obstacles.forEach(drawObstacle);
  drawBolt();
  drawCar(state.player.x, state.player.y, state.player.invulnerable > 0 ? "#ff4f64" : "#54e08b");
  drawBoostBar();
  drawMessage();
}

function updateHud() {
  const d = difficulty();
  ui.levelText.textContent = String(state.level);
  ui.speedText.textContent = `${Math.round(state.player.speed)} mph`;
  ui.cashText.textContent = `$${state.cash}`;
  ui.progressText.textContent = `${Math.min(100, Math.round((state.progress / d.goal) * 100))}%`;
  ui.gapText.textContent = `${Math.round(state.distance)} m`;
  ui.gapFill.style.width = `${Math.max(0, Math.min(100, (state.distance / 145) * 100))}%`;
}

function loop(time) {
  const dt = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") switchLane(-1);
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") switchLane(1);
  if (event.code === "Space") {
    event.preventDefault();
    useBoost();
  }
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  switchLane(x < rect.width / 2 ? -1 : 1);
});

ui.primaryButton.addEventListener("click", resetLevel);
ui.secondaryButton.addEventListener("click", resetLevel);
ui.speedUpgrade.addEventListener("click", () => buyUpgrade("speed"));
ui.handlingUpgrade.addEventListener("click", () => buyUpgrade("handling"));
ui.boostUpgrade.addEventListener("click", () => buyUpgrade("boost"));

showStart();
updateHud();
requestAnimationFrame(loop);
/* Polished Bolt Chase visual/behavior overrides */
function difficulty() {
  const level = state.level;
  return {
    goal: 1450 + level * 260,
    topSpeed: 118 + state.upgrades.speed * 14,
    accel: 21 + state.upgrades.speed * 2,
    handling: 9 + state.upgrades.handling * 2.2,
    boltBase: 79 + level * 4.8,
    spawnEvery: Math.max(0.48, 1.18 - level * 0.075),
    reward: 260 + level * 90,
    obstacleSpeed: 380 + level * 24,
  };
}

function showStart() {
  state.mode = "start";
  ui.screen.classList.remove("hidden");
  ui.upgradePanel.hidden = true;
  ui.primaryButton.hidden = false;
  ui.primaryButton.textContent = "Start Chase";
  ui.secondaryButton.hidden = true;
  ui.screenText.textContent = "Survive the city escape. Switch lanes, dodge hazards, keep your speed up, and reach each checkpoint before the chase pressure catches you.";
}

function renderUpgradeButtons() {
  const prices = { speed: 160 + state.upgrades.speed * 120, handling: 140 + state.upgrades.handling * 110 };
  const labels = { speed: ["Launch Tune", "Higher top speed"], handling: ["Street Grip", "Sharper lane switching"] };
  [["speed", ui.speedUpgrade], ["handling", ui.handlingUpgrade]].forEach(([key, button]) => {
    const [name, desc] = labels[key];
    button.hidden = false;
    button.innerHTML = `<strong>${name}</strong><br>${desc}<br>$${prices[key]}`;
    button.disabled = state.cash < prices[key];
  });
  ui.boostUpgrade.hidden = true;
}

function buyUpgrade(type) {
  if (type === "boost") return;
  const price = type === "speed" ? 160 + state.upgrades.speed * 120 : 140 + state.upgrades.handling * 110;
  if (state.cash < price) return;
  state.cash -= price;
  state.upgrades[type] += 1;
  renderUpgradeButtons();
  updateHud();
}

function useBoost() {}
function drawBoostBar() {}
function drawBolt() {}

function drawRoad() {
  const w = canvas.width;
  const h = canvas.height;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#122a47");
  sky.addColorStop(0.45, "#244761");
  sky.addColorStop(1, "#121820");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 7; i++) {
    const x = (i * 190 - state.roadOffset * 0.04) % (w + 220) - 100;
    ctx.beginPath();
    ctx.ellipse(x, 72 + (i % 3) * 42, 74, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 45, 78 + (i % 3) * 42, 48, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  drawMountains(245, "#cddbe0", "#536b76", 0.13);
  drawMountains(340, "#71877f", "#263b36", 0.24);

  const roadW = 590;
  const left = w / 2 - roadW / 2;
  const right = w / 2 + roadW / 2;
  const ground = ctx.createLinearGradient(0, h * 0.45, 0, h);
  ground.addColorStop(0, "#334939");
  ground.addColorStop(1, "#0f1b18");
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.44, w, h * 0.56);

  const road = ctx.createLinearGradient(0, 0, 0, h);
  road.addColorStop(0, "#3d4652");
  road.addColorStop(0.5, "#252d36");
  road.addColorStop(1, "#171d24");
  ctx.fillStyle = road;
  ctx.beginPath();
  ctx.moveTo(left + 70, 0);
  ctx.lineTo(right - 70, 0);
  ctx.lineTo(right + 72, h);
  ctx.lineTo(left - 72, h);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#ffffff";
  for (let i = 0; i < 48; i++) {
    const y = (i * 47 + state.roadOffset * 2.3) % (h + 80) - 80;
    ctx.beginPath();
    ctx.moveTo(left + 60 + (i * 73) % (roadW - 120), y);
    ctx.lineTo(left + 100 + (i * 73) % (roadW - 120), y + 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,225,145,0.92)";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(left + 70, 0); ctx.lineTo(left - 72, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(right - 70, 0); ctx.lineTo(right + 72, h); ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 5;
  ctx.setLineDash([30, 34]);
  ctx.lineDashOffset = state.roadOffset * 1.8;
  [-105, 105].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(w / 2 + x * 0.72, 0);
    ctx.lineTo(w / 2 + x, h);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function drawMountains(base, light, dark, speed) {
  const off = -(state.roadOffset * speed) % 150;
  ctx.beginPath();
  ctx.moveTo(-120, base + 120);
  for (let x = off - 160; x < canvas.width + 220; x += 150) {
    const peak = base - 96 - Math.abs(Math.sin(x * 0.018)) * 70;
    ctx.lineTo(x + 75, peak);
    ctx.lineTo(x + 160, base + 120);
  }
  ctx.lineTo(canvas.width + 160, canvas.height);
  ctx.lineTo(-120, canvas.height);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, base - 180, 0, canvas.height);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawCar(x, y, body, trim = "#111318") {
  const paint = state.player.invulnerable > 0 ? "#ff4f64" : body;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.beginPath();
  ctx.ellipse(0, 25, 57, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#05080c";
  roundedRect(-42, -30, 20, 14, 4); ctx.fill();
  roundedRect(22, -30, 20, 14, 4); ctx.fill();
  roundedRect(-42, 18, 20, 14, 4); ctx.fill();
  roundedRect(22, 18, 20, 14, 4); ctx.fill();
  const g = ctx.createLinearGradient(-52, -28, 52, 30);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.1, paint);
  g.addColorStop(0.78, paint);
  g.addColorStop(1, "#14202b");
  ctx.fillStyle = g;
  roundedRect(-54, -28, 108, 58, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(7,17,26,0.78)";
  roundedRect(-24, -18, 48, 34, 10); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.26)";
  ctx.fillRect(-17, -14, 18, 27);
  ctx.fillStyle = "#ffe58b";
  ctx.fillRect(-38, -32, 17, 8);
  ctx.fillRect(21, -32, 17, 8);
  ctx.fillStyle = "#ff5d58";
  ctx.fillRect(-38, 27, 17, 7);
  ctx.fillRect(21, 27, 17, 7);
  ctx.restore();
}

function drawObstacle(o) {
  const x = o.x;
  const y = o.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 14, o.width * 0.48, o.height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (o.id === "cone") {
    ctx.fillStyle = "#ff8a34";
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-24, 25); ctx.lineTo(24, 25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(-15, 6, 30, 7);
  } else if (o.id === "oil") {
    ctx.fillStyle = "#06080c";
    ctx.scale(1.3, 0.55);
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.beginPath(); ctx.arc(-10, -8, 12, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = o.color;
    roundedRect(-o.width / 2, -o.height / 2, o.width, o.height, 8); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.24)";
    ctx.fillRect(-o.width / 2 + 8, -o.height / 2 + 8, o.width - 16, 10);
  }
  ctx.restore();
}
