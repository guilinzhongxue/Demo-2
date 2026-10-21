let ctx = null;
let muted = false;

function context() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function unlockAudio() {
  try {
    context();
  } catch {
    // Audio is optional if the browser blocks it.
  }
}

function tone(freq, duration, type, gainValue) {
  if (muted) return;
  try {
    const ac = context();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch {
    // Ignore audio failures; gameplay still works.
  }
}

export function playJump() {
  tone(420, 0.12, "triangle", 0.05);
}

export function playBounce() {
  tone(280, 0.16, "sine", 0.06);
}

export function playFirefly() {
  tone(880, 0.14, "sine", 0.045);
}

export function playLantern() {
  tone(330, 0.22, "triangle", 0.06);
  setTimeout(() => tone(494, 0.28, "sine", 0.045), 90);
}

export function playHurt() {
  tone(140, 0.2, "sawtooth", 0.04);
}

export function playWin() {
  [392, 494, 587, 784].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.28, "triangle", 0.05), i * 140);
  });
}
