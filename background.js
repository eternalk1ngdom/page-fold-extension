// --- 常量定义 ---
const MENU_ROOT_ID = "tf-dynamic-menu";
const ACTIONS = {
  UPDATE_MENU_TITLE: "UPDATE_MENU_TITLE",
  OPEN_SHORTCUTS_PAGE: "OPEN_SHORTCUTS_PAGE",
  TRIGGER_CONTEXT_ACTION: "TRIGGER_CONTEXT_ACTION",
  COMMAND_FOLD: "COMMAND_FOLD",
  COMMAND_RESTORE: "COMMAND_RESTORE"
};

// 1. 初始化右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ROOT_ID,
      title: "设置为可折叠区域",
      contexts: ["all"]
    });
  });
});

// 2. 监听前台消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === ACTIONS.UPDATE_MENU_TITLE) {
    chrome.contextMenus.update(MENU_ROOT_ID, { title: message.title }, () => {
      if (chrome.runtime.lastError) {}
    });
  } else if (message.action === ACTIONS.OPEN_SHORTCUTS_PAGE) {
    // 跨浏览器兼容：适配 Edge、Chrome 等
    const isEdge = navigator.userAgent.includes("Edg/");
    const shortcutsUrl = isEdge ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts";
    chrome.tabs.create({ url: shortcutsUrl });
  }
});

// 3. 右键菜单点击调度
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || info.menuItemId !== MENU_ROOT_ID) return;
  chrome.tabs.sendMessage(tab.id, { action: ACTIONS.TRIGGER_CONTEXT_ACTION }, () => {
    if (chrome.runtime.lastError) {}
  });
});

// 4. 快捷键调度转发
chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab?.id) return;

  if (command === "toggle-fold") {
    chrome.tabs.sendMessage(tab.id, { action: ACTIONS.COMMAND_FOLD }, () => {
      if (chrome.runtime.lastError) {}
    });
  } else if (command === "restore-fold") {
    chrome.tabs.sendMessage(tab.id, { action: ACTIONS.COMMAND_RESTORE }, () => {
      if (chrome.runtime.lastError) {}
    });
  }
});