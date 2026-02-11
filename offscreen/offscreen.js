// Offscreen document for playing notification sounds (MV3 service workers can't use Audio)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'playSound') {
    const audio = document.getElementById('audio');
    audio.src = message.source;
    audio.play();
  }
});
