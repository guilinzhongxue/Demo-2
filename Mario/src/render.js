import { VIEW, WORLD, GROUND_Y, lightRatio } from "./level.js";

const farTrees = seedTrees(42, 0.35, 180, 28);
const midTrees = seedTrees(91, 0.62, 240, 18);
const ferns = seedFerns(17);

function seedTrees(seed, parallax, height, count) {
  const trees = [];
  let s = seed;
  for (let i = 0; i < count; i += 1) {
    s = (s * 16807) % 2147483647;
    trees.push({
      x: (s % WORLD.width) * (1 / parallax) * 0.12 + i * 140,
      h: height + (s % 70),
      w: 18 + (s % 16),
      parallax,
    });
  }
  return trees;
}

function seedFerns(seed) {
  const items = [];
  let s = seed;
  for (let i = 0; i < 40; i += 1) {
    s = (s * 48271) % 2147483647;
    items.push({ x: (s % WORLD.width) + i * 20, h: 18 + (s % 16) });
  }
  return items;
}

export function createAmbient(count) {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * WORLD.width,
    y: 80 + Math.random() * 420,
    r: 1.2 + Math.random() * 1.8,
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + (i % 5) * 0.15,
  }));
}

export function drawScene(ctx, camera, level, player, time, drawHero) {
  const light = lightRatio(level);
  drawSky(ctx, light);
  drawMoon(ctx, camera);
  drawTreeLayer(ctx, camera, farTrees, "#1a2438", 0.35);
  drawHills(ctx, camera, 0.45, "#162033");
  drawTreeLayer(ctx, camera, midTrees, "#101827", 0.62);
  drawGroundFill(ctx, camera);
  drawChasms(ctx, camera, level.platforms);
  drawPlatforms(ctx, camera, level.platforms);
  drawThorns(ctx, camera, level.thorns, time);
  drawBouncePads(ctx, camera, level.bouncePads, time);
  drawLanterns(ctx, camera, level.lanterns, time);
  drawShrine(ctx, camera, level.shrine, light, time);
  drawFireflies(ctx, camera, level.fireflies, time);
  // 主角必须和场景共用同一套相机偏移。旧实现直接按世界坐标画狐狸，
  // 相机一旦右移，狐狸就会被画在实际位置右侧 camera.x 像素处 ——
  // 也就是“站在坑上不掉、站在地上却掉坑”的根源。
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawHero(ctx, player);
  ctx.restore();
  drawFerns(ctx, camera);
  drawAmbient(ctx, camera, time, light);
  drawVignette(ctx, light);
}

function wx(camera, x, parallax = 1) {
  return x - camera.x * parallax;
}

function drawSky(ctx, light) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  g.addColorStop(0, mix("#2a1b46", "#5a3a6a", light));
  g.addColorStop(0.45, mix("#3a2740", "#c46a3a", light * 0.7));
  g.addColorStop(1, mix("#1b2436", "#6a4a38", light));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

function drawMoon(ctx, camera) {
  const x = 980 - camera.x * 0.04;
  const y = 110;
  ctx.fillStyle = "rgba(255, 236, 190, 0.14)";
  ctx.beginPath();
  ctx.arc(x, y, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7e7c2";
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(ctx, camera, parallax, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 520);
  for (let x = 0; x <= VIEW.w + 40; x += 40) {
    const wx0 = camera.x * parallax + x;
    const y = 470 + Math.sin(wx0 * 0.004) * 28 + Math.sin(wx0 * 0.01) * 12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW.w, VIEW.h);
  ctx.lineTo(0, VIEW.h);
  ctx.fill();
}

function drawTreeLayer(ctx, camera, trees, color, parallax) {
  ctx.fillStyle = color;
  for (const t of trees) {
    const x = wx(camera, t.x, parallax);
    if (x < -80 || x > VIEW.w + 80) continue;
    const base = 540 - (1 - parallax) * 40;
    ctx.fillRect(x, base - t.h, t.w, t.h);
    ctx.beginPath();
    ctx.moveTo(x - t.w * 1.6, base - t.h + 20);
    ctx.lineTo(x + t.w / 2, base - t.h - t.h * 0.35);
    ctx.lineTo(x + t.w * 2.4, base - t.h + 20);
    ctx.fill();
  }
}

function drawGroundFill(ctx, camera) {
  // 只画“地表以下的土层”，深浅坑的位置随后由 drawChasms 覆盖成虚空。
  ctx.fillStyle = "#12181f";
  ctx.fillRect(0, GROUND_Y + 80 - camera.y, VIEW.w, VIEW.h);
}

// 一个平台是否真的支撑地面：必须跨过地面线才算“实地”。
// 悬空的木桩、石台虽然也在画面里，但它们下面是深坑。
function coversGround(p) {
  return p.y <= GROUND_Y + 0.5 && p.y + p.h >= GROUND_Y - 0.5;
}

// 计算所有“没有地面支撑”的区间。渲染和自检共用同一份结果，
// 保证画面上的坑和判定里的坑是同一批。
export function findChasms(platforms) {
  const spans = platforms
    .filter(coversGround)
    .map((p) => [p.x, p.x + p.w])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b] of spans) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 0.5) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const chasms = [];
  let cursor = 0;
  for (const [a, b] of merged) {
    if (a > cursor + 0.5) chasms.push({ x0: cursor, x1: a });
    cursor = Math.max(cursor, b);
  }
  if (cursor < WORLD.width - 0.5) chasms.push({ x0: cursor, x1: WORLD.width });
  return chasms;
}

function drawChasms(ctx, camera, platforms) {
  for (const gap of findChasms(platforms)) {
    const w = gap.x1 - gap.x0;
    const x = gap.x0 - camera.x;
    if (x + w < -40 || x > VIEW.w + 40) continue;

    // 坑口上方的瘴气：让远处的山、树在坑口处沉下去，而不是看起来像一片平地
    const top = GROUND_Y - camera.y;
    const haze = ctx.createLinearGradient(0, top - 150, 0, top);
    haze.addColorStop(0, "rgba(5, 7, 13, 0)");
    haze.addColorStop(1, "rgba(5, 7, 13, 0.9)");
    ctx.fillStyle = haze;
    ctx.fillRect(x, top - 150, w, 150);

    // 深不见底的坑体
    const hole = ctx.createLinearGradient(0, top, 0, VIEW.h);
    hole.addColorStop(0, "#0a0e17");
    hole.addColorStop(0.45, "#04060b");
    hole.addColorStop(1, "#010204");
    ctx.fillStyle = hole;
    ctx.fillRect(x, top, w, VIEW.h - top);

    // 两侧崖壁受光的棱线，强调“这里断开了”
    for (const edge of [x, x + w]) {
      const wall = ctx.createLinearGradient(0, top, 0, top + 110);
      wall.addColorStop(0, "rgba(146, 168, 148, 0.2)");
      wall.addColorStop(1, "rgba(146, 168, 148, 0)");
      ctx.fillStyle = wall;
      ctx.fillRect(edge - 4, top, 8, 110);
    }
  }
}

function drawPlatforms(ctx, camera, platforms) {
  for (const p of platforms) {
    const x = wx(camera, p.x);
    const y = p.y - camera.y;
    if (x + p.w < -20 || x > VIEW.w + 20) continue;
    ctx.fillStyle = p.kind === "stone" ? "#3d4558" : p.kind === "log" ? "#5a3a28" : "#2f4a38";
    roundRect(ctx, x, y, p.w, p.h, 8);
    ctx.fill();
    ctx.fillStyle = p.kind === "stone" ? "#6d7588" : p.kind === "log" ? "#7a5236" : "#4b7a52";
    ctx.fillRect(x, y, p.w, 10);
    if (p.kind === "moss") {
      ctx.fillStyle = "#6cbf6a";
      for (let i = 8; i < p.w; i += 22) {
        ctx.beginPath();
        ctx.ellipse(x + i, y + 4, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (p.h > 40) {
      // 原来按 p.h 全高画，阴影会溢出平台底部
      ctx.fillStyle = "rgba(8, 10, 16, 0.35)";
      ctx.fillRect(x, y + 18, p.w, p.h - 18);
    }
  }
}

function drawThorns(ctx, camera, thorns, time) {
  for (const t of thorns) {
    const x = wx(camera, t.x);
    const y = t.y - camera.y;
    ctx.fillStyle = "#6b2b4a";
    ctx.fillRect(x, y + 10, t.w, t.h - 8);
    ctx.fillStyle = "#c45a78";
    const spikes = Math.max(3, Math.floor(t.w / 14));
    ctx.beginPath();
    for (let i = 0; i < spikes; i += 1) {
      const sx = x + (i + 0.5) * (t.w / spikes);
      const pulse = Math.sin(time * 6 + i) * 1.5;
      ctx.moveTo(sx - 7, y + t.h);
      ctx.lineTo(sx, y - 6 + pulse);
      ctx.lineTo(sx + 7, y + t.h);
    }
    ctx.fill();
  }
}

function drawBouncePads(ctx, camera, pads, time) {
  for (const pad of pads) {
    const x = wx(camera, pad.x);
    const y = pad.y - camera.y;
    ctx.strokeStyle = "rgba(240, 193, 74, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 90);
    ctx.lineTo(x, y - pad.r);
    ctx.stroke();
    glow(ctx, x, y, pad.r * 2.2, "rgba(255, 196, 80, 0.28)");
    ctx.fillStyle = "#f0c14a";
    ctx.beginPath();
    ctx.ellipse(x, y, pad.r * 0.72, pad.r * 0.9 + Math.sin(time * 5) * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1c2";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, pad.r * 0.32, pad.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLanterns(ctx, camera, lanterns, time) {
  for (const lamp of lanterns) {
    const x = wx(camera, lamp.x);
    const y = lamp.y - camera.y;
    ctx.strokeStyle = "#4a3728";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 36);
    ctx.lineTo(x, y - 8);
    ctx.stroke();
    if (lamp.lit) glow(ctx, x, y + 18, 70 + Math.sin(time * 4) * 6, "rgba(255, 186, 70, 0.32)");
    ctx.fillStyle = lamp.lit ? "#f3b23a" : "#6a5a48";
    roundRect(ctx, x - 12, y, 24, 30, 6);
    ctx.fill();
    ctx.fillStyle = lamp.lit ? "#fff2c4" : "#8a7a68";
    roundRect(ctx, x - 8, y + 6, 16, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(x - 14, y - 4, 28, 5);
    ctx.fillRect(x - 8, y + 28, 16, 5);
  }
}

function drawShrine(ctx, camera, shrine, light, time) {
  const x = wx(camera, shrine.x);
  const y = shrine.y - camera.y;
  glow(ctx, x + shrine.w / 2, y + 40, 90 + light * 50, "rgba(255, 200, 90, 0.2)");
  ctx.fillStyle = "#2a2434";
  ctx.fillRect(x + 18, y + 70, 52, 130);
  ctx.fillStyle = "#4a3a2a";
  roundRect(ctx, x, y + 20, shrine.w, 70, 10);
  ctx.fill();
  ctx.fillStyle = mix("#7a6240", "#f0c14a", 0.35 + light * 0.65);
  roundRect(ctx, x + 16, y + 32, shrine.w - 32, 46, 8);
  ctx.fill();
  ctx.fillStyle = "#1b1424";
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 28);
  ctx.lineTo(x + shrine.w / 2, y - 20 + Math.sin(time * 2) * 2);
  ctx.lineTo(x + shrine.w + 8, y + 28);
  ctx.closePath();
  ctx.fill();
}

function drawFireflies(ctx, camera, flies, time) {
  for (const fly of flies) {
    if (fly.collected) continue;
    // 用 updateFireflies 算好的飘动坐标，和拾取判定保持一致
    const x = wx(camera, fly.px ?? fly.x);
    const y = (fly.py ?? fly.y) - camera.y;
    glow(ctx, x, y, 16, "rgba(190, 255, 150, 0.35)");
    ctx.fillStyle = "#e8ff9a";
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFerns(ctx, camera) {
  ctx.fillStyle = "#163024";
  for (const f of ferns) {
    const x = wx(camera, f.x, 1.12);
    if (x < -20 || x > VIEW.w + 20) continue;
    ctx.beginPath();
    ctx.moveTo(x, VIEW.h);
    ctx.quadraticCurveTo(x + 12, VIEW.h - f.h, x + 4, VIEW.h - f.h * 1.6);
    ctx.quadraticCurveTo(x - 6, VIEW.h - f.h, x, VIEW.h);
    ctx.fill();
  }
}

function drawAmbient(ctx, camera, time, light) {
  ctx.fillStyle = `rgba(255, 220, 120, ${0.18 + light * 0.25})`;
  for (let i = 0; i < 24; i += 1) {
    const x = ((i * 211 + time * 18) % (WORLD.width + 200)) - camera.x * 0.8;
    const y = 80 + ((i * 47) % 360) + Math.sin(time + i) * 12;
    const sx = x - camera.x * 0.05;
    if (sx < 0 || sx > VIEW.w) continue;
    ctx.beginPath();
    ctx.arc(sx, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVignette(ctx, light) {
  const g = ctx.createRadialGradient(
    VIEW.w * 0.5,
    VIEW.h * 0.55,
    120,
    VIEW.w * 0.5,
    VIEW.h * 0.5,
    VIEW.w * 0.72
  );
  const dark = 0.62 - light * 0.48;
  g.addColorStop(0, "rgba(6, 8, 14, 0)");
  g.addColorStop(1, `rgba(6, 8, 14, ${dark})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
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

function mix(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const k = Math.max(0, Math.min(1, t));
  const m = pa.map((c, i) => Math.round(c + (pb[i] - c) * k));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

function hex(h) {
  const v = h.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
