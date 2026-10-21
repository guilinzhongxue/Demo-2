import { WORLD, aabb } from "./level.js";

const GRAVITY = 1650;
const MAX_FALL = 980;
const RUN_ACCEL = 2400;
const RUN_DECEL = 2800;
const MAX_RUN = 300;
const JUMP_VEL = -560;
const COYOTE = 0.09;
const JUMP_BUFFER = 0.12;
const WIDTH = 38;
const HEIGHT = 34;
const COLLIDE_EPS = 0.01;

export function createPlayer(x, y) {
  return {
    x,
    y,
    w: WIDTH,
    h: HEIGHT,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    padLock: false,
    anim: "idle",
    frame: 0,
    time: 0,
  };
}

export function resetPlayer(player, x, y) {
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.coyote = 0;
  player.jumpBuffer = 0;
  player.padLock = false;
  player.anim = "idle";
}

export function updatePlayer(player, input, platforms, bouncePads, dt) {
  const left = input.left;
  const right = input.right;
  if (input.jumpPressed) player.jumpBuffer = JUMP_BUFFER;
  else player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  if (left === right) {
    const sign = Math.sign(player.vx);
    const mag = Math.max(0, Math.abs(player.vx) - RUN_DECEL * dt);
    player.vx = mag * sign;
  } else {
    const dir = right ? 1 : -1;
    player.facing = dir;
    player.vx += dir * RUN_ACCEL * dt;
    player.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, player.vx));
  }

  player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
  player.coyote = player.grounded ? COYOTE : Math.max(0, player.coyote - dt);

  let jumped = false;
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = JUMP_VEL;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    jumped = true;
  }

  // ——— 水平方向 ———
  // 先移动，再按“移动前位于平台的哪一侧”把玩家推出去。
  // 旧实现按 vx 的正负决定推到哪边，一旦玩家已经嵌在平台里
  // （被光球弹起、复活点贴墙、掉帧穿越）就会被推到另一侧，表现为瞬移 / 莫名坠坑。
  const prevX = player.x;
  player.x += player.vx * dt;
  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }
  if (player.x + player.w > WORLD.width) {
    player.x = WORLD.width - player.w;
    player.vx = 0;
  }
  for (const p of platforms) {
    if (!aabb(player, p)) continue;
    if (prevX + player.w <= p.x + COLLIDE_EPS) {
      player.x = p.x - player.w;
    } else if (prevX >= p.x + p.w - COLLIDE_EPS) {
      player.x = p.x + p.w;
    } else {
      // 移动前就已经和平台在水平方向重叠（被复位/弹射击穿），
      // 不要横向硬推 —— 那会把角色推下旁边的深坑。交给垂直解算和兜底处理。
      player.vx = 0;
      continue;
    }
    player.vx = 0;
  }

  // ——— 垂直方向 ———
  // 用“移动前的底边 / 顶边”判断是落到平台顶面还是从下面撞头，
  // 不再依赖会被前面解算改写的 player.vy，也不再留 8px 的“陷进地面”余量。
  const prevY = player.y;
  const moveY = player.vy * dt;
  player.y += moveY;
  player.grounded = false;
  for (const p of platforms) {
    if (!aabb(player, p)) continue;
    if (moveY >= 0 && prevY + player.h <= p.y + COLLIDE_EPS) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.grounded = true;
    } else if (moveY < 0 && prevY >= p.y + p.h - COLLIDE_EPS) {
      player.y = p.y + p.h;
      player.vy = 0;
    }
  }

  // 兜底：极端情况下（复位、垫子弹射、帧率抖动）仍与平台重叠时，
  // 沿穿透最浅的方向推出去，保证玩家永远不会卡在实体里掉穿地图。
  for (const p of platforms) {
    if (!aabb(player, p)) continue;
    const outUp = player.y + player.h - p.y;
    const outDown = p.y + p.h - player.y;
    if (outUp <= outDown) {
      player.y = p.y - player.h;
      player.vy = Math.min(player.vy, 0);
      player.grounded = true;
    } else {
      player.y = p.y + p.h;
      player.vy = Math.max(player.vy, 0);
    }
  }

  let bounced = false;
  if (player.vy > 40) {
    for (const pad of bouncePads) {
      // 一次腾空只允许被光球弹一次。否则掉进坑里又松手时，
      // 小鹿会在光球上方无限弹跳，既不落地也不判死（软锁）。
      if (player.padLock) break;
      const cx = player.x + player.w / 2;
      const feet = player.y + player.h;
      const dx = cx - pad.x;
      const dy = feet - pad.y;
      if (dx * dx + dy * dy < pad.r * pad.r) {
        player.vy = JUMP_VEL * 1.12;
        // 脚落在光球表面；旧实现会陷进球体 8px
        player.y = pad.y - pad.r - player.h - 1;
        player.grounded = false;
        player.padLock = true;
        bounced = true;
        break;
      }
    }
  }

  // 落地后解除“本段腾空已用过光球”的限制
  if (player.grounded) player.padLock = false;

  player.time += dt;
  if (!player.grounded) player.anim = player.vy < 0 ? "jump" : "fall";
  else if (Math.abs(player.vx) > 18) player.anim = "run";
  else player.anim = "idle";
  const fps = player.anim === "run" ? 10 : 6;
  player.frame += dt * fps;
  return { jumped, bounced };
}

export function drawFox(ctx, player) {
  const { x, y, w, h, facing, anim, frame, time } = player;
  ctx.save();
  ctx.translate(x + w / 2, y + h);
  ctx.scale(facing, 1);

  const bob = anim === "idle" ? Math.sin(time * 6) * 1.2 : 0;
  const stride = anim === "run" ? Math.sin(frame * 1.8) : 0;
  const jumpTuck = anim === "jump" ? -3 : anim === "fall" ? 2 : 0;

  ctx.fillStyle = "rgba(8, 6, 12, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -h / 2 + bob + jumpTuck);

  const hind = stride * 5;
  const fore = -stride * 5;
  ctx.strokeStyle = "#c45a28";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-10, 10);
  ctx.lineTo(-12, 16 + (anim === "run" ? hind : 0));
  ctx.moveTo(-4, 10);
  ctx.lineTo(-3, 16 + (anim === "run" ? -hind * 0.6 : 0));
  ctx.moveTo(6, 10);
  ctx.lineTo(8, 16 + (anim === "run" ? fore : 0));
  ctx.moveTo(11, 8);
  ctx.lineTo(13, 15 + (anim === "run" ? -fore * 0.5 : 0));
  ctx.stroke();

  ctx.fillStyle = "#e37a3a";
  roundRect(ctx, -16, -12, 30, 22, 9);
  ctx.fill();
  ctx.fillStyle = "#f4c49a";
  roundRect(ctx, -6, -4, 16, 12, 6);
  ctx.fill();

  ctx.fillStyle = "#d4652d";
  ctx.beginPath();
  ctx.moveTo(-16, -2);
  ctx.quadraticCurveTo(-28, -6 + Math.sin(time * 10) * 2, -22, 8);
  ctx.quadraticCurveTo(-16, 8, -14, 2);
  ctx.fill();

  ctx.fillStyle = "#e37a3a";
  ctx.beginPath();
  ctx.moveTo(8, -12);
  ctx.lineTo(16, -22);
  ctx.lineTo(18, -10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -11);
  ctx.lineTo(20, -20);
  ctx.lineTo(22, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f7d7b5";
  ctx.beginPath();
  ctx.moveTo(11, -12);
  ctx.lineTo(15, -18);
  ctx.lineTo(16, -10);
  ctx.fill();

  ctx.fillStyle = "#f0d0ae";
  ctx.beginPath();
  ctx.ellipse(14, -4, 8, 7, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1424";
  ctx.beginPath();
  ctx.arc(17, -5, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(17.6, -5.6, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c45a28";
  ctx.beginPath();
  ctx.moveTo(22, -3);
  ctx.lineTo(26, -1);
  ctx.lineTo(22, 0);
  ctx.fill();

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
