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

var RELEASES_API_URL = 'https://api.github.com/repos/DreamerLS1994/htmlprint/releases/latest';
var RELEASES_PAGE_URL = 'https://github.com/DreamerLS1994/htmlprint/releases';

function checkUpdate(callback) {
  var current = normalizeVersion(chrome.runtime.getManifest().version);

  fetch(RELEASES_API_URL, {
    headers: { 'Accept': 'application/vnd.github+json' },
    cache: 'no-store'
  })
    .then(function (response) {
      if (response.status === 404) throw makeError('NO_RELEASE');
      if (!response.ok) throw makeError('HTTP_ERROR_' + response.status);
      return response.json();
    })
    .then(function (release) {
      var latest = normalizeVersion(release.tag_name || release.name);
      if (!latest) throw makeError('INVALID_RELEASE');
      var comparison = compareVersion(latest, current);
      callback({
        hasUpdate: comparison > 0,
        isAhead: comparison < 0,
        current: current,
        latest: latest,
        url: pickDownloadUrl(release)
      });
    })
    .catch(function (err) {
      callback({ hasUpdate: false, current: current, code: (err && err.code) || 'NETWORK_ERROR' });
    });
}

function makeError(code) {
  var err = new Error(code);
  err.code = code;
  return err;
}

function pickDownloadUrl(release) {
  var assets = release.assets || [];
  for (var i = 0; i < assets.length; i++) {
    if (/\.zip$/i.test(assets[i].name || '')) return assets[i].browser_download_url;
  }
  return release.html_url || RELEASES_PAGE_URL;
}

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function compareVersion(a, b) {
  var pa = a.split('.'), pb = b.split('.');
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var na = parseInt(pa[i] || 0, 10), nb = parseInt(pb[i] || 0, 10);
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