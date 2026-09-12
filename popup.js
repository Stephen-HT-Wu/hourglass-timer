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
let particles = [];

// --- Sync state from background ---
function syncState(state) {
  totalSeconds = state.totalSeconds;
  remainingSeconds = state.remainingSeconds;
  isRunning = state.isRunning;

  updateDisplay();
  updateButtons();

  if (isRunning) {
    startAnimation();
  } else {
    stopAnimation();
    drawHourglass();
  }

  // Play alarm if timer just finished
  if (remainingSeconds <= 0 && !isRunning) {
    // Check if we should play sound (only on transition)
  }
}

function updateButtons() {
  startBtn.textContent = isRunning ? 'Pause' : 'Start';
  startBtn.disabled = remainingSeconds <= 0 && !isRunning;

  // Highlight active preset
  document.querySelectorAll('.preset-btn').forEach(btn => {
    const mins = parseInt(btn.dataset.minutes);
    btn.classList.toggle('active', mins * 60 === totalSeconds);
  });
}

// Load state on popup open
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
    if (state) syncState(state);
  });

  // Listen for state updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'stateUpdate') {
      const hadTime = remainingSeconds > 0;
      syncState(message.state);

      if (hadTime && message.state.remainingSeconds <= 0 && !message.state.isRunning) {
        playAlarm();
      }
    }
  });
}

// --- Preset buttons ---
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRunning) return;
    customMinInput.value = '';
    const seconds = parseInt(btn.dataset.minutes) * 60;
    chrome.runtime.sendMessage({ action: 'setDuration', seconds }, (state) => {
      if (state) syncState(state);
    });
  });
});

customMinInput.addEventListener('change', () => {
  if (isRunning) return;
  const val = parseInt(customMinInput.value);
  if (val > 0 && val <= 120) {
    chrome.runtime.sendMessage({ action: 'setDuration', seconds: val * 60 }, (state) => {
      if (state) syncState(state);
    });
  }
});

// --- Controls ---
startBtn.addEventListener('click', () => {
  const action = isRunning ? 'pause' : 'start';
  chrome.runtime.sendMessage({ action }, (state) => {
    if (state) syncState(state);
  });
});

resetBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'reset' }, (state) => {
    if (state) syncState(state);
    particles = [];
  });
});

// --- Polling to keep popup in sync while running ---
let pollInterval = null;

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
      if (state) {
        const hadTime = remainingSeconds > 0;
        totalSeconds = state.totalSeconds;
        remainingSeconds = state.remainingSeconds;
        isRunning = state.isRunning;
        updateDisplay();
        updateButtons();

        if (!isRunning) {
          stopAnimation();
          stopPolling();
          drawHourglass();
          if (hadTime && remainingSeconds <= 0) {
            playAlarm();
          }
        }
      }
    });
  }, 500);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function playAlarm() {
  const audioCtx = new AudioContext();
  const notes = [659, 784, 659, 784, 659];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.25 + 0.2);
    osc.start(audioCtx.currentTime + i * 0.25);
    osc.stop(audioCtx.currentTime + i * 0.25 + 0.2);
  });
}

function updateDisplay() {
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  timeDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- Animation ---
function startAnimation() {
  if (animationId) return;
  startPolling();
  animate();
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

// --- Drawing constants ---
const W = 240;
const H = 400;
const CX = W / 2;
const GLASS_COLOR = 'rgba(200, 220, 255, 0.15)';
const GLASS_BORDER = 'rgba(200, 220, 255, 0.4)';

// --- Theme ---
const themes = {
  gold:  { sand: '#f0c27f', sandDark: '#d4a054', sandRgb: '240, 194, 127' },
  blue:  { sand: '#00e5ff', sandDark: '#00b0d4', sandRgb: '0, 229, 255' },
  green: { sand: '#39ff14', sandDark: '#2bc70e', sandRgb: '57, 255, 20' },
};
let currentTheme = localStorage.getItem('hourglassTheme') || 'gold';

function applyTheme(name) {
  currentTheme = name;
  localStorage.setItem('hourglassTheme', name);
  document.body.className = name === 'gold' ? '' : `theme-${name}`;
  document.querySelectorAll('.theme-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.theme === name);
  });
  drawHourglass();
}

document.querySelectorAll('.theme-dot').forEach(dot => {
  dot.addEventListener('click', () => applyTheme(dot.dataset.theme));
});

applyTheme(currentTheme);

function drawHourglass() {
  ctx.clearRect(0, 0, W, H);

  const t = themes[currentTheme];
  const SAND_COLOR = t.sand;
  const SAND_DARK = t.sandDark;
  const SAND_RGB = t.sandRgb;

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
    ctx.fillStyle = `rgba(${themes[currentTheme].sandRgb}, ${p.life})`;
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
