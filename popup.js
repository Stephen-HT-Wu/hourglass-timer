const canvas = document.getElementById('hourglass');
const ctx = canvas.getContext('2d');
const timeDisplay = document.getElementById('timeDisplay');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const customMinInput = document.getElementById('customMin');

let totalSeconds = 5 * 60;
let remainingSeconds = totalSeconds;
let isRunning = false;
let animationId = null;
let timerInterval = null;

// Sand particles for falling effect
let particles = [];

// --- Preset buttons ---
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRunning) return;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    customMinInput.value = '';
    totalSeconds = parseInt(btn.dataset.minutes) * 60;
    remainingSeconds = totalSeconds;
    updateDisplay();
    drawHourglass();
  });
});

customMinInput.addEventListener('change', () => {
  if (isRunning) return;
  const val = parseInt(customMinInput.value);
  if (val > 0 && val <= 120) {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    totalSeconds = val * 60;
    remainingSeconds = totalSeconds;
    updateDisplay();
    drawHourglass();
  }
});

// --- Controls ---
startBtn.addEventListener('click', () => {
  if (isRunning) {
    pause();
  } else {
    start();
  }
});

resetBtn.addEventListener('click', reset);

function start() {
  if (remainingSeconds <= 0) return;
  isRunning = true;
  startBtn.textContent = 'Pause';
  particles = [];

  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateDisplay();
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      pause();
      startBtn.textContent = 'Start';
      startBtn.disabled = true;
      chrome.runtime.sendMessage({ action: 'timerDone' });
    }
  }, 1000);

  animate();
}

function pause() {
  isRunning = false;
  startBtn.textContent = 'Start';
  clearInterval(timerInterval);
  cancelAnimationFrame(animationId);
}

function reset() {
  pause();
  remainingSeconds = totalSeconds;
  startBtn.disabled = false;
  startBtn.textContent = 'Start';
  particles = [];
  updateDisplay();
  drawHourglass();
}

function updateDisplay() {
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  timeDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- Drawing ---
const W = 240;
const H = 400;
const CX = W / 2;
const SAND_COLOR = '#f0c27f';
const SAND_DARK = '#d4a054';
const GLASS_COLOR = 'rgba(200, 220, 255, 0.15)';
const GLASS_BORDER = 'rgba(200, 220, 255, 0.4)';

function drawHourglass() {
  ctx.clearRect(0, 0, W, H);

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 1;
  const topSand = progress;
  const bottomSand = 1 - progress;

  // Frame - top and bottom bars
  ctx.fillStyle = GLASS_BORDER;
  roundRect(ctx, 40, 20, 160, 8, 3);
  ctx.fill();
  roundRect(ctx, 40, 372, 160, 8, 3);
  ctx.fill();

  // Glass shape - upper half
  ctx.beginPath();
  ctx.moveTo(50, 28);
  ctx.bezierCurveTo(50, 140, 110, 175, CX, 200);
  ctx.bezierCurveTo(130, 175, 190, 140, 190, 28);
  ctx.closePath();
  ctx.fillStyle = GLASS_COLOR;
  ctx.fill();
  ctx.strokeStyle = GLASS_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glass shape - lower half
  ctx.beginPath();
  ctx.moveTo(50, 372);
  ctx.bezierCurveTo(50, 260, 110, 225, CX, 200);
  ctx.bezierCurveTo(130, 225, 190, 260, 190, 372);
  ctx.closePath();
  ctx.fillStyle = GLASS_COLOR;
  ctx.fill();
  ctx.strokeStyle = GLASS_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Sand in upper half
  if (topSand > 0.01) {
    ctx.save();
    // Clip to upper glass
    ctx.beginPath();
    ctx.moveTo(50, 28);
    ctx.bezierCurveTo(50, 140, 110, 175, CX, 200);
    ctx.bezierCurveTo(130, 175, 190, 140, 190, 28);
    ctx.closePath();
    ctx.clip();

    const sandTop = 28 + (1 - topSand) * 140;
    const grad = ctx.createLinearGradient(0, sandTop, 0, 190);
    grad.addColorStop(0, SAND_COLOR);
    grad.addColorStop(1, SAND_DARK);
    ctx.fillStyle = grad;
    ctx.fillRect(30, sandTop, 180, 180);
    ctx.restore();
  }

  // Sand in lower half
  if (bottomSand > 0.01) {
    ctx.save();
    // Clip to lower glass
    ctx.beginPath();
    ctx.moveTo(50, 372);
    ctx.bezierCurveTo(50, 260, 110, 225, CX, 200);
    ctx.bezierCurveTo(130, 225, 190, 260, 190, 372);
    ctx.closePath();
    ctx.clip();

    const sandHeight = bottomSand * 140;
    const sandTop = 372 - sandHeight;
    const grad = ctx.createLinearGradient(0, sandTop, 0, 372);
    grad.addColorStop(0, SAND_DARK);
    grad.addColorStop(1, SAND_COLOR);
    ctx.fillStyle = grad;
    ctx.fillRect(30, sandTop, 180, sandHeight + 5);
    ctx.restore();
  }

  // Falling sand stream
  if (isRunning && remainingSeconds > 0) {
    ctx.beginPath();
    ctx.moveTo(CX - 1, 185);
    ctx.lineTo(CX + 1, 185);
    ctx.lineTo(CX + 1, 215);
    ctx.lineTo(CX - 1, 215);
    ctx.closePath();
    ctx.fillStyle = SAND_COLOR;
    ctx.fill();

    // Particles
    spawnParticles();
    drawParticles();
  }
}

function spawnParticles() {
  if (Math.random() < 0.4) {
    particles.push({
      x: CX + (Math.random() - 0.5) * 4,
      y: 210 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 1.5 + 0.5,
      life: 1,
      size: Math.random() * 2 + 1
    });
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;

    if (p.life <= 0 || p.y > 370) {
      particles.splice(i, 1);
      continue;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240, 194, 127, ${p.life})`;
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function animate() {
  drawHourglass();
  animationId = requestAnimationFrame(animate);
}

// Initial draw
updateDisplay();
drawHourglass();
