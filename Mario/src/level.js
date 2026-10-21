export const VIEW = { w: 1280, h: 720 };
export const WORLD = { width: 5120, height: 720, deathY: 760 };

// 地面基准线。所有“实地”平台都从这里起算，渲染层也用同一个值来判断
// 哪里是深坑，避免出现“看起来是地、踩上去却是坑”的情况。
export const GROUND_Y = 560;

export function createLevel() {
  const platforms = [
    { x: 0, y: GROUND_Y, w: 780, h: 180, kind: "moss" },
    // 第二块陆地：右端一直铺到石阶脚下，与石阶无缝衔接
    { x: 940, y: GROUND_Y, w: 480, h: 180, kind: "moss" },
    // 石阶：从地面升起的实心台，跑过去会被挡住，必须跳上去
    { x: 1420, y: 488, w: 320, h: 152, kind: "stone" },
    // 再上一级：与石阶右缘齐平（1420+320=1740）
    { x: 1740, y: 416, w: 210, h: 240, kind: "stone" },
    { x: 2080, y: GROUND_Y, w: 560, h: 180, kind: "moss" },
    { x: 2760, y: 470, w: 190, h: 34, kind: "log" },
    { x: 3040, y: 390, w: 200, h: 34, kind: "log" },
    { x: 3340, y: GROUND_Y, w: 400, h: 180, kind: "moss" },
    { x: 3840, y: 470, w: 170, h: 34, kind: "stone" },
    { x: 4080, y: 390, w: 230, h: 34, kind: "stone" },
    { x: 4340, y: 310, w: 220, h: 34, kind: "log" },
    { x: 4680, y: GROUND_Y, w: 440, h: 180, kind: "moss" },
  ];

  const bouncePads = [
    // 原来 y=430 时跳跃最高点脚底只能到 465，差 35 > r=28，永远吃不到；下移到 460 才够得着
    { x: 870, y: 460, r: 30 },
    { x: 2688, y: 390, r: 28 },
    { x: 4588, y: 470, r: 30 },
  ];

  const thorns = [
    { x: 2288, y: 536, w: 118, h: 24 },
    { x: 3488, y: 536, w: 90, h: 24 },
    // 原 x=4160 w=70 几乎贴在平台#9 入口：左侧只有 80px 跑道，且满跳射程 200px
    // 大于平台宽度 190px，导致只能先踩荆棘再起跳，是设计上无法通过的死路。
    // 右移到 x=4186，左侧跑道 106px，右侧仍留 14px 安全边。
    { x: 4180, y: 366, w: 60, h: 24 },
  ];

  const lanterns = [
    { x: 1180, y: 470, lit: false },
    { x: 1860, y: 326, lit: false },
    { x: 3140, y: 300, lit: false },
    { x: 4440, y: 220, lit: false },
  ];

  const fireflies = [
    { x: 420, y: 470 },
    { x: 620, y: 500 },
    { x: 1080, y: 490 },
    { x: 1500, y: 420 },
    { x: 1960, y: 340 },
    { x: 2220, y: 480 },
    { x: 2580, y: 500 },
    { x: 2860, y: 390 },
    { x: 3220, y: 320 },
    { x: 3620, y: 480 },
    { x: 3940, y: 390 },
    { x: 4220, y: 310 },
    { x: 4760, y: 490 },
    { x: 4920, y: 500 },
  ].map((f) => ({ ...f, collected: false, phase: Math.random() * Math.PI * 2 }));

  const checkpoints = [
    { x: 80, y: GROUND_Y - 34 },
    { x: 980, y: GROUND_Y - 34 },
    { x: 2140, y: GROUND_Y - 34 },
    { x: 3380, y: GROUND_Y - 34 },
    { x: 4720, y: GROUND_Y - 34 },
  ];

  const shrine = { x: 4940, y: 360, w: 88, h: 200 };

  return {
    platforms,
    bouncePads,
    thorns,
    lanterns,
    fireflies,
    checkpoints,
    shrine,
    spawn: checkpoints[0],
  };
}

export function lanternsLit(level) {
  return level.lanterns.filter((l) => l.lit).length;
}

export function firefliesCollected(level) {
  return level.fireflies.filter((f) => f.collected).length;
}

export function lightRatio(level) {
  return lanternsLit(level) / level.lanterns.length;
}

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// 光球拾取半径：原来 40 时，跳跃最高点离 (1080,490) 那颗是 42，刚好擦不到
const FLY_PICKUP_R = 46;

// 光球会飘。以前只有渲染用了飘动后的坐标，判定却用静止坐标，
// 导致"看起来明明穿过去了却吃不到"。这里统一算一次，渲染和判定共用。
export function updateFireflies(level, time) {
  for (const fly of level.fireflies) {
    fly.px = fly.x + Math.sin(time * 2.2 + fly.phase) * 10;
    fly.py = fly.y + Math.cos(time * 1.7 + fly.phase) * 8;
  }
}

export function collectPickups(player, level) {
  let flies = 0;
  let lamps = 0;
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  for (const fly of level.fireflies) {
    if (fly.collected) continue;
    const dx = cx - (fly.px ?? fly.x);
    const dy = cy - (fly.py ?? fly.y);
    if (dx * dx + dy * dy < FLY_PICKUP_R * FLY_PICKUP_R) {
      fly.collected = true;
      flies += 1;
    }
  }
  for (const lamp of level.lanterns) {
    if (lamp.lit) continue;
    const dx = cx - lamp.x;
    const dy = cy - (lamp.y + 20);
    if (dx * dx + dy * dy < 72 * 72) {
      lamp.lit = true;
      lamps += 1;
    }
  }
  return { flies, lamps };
}

export function hitThorns(player, level) {
  const body = { x: player.x + 6, y: player.y + 8, w: player.w - 12, h: player.h - 8 };
  return level.thorns.some((t) => aabb(body, t));
}

export function reachedShrine(player, level) {
  return aabb(player, {
    x: level.shrine.x - 10,
    y: level.shrine.y,
    w: level.shrine.w + 20,
    h: level.shrine.h,
  });
}

export function lastCheckpoint(player, level) {
  let best = level.checkpoints[0];
  for (const c of level.checkpoints) {
    if (player.x + player.w / 2 >= c.x - 20) best = c;
  }
  return best;
}
