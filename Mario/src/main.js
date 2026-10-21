import {
  createLevel,
  firefliesCollected,
  lanternsLit,
  lastCheckpoint,
  updateFireflies,
  collectPickups,
  hitThorns,
  reachedShrine,
  VIEW,
  WORLD,
} from "./level.js";
import { createPlayer, drawFox, resetPlayer, updatePlayer } from "./player.js";
import { drawScene } from "./render.js";
import {
  unlockAudio,
  playJump,
  playBounce,
  playFirefly,
  playLantern,
  playHurt,
  playWin,
  toggleMute,
  isMuted,
} from "./audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const hud = document.getElementById("hud");
const startBtn = document.getElementById("start-btn");
const muteBtn = document.getElementById("mute-btn");
const fireflyCount = document.getElementById("firefly-count");
const fireflyTotal = document.getElementById("firefly-total");
const lanternCount = document.getElementById("lantern-count");
const lanternTotal = document.getElementById("lantern-total");

const keys = new Set();
const input = { left: false, right: false, jumpPressed: false };
let jumpQueued = false;
let mode = "title";
let level = createLevel();
let player = createPlayer(level.spawn.x, level.spawn.y);
const camera = { x: 0, y: 0 };
let last = performance.now();
let invuln = 0;

fireflyTotal.textContent = String(level.fireflies.length);
lanternTotal.textContent = String(level.lanterns.length);

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) {
    e.preventDefault();
  }
  if (e.repeat) {
    keys.add(e.key);
    return;
  }
  keys.add(e.key);
  if (e.key === " " || e.key === "Spacebar" || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    jumpQueued = true;
  }
  if (e.key === "m" || e.key === "M") {
    muteBtn.textContent = toggleMute() ? "Sound off" : "Sound on";
  }
  if (mode === "title" && (e.key === " " || e.key === "Enter")) startGame();
  if ((mode === "play" || mode === "win") && (e.key === "r" || e.key === "R")) startGame();
  if (mode === "win" && (e.key === " " || e.key === "Enter")) startGame();
});

window.addEventListener("keyup", (e) => keys.delete(e.key));
// 切走窗口时松开按键，否则回来时角色会一直朝一个方向跑
window.addEventListener("blur", () => keys.clear());
startBtn.addEventListener("click", startGame);
muteBtn.addEventListener("click", () => {
  muteBtn.textContent = toggleMute() ? "Sound off" : "Sound on";
});

function startGame() {
  unlockAudio();
  level = createLevel();
  player = createPlayer(level.spawn.x, level.spawn.y);
  camera.x = 0;
  camera.y = 0;
  invuln = 0;
  jumpQueued = false;
  keys.clear();
  mode = "play";
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  updateHud();
}

function showWin() {
  mode = "win";
  playWin();
  overlay.classList.remove("hidden");
  overlay.querySelector(".panel").innerHTML = `
    <p class="eyebrow">The woods remember you</p>
    <h1>Shrine awake</h1>
    <p class="lead">You lit ${lanternsLit(level)} lanterns and gathered ${firefliesCollected(level)} fireflies. The forest is warm again.</p>
    <button id="again-btn" type="button">Play again</button>
    <p class="hint">Press R or Space to walk once more</p>
  `;
  document.getElementById("again-btn").addEventListener("click", startGame);
}

function updateHud() {
  fireflyCount.textContent = String(firefliesCollected(level));
  lanternCount.textContent = String(lanternsLit(level));
}

function pollInput() {
  input.left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  input.right = keys.has("ArrowRight") || keys.has("d") || keys.has("D");
  input.jumpPressed = jumpQueued;
  jumpQueued = false;
}

function followCamera(dt) {
  const targetX = player.x + player.w / 2 - VIEW.w * 0.38;
  const maxX = WORLD.width - VIEW.w;
  const clamped = Math.max(0, Math.min(maxX, targetX));
  camera.x += (clamped - camera.x) * Math.min(1, dt * 7);
  camera.y = 0;
}

function respawn() {
  playHurt();
  const cp = lastCheckpoint(player, level);
  resetPlayer(player, cp.x, cp.y);
  invuln = 0.7;
}

function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  pollInput();
  updateFireflies(level, now / 1000);

  if (mode === "play") {
    invuln = Math.max(0, invuln - dt);
    const { jumped, bounced } = updatePlayer(
      player,
      input,
      level.platforms,
      level.bouncePads,
      dt
    );
    if (jumped) playJump();
    if (bounced) playBounce();

    const got = collectPickups(player, level);
    if (got.flies) {
      playFirefly();
      updateHud();
    }
    if (got.lamps) {
      playLantern();
      updateHud();
    }

    if (player.y > WORLD.deathY) respawn();
    else if (invuln <= 0 && hitThorns(player, level)) respawn();

    if (reachedShrine(player, level) && lanternsLit(level) >= level.lanterns.length) {
      showWin();
    }

    followCamera(dt);
  }

  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  drawScene(ctx, camera, level, player, now / 1000, (c, p) => {
    if (invuln > 0 && Math.floor(now / 80) % 2 === 0) return;
    drawFox(c, p);
  });

  if (mode === "play" && lanternsLit(level) < level.lanterns.length && player.x > WORLD.width - 420) {
    ctx.fillStyle = "rgba(27, 20, 36, 0.7)";
    ctx.fillRect(VIEW.w / 2 - 210, 24, 420, 36);
    ctx.fillStyle = "#f4e6c8";
    ctx.font = "16px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Light every lantern before the shrine will wake", VIEW.w / 2, 48);
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
muteBtn.textContent = isMuted() ? "Sound off" : "Sound on";
