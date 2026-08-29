// --- 常量定义 ---
const MENU_ROOT_ID = "tf-dynamic-menu";
const ACTIONS = {
  UPDATE_MENU_TITLE: "UPDATE_MENU_TITLE",
  OPEN_SHORTCUTS_PAGE: "OPEN_SHORTCUTS_PAGE",
  TRIGGER_CONTEXT_ACTION: "TRIGGER_CONTEXT_ACTION",
  COMMAND_FOLD: "COMMAND_FOLD",
  COMMAND_RESTORE: "COMMAND_RESTORE"
};

// 1. 初始化右键顶级菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ROOT_ID,
    title: "设置为可折叠区域 (Alt+Q)",
    contexts: ["all"]
  });
});

// 2. 监听前台运行时消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === ACTIONS.UPDATE_MENU_TITLE) {
    chrome.contextMenus.update(MENU_ROOT_ID, { title: message.title }, () => {
      if (chrome.runtime.lastError) {
        // 捕获菜单尚未就绪时的瞬态错误
      }
    });
  } else if (message.action === ACTIONS.OPEN_SHORTCUTS_PAGE) {
    chrome.tabs.create({ url: "edge://extensions/shortcuts" });
  }
});

// 3. 右键菜单点击调度
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || info.menuItemId !== MENU_ROOT_ID) return;
  chrome.tabs.sendMessage(tab.id, { action: ACTIONS.TRIGGER_CONTEXT_ACTION });
});

// 4. 系统快捷键转发
chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab?.id) return;

  if (command === "toggle-fold") {
    chrome.tabs.sendMessage(tab.id, { action: ACTIONS.COMMAND_FOLD });
  } else if (command === "restore-fold") {
    chrome.tabs.sendMessage(tab.id, { action: ACTIONS.COMMAND_RESTORE });
  }
});