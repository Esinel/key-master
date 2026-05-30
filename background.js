chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "activate-hints") {
    chrome.tabs.sendMessage(tab.id, { action: "activate" });
  }
});
