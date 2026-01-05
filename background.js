// background.js
chrome.action.onClicked.addListener(async (tab) => {
  const url = tab.url || "";
  const tabId = tab.id;
  const isX =
    /^https?:\/\/(?:www\.)?(x\.com|twitter\.com)\//i.test(url);

  if (!isX || tabId == null) {
    console.warn("This extension works only on X/Twitter tabs.");
    return;
  }

  try {
    // Ensure the content script is present before sending a message.
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (e) {
    console.error("Failed to inject content script:", e);
    return;
  }

  chrome.tabs.sendMessage(tabId, { action: "togglePanel" }, () => {
    if (chrome.runtime.lastError) {
      console.error("togglePanel send failed:", chrome.runtime.lastError);
    }
  });
});
