let timerState = {
  totalSeconds: 5 * 60,
  remainingSeconds: 5 * 60,
  isRunning: false,
  endTime: null // timestamp when timer should end
};

let tickInterval = null;

function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  timerState.endTime = Date.now() + timerState.remainingSeconds * 1000;
  timerState.isRunning = true;

  tickInterval = setInterval(() => {
    const now = Date.now();
    timerState.remainingSeconds = Math.max(0, Math.round((timerState.endTime - now) / 1000));

    if (timerState.remainingSeconds <= 0) {
      timerState.remainingSeconds = 0;
      timerState.isRunning = false;
      clearInterval(tickInterval);
      tickInterval = null;

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Hourglass Timer',
        message: 'Time is up!',
        priority: 2
      });

      // Play alarm via offscreen document or notify popup
      broadcastState();
    }
  }, 500);
}

function pauseTick() {
  timerState.isRunning = false;
  timerState.endTime = null;
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function broadcastState() {
  chrome.runtime.sendMessage({ action: 'stateUpdate', state: timerState }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getState':
      // Recalculate remaining if running
      if (timerState.isRunning && timerState.endTime) {
        timerState.remainingSeconds = Math.max(0, Math.round((timerState.endTime - Date.now()) / 1000));
      }
      sendResponse(timerState);
      break;

    case 'start':
      if (timerState.remainingSeconds > 0) {
        startTick();
        broadcastState();
      }
      sendResponse(timerState);
      break;

    case 'pause':
      pauseTick();
      broadcastState();
      sendResponse(timerState);
      break;

    case 'reset':
      pauseTick();
      timerState.remainingSeconds = timerState.totalSeconds;
      broadcastState();
      sendResponse(timerState);
      break;

    case 'setDuration':
      if (!timerState.isRunning) {
        timerState.totalSeconds = message.seconds;
        timerState.remainingSeconds = message.seconds;
        broadcastState();
      }
      sendResponse(timerState);
      break;
  }
  return true;
});
