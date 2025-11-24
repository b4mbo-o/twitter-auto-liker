// background.js
chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("x.com") || tab.url.includes("twitter.com")) {
    chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
  }
});