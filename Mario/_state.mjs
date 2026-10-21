import { createLevel } from "./src/level.js";
import { createPlayer, updatePlayer } from "./src/player.js";

const dt = 1 / 60;
const lv = createLevel();
console.log("平台#0:", JSON.stringify(lv.platforms[0]));
console.log("平台#1:", JSON.stringify(lv.platforms[1]));
console.log("弹跳球:", JSON.stringify(lv.bouncePads[0]));
console.log("");

// 逐帧跑：玩家站在 (851, 526)，无输入
function trace(x, y, vx, vy, grounded, frames, label) {
  const l = createLevel();
  const p = createPlayer(x, y);
  p.vx = vx; p.vy = vy; p.grounded = grounded;
  console.log(`--- ${label} ---`);
  for (let i = 0; i < frames; i += 1) {
    updatePlayer(p, { left: false, right: false, jumpPressed: false }, l.platforms, l.bouncePads, dt);
    if (i < 6 || i % 20 === 0)
      console.log(`  f=${i} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vy=${p.vy.toFixed(0)} g=${p.grounded ? 1 : 0}`);
    if (p.y > 760) { console.log(`  >>> 掉落死亡 @f=${i}`); return; }
  }
  console.log(`  结束: x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} g=${p.grounded ? 1 : 0}`);
}

trace(851, 526, 0, 0, true, 120, "站在 (851,526) 不动");
trace(902, 526, 0, 0, true, 60, "站在 (902,526) 平台#1 最左可站处");
trace(889, 526, 0, 0, true, 60, "站在 (889,526) 平台#1 左边缘外 1px");
trace(851, 526, 0, 27, false, 60, "从 (851,526) 下落中");

// 扫描：哪些 x 站得住
console.log("\n--- 站得住的 x 区间（逐 1px 扫描 y=526）---");
const ok = [];
for (let x = 700; x <= 1000; x += 1) {
  const l = createLevel();
  const p = createPlayer(x, 526);
  let stays = true;
  for (let i = 0; i < 90; i += 1) {
    updatePlayer(p, { left: false, right: false, jumpPressed: false }, l.platforms, l.bouncePads, dt);
    if (!p.grounded && i > 3) { stays = false; break; }
  }
  if (stays) ok.push(x);
}
if (ok.length) {
  // 连续区间
  const ranges = [];
  let s = ok[0], prev = ok[0];
  for (const v of ok.slice(1)) {
    if (v !== prev + 1) { ranges.push([s, prev]); s = v; }
    prev = v;
  }
  ranges.push([s, prev]);
  console.log("  站得住:", ranges.map((r) => `${r[0]}..${r[1]}`).join("  "));
} else console.log("  无");