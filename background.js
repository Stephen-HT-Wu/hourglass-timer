chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'timerDone') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Hourglass Timer',
      message: 'Time is up!',
      priority: 2
    });
  }
});
