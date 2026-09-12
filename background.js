let timerState = {
  totalSeconds: 5 * 60,
  remainingSeconds: 5 * 60,
  isRunning: false,
  endTime: null
};

let tickInterval = null;

// Restore state from storage on service worker startup
chrome.storage.local.get('timerState', (data) => {
  if (data.timerState) {
    timerState = data.timerState;
    if (timerState.isRunning && timerState.endTime) {
      const remaining = Math.max(0, Math.round((timerState.endTime - Date.now()) / 1000));
      if (remaining > 0) {
        timerState.remainingSeconds = remaining;
        startTick();
      } else {
        timerState.remainingSeconds = 0;
        timerState.isRunning = false;
        timerState.endTime = null;
        saveState();
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Hourglass Timer',
          message: 'Time is up!',
          priority: 2
        });
      }
    }
  }
});

function saveState() {
  chrome.storage.local.set({ timerState });
}

function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  timerState.endTime = Date.now() + timerState.remainingSeconds * 1000;
  timerState.isRunning = true;
  saveState();

  // Set a chrome alarm as backup for when service worker is killed
  chrome.alarms.create('hourglassTimer', { when: timerState.endTime });

  tickInterval = setInterval(() => {
    const now = Date.now();
    timerState.remainingSeconds = Math.max(0, Math.round((timerState.endTime - now) / 1000));

    if (timerState.remainingSeconds <= 0) {
      timerState.remainingSeconds = 0;
      timerState.isRunning = false;
      timerState.endTime = null;
      clearInterval(tickInterval);
      tickInterval = null;
      saveState();
      chrome.alarms.clear('hourglassTimer');

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Hourglass Timer',
        message: 'Time is up!',
        priority: 2
      });

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
  chrome.alarms.clear('hourglassTimer');
  saveState();
}

function broadcastState() {
  chrome.runtime.sendMessage({ action: 'stateUpdate', state: timerState }).catch(() => {});
}

// Backup: chrome alarm fires if service worker was killed during countdown
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'hourglassTimer') {
    timerState.remainingSeconds = 0;
    timerState.isRunning = false;
    timerState.endTime = null;
    saveState();

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Hourglass Timer',
      message: 'Time is up!',
      priority: 2
    });

    broadcastState();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getState':
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
      saveState();
      broadcastState();
      sendResponse(timerState);
      break;

    case 'setDuration': {
      const seconds = Math.floor(Number(message.seconds));
      if (!timerState.isRunning && Number.isFinite(seconds) && seconds > 0 && seconds <= 7200) {
        timerState.totalSeconds = seconds;
        timerState.remainingSeconds = seconds;
        saveState();
        broadcastState();
      }
      sendResponse(timerState);
      break;
    }
  }
  return true;
});
