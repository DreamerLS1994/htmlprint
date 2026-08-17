chrome.runtime.onInstalled.addListener(function () {
  console.log('[网页打印助手] 扩展已安装');
});

chrome.action.onClicked.addListener(function (tab) {
  chrome.tabs.sendMessage(tab.id, { type: 'PICK_PRINT' }, function (resp) {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, function () {
        chrome.tabs.sendMessage(tab.id, { type: 'PICK_PRINT' });
      });
    }
  });
});

var UPDATE_URL = 'https://sipo426.top/textfiles/rmadsup.json';

function checkUpdate(callback) {
  fetch(UPDATE_URL + '?t=' + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (info) {
      var current = chrome.runtime.getManifest().version;
      var hasUpdate = info.version && compareVersion(info.version, current) > 0;
      callback({ hasUpdate: hasUpdate, current: current, latest: info.version, url: info.url });
    })
    .catch(function (e) {
      callback({ hasUpdate: false, error: true });
    });
}

function compareVersion(a, b) {
  var pa = a.split('.'), pb = b.split('.');
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var na = parseInt(pa[i] || 0), nb = parseInt(pb[i] || 0);
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'CHECK_UPDATE') {
    checkUpdate(function (result) { sendResponse(result); });
    return true;
  }
});
