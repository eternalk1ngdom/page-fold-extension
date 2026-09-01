// =============================================================================
// 1. 全预设主题 CSS（深浅双通道半透明适配）
// =============================================================================

const THEME_STYLES = {
  // 1. 经典蓝（半透明自适应版）
  blue: `
    .tf-fold-block {
      background-color: rgba(59, 130, 246, 0.08) !important;
      border-left: 3px solid #3b82f6 !important;
      border-top: 1px dashed rgba(59, 130, 246, 0.25) !important;
      border-right: 1px dashed rgba(59, 130, 246, 0.25) !important;
      border-bottom: 1px dashed rgba(59, 130, 246, 0.25) !important;
    }
    .tf-fold-block.is-collapsed {
      background-color: rgba(100, 116, 139, 0.12) !important;
      border-left: 3px solid #64748b !important;
      border-top-style: solid !important;
      border-right-style: solid !important;
      border-bottom-style: solid !important;
    }
    .tf-toggle-btn {
      border: 1px solid rgba(59, 130, 246, 0.3) !important;
      background: rgba(59, 130, 246, 0.12) !important;
      color: inherit !important;
    }
    .tf-toggle-btn:hover {
      background: rgba(59, 130, 246, 0.25) !important;
    }
  `,

  // 2. 沉浸深灰（专为暗色/代码阅读优化）
  gray: `
    .tf-fold-block {
      background-color: rgba(255, 255, 255, 0.05) !important;
      border-left: 3px solid #94a3b8 !important;
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    .tf-fold-block.is-collapsed {
      background-color: rgba(0, 0, 0, 0.25) !important;
      border-left: 3px solid #64748b !important;
    }
    .tf-toggle-btn {
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      background: rgba(255, 255, 255, 0.08) !important;
      color: inherit !important;
    }
    .tf-toggle-btn:hover {
      background: rgba(255, 255, 255, 0.18) !important;
    }
  `,

  // 3. 护眼淡绿
  green: `
    .tf-fold-block {
      background-color: rgba(16, 185, 129, 0.08) !important;
      border-left: 3px solid #10b981 !important;
      border-top: 1px dashed rgba(16, 185, 129, 0.25) !important;
      border-right: 1px dashed rgba(16, 185, 129, 0.25) !important;
      border-bottom: 1px dashed rgba(16, 185, 129, 0.25) !important;
    }
    .tf-fold-block.is-collapsed {
      background-color: rgba(100, 116, 139, 0.12) !important;
      border-left: 3px solid #64748b !important;
    }
    .tf-toggle-btn {
      border: 1px solid rgba(16, 185, 129, 0.3) !important;
      background: rgba(16, 185, 129, 0.12) !important;
      color: inherit !important;
    }
    .tf-toggle-btn:hover {
      background: rgba(16, 185, 129, 0.25) !important;
    }
  `,

  // 4. 暖调柔金
  gold: `
    .tf-fold-block {
      background-color: rgba(245, 158, 11, 0.08) !important;
      border-left: 3px solid #f59e0b !important;
      border-top: 1px dashed rgba(245, 158, 11, 0.25) !important;
      border-right: 1px dashed rgba(245, 158, 11, 0.25) !important;
      border-bottom: 1px dashed rgba(245, 158, 11, 0.25) !important;
    }
    .tf-fold-block.is-collapsed {
      background-color: rgba(100, 116, 139, 0.12) !important;
      border-left: 3px solid #64748b !important;
    }
    .tf-toggle-btn {
      border: 1px solid rgba(245, 158, 11, 0.3) !important;
      background: rgba(245, 158, 11, 0.12) !important;
      color: inherit !important;
    }
    .tf-toggle-btn:hover {
      background: rgba(245, 158, 11, 0.25) !important;
    }
  `
};

// =============================================================================
// 2. DOM 元素缓存与交互绑定
// =============================================================================

const elements = {
  chkEnabled: document.getElementById("chk-enabled"),
  chkCollapseInitially: document.getElementById("chk-collapse-initially"),
  chkAutoSave: document.getElementById("chk-auto-save"),
  themeCards: document.querySelectorAll(".theme-card"),
  btnToggleCss: document.getElementById("btn-toggle-custom-css"),
  panelCustomCss: document.getElementById("panel-custom-css"),
  cssArrow: document.getElementById("css-arrow"),
  txtCustomCss: document.getElementById("txt-custom-css"),
  btnApplyCustomCss: document.getElementById("btn-apply-custom-css"),
  btnClearPage: document.getElementById("btn-clear-page-folds"),
  btnClearAllHistory: document.getElementById("btn-clear-all-history"),
  btnConfigShortcuts: document.getElementById("btn-config-shortcuts"),
  statusTip: document.getElementById("status-tip")
};

function showTip(text, isSuccess = true) {
  if (!elements.statusTip) return;
  elements.statusTip.textContent = text;
  elements.statusTip.style.color = isSuccess ? "#10b981" : "#ef4444";
  setTimeout(() => {
    elements.statusTip.textContent = "";
  }, 2500);
}

function broadcastCss(css) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "APPLY_CUSTOM_CSS", css }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    });
  });
}

// 1. 初始化读取配置
chrome.storage.local.get(
  {
    isEnabled: true,
    collapseInitially: true,
    autoSave: false,
    currentTheme: "blue",
    customCss: THEME_STYLES.blue
  },
  (settings) => {
    if (elements.chkEnabled) elements.chkEnabled.checked = settings.isEnabled;
    if (elements.chkCollapseInitially) elements.chkCollapseInitially.checked = settings.collapseInitially;
    if (elements.chkAutoSave) elements.chkAutoSave.checked = settings.autoSave;
    if (elements.txtCustomCss) elements.txtCustomCss.value = settings.customCss;

    elements.themeCards.forEach((card) => {
      if (card.dataset.theme === settings.currentTheme) {
        card.classList.add("active");
      } else {
        card.classList.remove("active");
      }
    });
  }
);

// 2. 监听开关变动
elements.chkEnabled?.addEventListener("change", () => {
  chrome.storage.local.set({ isEnabled: elements.chkEnabled.checked });
});

elements.chkCollapseInitially?.addEventListener("change", () => {
  chrome.storage.local.set({ collapseInitially: elements.chkCollapseInitially.checked });
});

elements.chkAutoSave?.addEventListener("change", () => {
  chrome.storage.local.set({ autoSave: elements.chkAutoSave.checked });
});

// 3. 监听主题选择
elements.themeCards.forEach((card) => {
  card.addEventListener("click", () => {
    const theme = card.dataset.theme;
    elements.themeCards.forEach((c) => c.classList.remove("active"));
    card.classList.add("active");

    const css = THEME_STYLES[theme] || THEME_STYLES.blue;
    if (elements.txtCustomCss) elements.txtCustomCss.value = css;

    chrome.storage.local.set({ currentTheme: theme, customCss: css });
    broadcastCss(css);
    showTip("已切换外观主题");
  });
});

// 4. 二级抽屉展开/收起
elements.btnToggleCss?.addEventListener("click", () => {
  const isOpen = elements.panelCustomCss.classList.toggle("open");
  if (elements.cssArrow) elements.cssArrow.textContent = isOpen ? "▲" : "▼";
});

// 5. 应用自定义 CSS
elements.btnApplyCustomCss?.addEventListener("click", () => {
  const css = elements.txtCustomCss.value.trim();
  if (!css) {
    showTip("CSS 内容不能为空", false);
    return;
  }
  elements.themeCards.forEach((c) => c.classList.remove("active"));
  chrome.storage.local.set({ currentTheme: "custom", customCss: css });
  broadcastCss(css);
  showTip("自定义 CSS 已生效并保存！");
});

// 6. 仅恢复当前页（增加 Storage 强力兜底与错误容错）
elements.btnClearPage?.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab?.id) {
      showTip("无法获取当前标签页", false);
      return;
    }

    // 先根据 URL 兜底清理存储
    if (activeTab.url) {
      try {
        const u = new URL(activeTab.url);
        const storageKey = "tf_store_" + u.origin + decodeURIComponent(u.pathname) + u.search;
        chrome.storage.local.remove(storageKey);
      } catch (e) {}
    }

    // 向 content.js 发送实时解包指令
    chrome.tabs.sendMessage(activeTab.id, { action: "CLEAR_PAGE_FOLDS" }, (response) => {
      if (chrome.runtime.lastError) {
        showTip("已清理该页记忆（当前页面为受限页）", true);
      } else {
        showTip("已恢复本页排版！", true);
      }
    });
  });
});

// 7. 清空全网记忆历史
elements.btnClearAllHistory?.addEventListener("click", () => {
  if (confirm("确定要清空所有网站的历史折叠记忆吗？\n所有打开页面的折叠将即时恢复原生排版。")) {
    chrome.storage.local.get(null, (allData) => {
      if (chrome.runtime.lastError) return;

      const keysToRemove = Object.keys(allData).filter((k) => k.startsWith("tf_store_"));
      chrome.storage.local.remove(keysToRemove, () => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { action: "CLEAR_PAGE_FOLDS" }, () => {
                if (chrome.runtime.lastError) {}
              });
            }
          });
        });
        showTip(`已重置并清除全网折叠数据！`, true);
      });
    });
  }
});

// 8. 快捷键配置入口
elements.btnConfigShortcuts?.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.sendMessage({ action: "OPEN_SHORTCUTS_PAGE" });
});