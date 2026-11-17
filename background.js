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
var VERSION_JSON_URL = 'https://cdn.jsdelivr.net/gh/DreamerLS1994/htmlprint@master/version.json';
var RELEASES_PAGE_URL = 'https://github.com/DreamerLS1994/htmlprint/releases';
var UPDATE_CACHE_KEY = 'updateCheckCache';
var UPDATE_CACHE_TTL = 60 * 60 * 1000;

function checkUpdate(callback) {
  var current = normalizeVersion(chrome.runtime.getManifest().version);

  readUpdateCache(function (cached) {
    if (isCacheFresh(cached)) {
      callback(buildResult(current, cached.latest, cached.url, { cached: true }));
      return;
    }

    fetchLatestRelease()
      .then(function (release) {
        var latest = normalizeVersion(release.tag_name || release.name);
        if (!latest) throw makeError('INVALID_RELEASE');
        var url = pickDownloadUrl(release);
        saveUpdateCache(latest, url);
        callback(buildResult(current, latest, url, {}));
      })
      .catch(function (apiError) {
        var apiCode = (apiError && apiError.code) || 'NETWORK_ERROR';
        var resetAt = apiError && apiError.resetAt;

        fetchVersionJson()
          .then(function (info) {
            var latest = normalizeVersion(info.version);
            if (!latest) throw makeError('INVALID_RELEASE');
            var url = info.download || info.url || RELEASES_PAGE_URL;
            saveUpdateCache(latest, url);
            callback(buildResult(current, latest, url, {
              fallback: true,
              apiCode: apiCode,
              resetAt: resetAt
            }));
          })
          .catch(function () {
            callback({
              hasUpdate: false,
              isAhead: false,
              current: current,
              code: apiCode,
              resetAt: resetAt
            });
          });
      });
  });
}

function buildResult(current, latest, url, extra) {
  var comparison = compareVersion(latest, current);
  var result = {
    hasUpdate: comparison > 0,
    isAhead: comparison < 0,
    current: current,
    latest: latest,
    url: url
  };
  if (extra && extra.cached) result.cached = true;
  if (extra && extra.fallback) result.fallback = true;
  if (extra && extra.apiCode) result.apiCode = extra.apiCode;
  if (extra && extra.resetAt) result.resetAt = extra.resetAt;
  return result;
}

function fetchLatestRelease() {
  return fetch(RELEASES_API_URL, {
    headers: { 'Accept': 'application/vnd.github+json' },
    cache: 'no-store'
  }).then(function (response) {
    if (response.status === 404) throw makeError('NO_RELEASE');
    if (response.status === 403 || response.status === 429) {
      var remaining = response.headers.get('x-ratelimit-remaining');
      var resetAt = parseInt(response.headers.get('x-ratelimit-reset') || '0', 10) * 1000;
      var retryAfter = parseInt(response.headers.get('retry-after') || '0', 10) * 1000;
      var err = makeError(remaining === '0' ? 'RATE_LIMITED' : 'FORBIDDEN');
      err.resetAt = resetAt || (retryAfter ? Date.now() + retryAfter : 0);
      throw err;
    }
    if (!response.ok) throw makeError('HTTP_ERROR_' + response.status);
    return response.json();
  });
}

function fetchVersionJson() {
  return fetch(VERSION_JSON_URL, { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw makeError('FALLBACK_HTTP_' + response.status);
      return response.json();
    });
}

function readUpdateCache(callback) {
  if (!chrome.storage || !chrome.storage.local) { callback(null); return; }
  chrome.storage.local.get([UPDATE_CACHE_KEY], function (data) {
    if (chrome.runtime.lastError) { callback(null); return; }
    callback(data && data[UPDATE_CACHE_KEY]);
  });
}

function isCacheFresh(cached) {
  return !!(cached && cached.latest && cached.checkedAt &&
    (Date.now() - cached.checkedAt < UPDATE_CACHE_TTL));
}

function saveUpdateCache(latest, url) {
  if (!chrome.storage || !chrome.storage.local) return;
  var data = {};
  data[UPDATE_CACHE_KEY] = { latest: latest, url: url, checkedAt: Date.now() };
  chrome.storage.local.set(data);
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