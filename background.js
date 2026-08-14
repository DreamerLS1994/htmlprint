chrome.runtime.onInstalled.addListener(function () {
  console.log('[网页打印助手] 扩展已安装');
});

chrome.action.onClicked.addListener(function (tab) {
  chrome.tabs.sendMessage(tab.id, { type: 'PICK_PRINT' });
});
