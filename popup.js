// --- 预设主题配置 ---
const THEMES = {
  blue: `.tf-fold-block {
  background-color: rgba(239, 246, 255, 0.85) !important;
  border-left: 4px solid #3b82f6 !important;
  border-top: 1px dashed #bfdbfe !important;
  border-right: 1px dashed #bfdbfe !important;
  border-bottom: 1px dashed #bfdbfe !important;
}
.tf-fold-block.is-collapsed {
  background-color: rgba(241, 245, 249, 0.95) !important;
  border-left: 4px solid #64748b !important;
  border-top: 1px solid #cbd5e1 !important;
  border-right: 1px solid #cbd5e1 !important;
  border-bottom: 1px solid #cbd5e1 !important;
}
.tf-toggle-btn {
  border: 1px solid #93c5fd !important;
  background: #dbeafe !important;
  color: #1e40af !important;
}
.tf-toggle-btn:hover {
  background: #bfdbfe !important;
}`,
  gray: `.tf-fold-block {
  background-color: rgba(248, 250, 252, 0.85) !important;
  border-left: 4px solid #64748b !important;
  border-top: 1px solid #e2e8f0 !important;
  border-right: 1px solid #e2e8f0 !important;
  border-bottom: 1px solid #e2e8f0 !important;
}
.tf-fold-block.is-collapsed {
  background-color: rgba(241, 245, 249, 0.95) !important;
  border-left: 4px solid #94a3b8 !important;
}
.tf-toggle-btn {
  border: 1px solid #cbd5e1 !important;
  background: #f1f5f9 !important;
  color: #334155 !important;
}
.tf-toggle-btn:hover {
  background: #e2e8f0 !important;
}`,
  green: `.tf-fold-block {
  background-color: rgba(240, 253, 244, 0.85) !important;
  border-left: 4px solid #22c55e !important;
  border-top: 1px dashed #bbf7d0 !important;
  border-right: 1px dashed #bbf7d0 !important;
  border-bottom: 1px dashed #bbf7d0 !important;
}
.tf-fold-block.is-collapsed {
  background-color: rgba(241, 245, 249, 0.95) !important;
  border-left: 4px solid #64748b !important;
}
.tf-toggle-btn {
  border: 1px solid #86efac !important;
  background: #dcfce7 !important;
  color: #166534 !important;
}
.tf-toggle-btn:hover {
  background: #bbf7d0 !important;
}`,
  yellow: `.tf-fold-block {
  background-color: rgba(254, 240, 138, 0.3) !important;
  border-left: 4px solid #f59e0b !important;
  border-top: 1px dashed #fcd34d !important;
  border-right: 1px dashed #fcd34d !important;
  border-bottom: 1px dashed #fcd34d !important;
}
.tf-fold-block.is-collapsed {
  background-color: rgba(243, 244, 246, 0.95) !important;
  border-left: 4px solid #9ca3af !important;
}
.tf-toggle-btn {
  border: 1px solid #d97706 !important;
  background: #fef3c7 !important;
  color: #92400e !important;
}
.tf-toggle-btn:hover {
  background: #fde68a !important;
}`
};

const DEFAULT_POPUP_CONFIG = {
  isEnabled: true,
  collapseInitially: true,
  autoSave: false,
  themeName: "blue",
  customCss: THEMES.blue
};

// 通用：向当前激活 Tab 发送消息
function sendActiveTabMessage(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    enabledToggle: document.getElementById("toggle-enabled"),
    collapseInitiallyToggle: document.getElementById("toggle-collapse-initially"),
    autoSaveToggle: document.getElementById("toggle-auto-save"),
    themeSelect: document.getElementById("theme-preset"),
    cssTextarea: document.getElementById("custom-css"),
    saveCssBtn: document.getElementById("btn-save-css"),
    clearBtn: document.getElementById("btn-clear-page"),
    configShortcutsBtn: document.getElementById("btn-config-shortcuts")
  };

  // 1. 读取并渲染设置
  chrome.storage.local.get(DEFAULT_POPUP_CONFIG, (settings) => {
    elements.enabledToggle.checked = settings.isEnabled;
    elements.collapseInitiallyToggle.checked = settings.collapseInitially;
    elements.autoSaveToggle.checked = settings.autoSave;
    elements.themeSelect.value = settings.themeName;
    elements.cssTextarea.value = settings.customCss.trim();
  });

  // 2. 状态切换绑定
  elements.enabledToggle.addEventListener("change", () => {
    chrome.storage.local.set({ isEnabled: elements.enabledToggle.checked });
  });

  elements.collapseInitiallyToggle.addEventListener("change", () => {
    chrome.storage.local.set({ collapseInitially: elements.collapseInitiallyToggle.checked });
  });

  elements.autoSaveToggle.addEventListener("change", () => {
    chrome.storage.local.set({ autoSave: elements.autoSaveToggle.checked });
  });

  // 3. 样式持久化与广播
  function saveAndBroadcastCss(themeName, cssCode) {
    chrome.storage.local.set({ themeName, customCss: cssCode }, () => {
      sendActiveTabMessage({ action: "APPLY_CUSTOM_CSS", css: cssCode });
    });
  }

  elements.themeSelect.addEventListener("change", () => {
    const selected = elements.themeSelect.value;
    if (selected !== "custom") {
      const cssCode = THEMES[selected];
      elements.cssTextarea.value = cssCode.trim();
      saveAndBroadcastCss(selected, cssCode);
    }
  });

  elements.saveCssBtn.addEventListener("click", () => {
    elements.themeSelect.value = "custom";
    saveAndBroadcastCss("custom", elements.cssTextarea.value);
    elements.saveCssBtn.textContent = "已应用 ✓";
    setTimeout(() => {
      elements.saveCssBtn.textContent = "保存并应用样式";
    }, 1200);
  });

  // 4. 快捷键与清理功能
  elements.configShortcutsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: "OPEN_SHORTCUTS_PAGE" });
  });

  elements.clearBtn.addEventListener("click", () => {
    sendActiveTabMessage({ action: "CLEAR_ALL_PAGE_FOLDS" });
  });
});