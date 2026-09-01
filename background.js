// =============================================================================
// 常量定义
// =============================================================================

const MENU_ROOT_ID = "tf-dynamic-menu";

const ACTIONS = {
  UPDATE_MENU_TITLE: "UPDATE_MENU_TITLE",
  OPEN_SHORTCUTS_PAGE: "OPEN_SHORTCUTS_PAGE",
  TRIGGER_CONTEXT_ACTION: "TRIGGER_CONTEXT_ACTION",
  COMMAND_FOLD: "COMMAND_FOLD",
  COMMAND_RESTORE: "COMMAND_RESTORE"
};

// =============================================================================
// 1. 右键菜单管理
// =============================================================================

function setupContextMenu() {
  chrome.storage.local.get({ isEnabled: true }, (res) => {
    chrome.contextMenus.removeAll(() => {
      if (res.isEnabled) {
        chrome.contextMenus.create({
          id: MENU_ROOT_ID,
          title: "设置为可折叠区域",
          contexts: ["all"]
        });
      }
    });
  });
}

// 扩展安装/更新时初始化菜单
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

// 监听配置变更：当用户开启/关闭插件总开关时，动态创建或移除右键菜单
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.isEnabled !== undefined) {
    if (changes.isEnabled.newValue) {
      setupContextMenu();
    } else {
      chrome.contextMenus.removeAll();
    }
  }
});

// =============================================================================
// 2. 前后台消息通信
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === ACTIONS.UPDATE_MENU_TITLE) {
    chrome.storage.local.get({ isEnabled: true }, (res) => {
      if (!res.isEnabled) return;
      chrome.contextMenus.update(MENU_ROOT_ID, { title: message.title }, () => {
        if (chrome.runtime.lastError) {}
      });
    });
  } else if (message.action === ACTIONS.OPEN_SHORTCUTS_PAGE) {
    const isEdge = navigator.userAgent.includes("Edg/");
    const shortcutsUrl = isEdge ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts";
    chrome.tabs.create({ url: shortcutsUrl });
  }
});

// =============================================================================
// 3. 右键菜单点击调度
// =============================================================================

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ROOT_ID && tab?.id) {
    chrome.storage.local.get({ isEnabled: true }, (res) => {
      if (!res.isEnabled) return;
      chrome.tabs.sendMessage(tab.id, { action: ACTIONS.TRIGGER_CONTEXT_ACTION }, () => {
        if (chrome.runtime.lastError) {}
      });
    });
  }
});

// =============================================================================
// 4. 全局快捷键调度（增加 isEnabled 拦截）
// =============================================================================

chrome.commands.onCommand.addListener((command) => {
  chrome.storage.local.get({ isEnabled: true }, (res) => {
    // 若插件处于关闭状态，直接静默拦截快捷键
    if (!res.isEnabled) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) return;

      if (command === "toggle-fold") {
        chrome.tabs.sendMessage(activeTab.id, { action: ACTIONS.COMMAND_FOLD }, () => {
          if (chrome.runtime.lastError) {}
        });
      } else if (command === "restore-fold") {
        chrome.tabs.sendMessage(activeTab.id, { action: ACTIONS.COMMAND_RESTORE }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    });
  });
});