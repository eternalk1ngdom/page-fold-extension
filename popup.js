// --- 预设主题 CSS 字典 ---
const THEME_STYLES = {
  blue: `
    .tf-fold-block {
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
    }
  `,
  gray: `
    .tf-fold-block {
      background-color: rgba(248, 250, 252, 0.9) !important;
      border-left: 4px solid #475569 !important;
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
    }
  `,
  green: `
    .tf-fold-block {
      background-color: rgba(240, 253, 244, 0.85) !important;
      border-left: 4px solid #10b981 !important;
      border-top: 1px dashed #bbf7d0 !important;
      border-right: 1px dashed #bbf7d0 !important;
      border-bottom: 1px dashed #bbf7d0 !important;
    }
    .tf-fold-block.is-collapsed {
      background-color: rgba(241, 245, 249, 0.95) !important;
      border-left: 4px solid #64748b !important;
    }
    .tf-toggle-btn {
      border: 1px solid #a7f3d0 !important;
      background: #d1fae5 !important;
      color: #065f46 !important;
    }
    .tf-toggle-btn:hover {
      background: #a7f3d0 !important;
    }
  `,
  gold: `
    .tf-fold-block {
      background-color: rgba(254, 252, 232, 0.9) !important;
      border-left: 4px solid #f59e0b !important;
      border-top: 1px dashed #fef08a !important;
      border-right: 1px dashed #fef08a !important;
      border-bottom: 1px dashed #fef08a !important;
    }
    .tf-fold-block.is-collapsed {
      background-color: rgba(241, 245, 249, 0.95) !important;
      border-left: 4px solid #64748b !important;
    }
    .tf-toggle-btn {
      border: 1px solid #fde68a !important;
      background: #fef3c7 !important;
      color: #92400e !important;
    }
    .tf-toggle-btn:hover {
      background: #fde68a !important;
    }
  `
};

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
          if (chrome.runtime.lastError) { }
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
    elements.chkEnabled.checked = settings.isEnabled;
    elements.chkCollapseInitially.checked = settings.collapseInitially;
    elements.chkAutoSave.checked = settings.autoSave;
    elements.txtCustomCss.value = settings.customCss;

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
elements.chkEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ isEnabled: elements.chkEnabled.checked });
});

elements.chkCollapseInitially.addEventListener("change", () => {
  chrome.storage.local.set({ collapseInitially: elements.chkCollapseInitially.checked });
});

elements.chkAutoSave.addEventListener("change", () => {
  chrome.storage.local.set({ autoSave: elements.chkAutoSave.checked });
});

// 3. 监听主题选择
elements.themeCards.forEach((card) => {
  card.addEventListener("click", () => {
    const theme = card.dataset.theme;
    elements.themeCards.forEach((c) => c.classList.remove("active"));
    card.classList.add("active");

    const css = THEME_STYLES[theme] || THEME_STYLES.blue;
    elements.txtCustomCss.value = css;

    chrome.storage.local.set({ currentTheme: theme, customCss: css });
    broadcastCss(css);
    showTip("已切换外观主题");
  });
});

// 4. 二级抽屉展开/收起
elements.btnToggleCss.addEventListener("click", () => {
  const isOpen = elements.panelCustomCss.classList.toggle("open");
  elements.cssArrow.textContent = isOpen ? "▲" : "▼";
});

// 5. 应用自定义 CSS
elements.btnApplyCustomCss.addEventListener("click", () => {
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

// 6. 仅恢复当前页
elements.btnClearPage.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR_PAGE_FOLDS" }, () => {
        if (chrome.runtime.lastError) {
          showTip("当前页面不支持操作", false);
        } else {
          showTip("已恢复本页排版！", true);
        }
      });
    }
  });
});

// 7. 清空全网记忆历史
elements.btnClearAllHistory.addEventListener("click", () => {
  if (confirm("确定要清空所有网站的历史折叠记忆吗？\n所有打开页面的折叠将即时恢复原生排版。")) {
    chrome.storage.local.get(null, (allData) => {
      if (chrome.runtime.lastError) return;

      const keysToRemove = Object.keys(allData).filter((k) => k.startsWith("tf_store_"));
      chrome.storage.local.remove(keysToRemove, () => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { action: "CLEAR_PAGE_FOLDS" }, () => {
                if (chrome.runtime.lastError) { }
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
elements.btnConfigShortcuts.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.sendMessage({ action: "OPEN_SHORTCUTS_PAGE" });
});