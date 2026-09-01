/**
 * Text Folder - AppController
 * 扩展生命周期启动入口、全局事件监听与消息调度
 */

const AppController = {
  customStyleEl: null,
  domObserver: null,
  observerTimer: null,
  lastUrl: window.location.href,

  initStyles() {
    const baseStyle = document.createElement("style");
    baseStyle.textContent = STYLES.BASE;
    document.head.appendChild(baseStyle);

    this.customStyleEl = document.createElement("style");
    document.head.appendChild(this.customStyleEl);

    Utils.getStorage({ customCss: "" }).then(res => {
      if (res?.customCss && !res.customCss.includes("rgba(239, 246, 255")) {
        this.customStyleEl.textContent = res.customCss;
      }
    });
  },

  updateDeepSelection() {
    let sel = window.getSelection();
    let range = (sel && !sel.isCollapsed && sel.rangeCount > 0) ? sel.getRangeAt(0) : null;
    if (!range && document.activeElement?.shadowRoot) {
      sel = document.activeElement.shadowRoot.getSelection?.();
      range = (sel && !sel.isCollapsed && sel.rangeCount > 0) ? sel.getRangeAt(0) : null;
    }
    UIState.cachedRange = (range && DOMEngine.isSelectionSafe(range)) ? range.cloneRange() : null;
    return UIState.cachedRange;
  },

  async syncContextMenu(e) {
    const settings = await Utils.getStorage(CONFIG.DEFAULT_SETTINGS);
    if (!settings?.isEnabled) return;
    
    UIState.rightClickedElement = Utils.getSafeElement(e.target);
    const foldTarget = UIState.rightClickedElement?.closest(`.${CONFIG.CLASSES.BLOCK}`);
    const effectiveRange = DOMEngine.smartSniffTargetRange(UIState.rightClickedElement, this.updateDeepSelection());

    Utils.sendMessage({
      action: "UPDATE_MENU_TITLE",
      title: foldTarget ? "取消该折叠区域" : (effectiveRange ? "设置为可折叠区域" : "当前区域不可折叠")
    });
  },

  async executeCreateFold(targetRange, isManualSelection = false) {
    if (!targetRange) return;
    const settings = await Utils.getStorage(CONFIG.DEFAULT_SETTINGS);
    if (!settings?.isEnabled) return;

    DOMEngine.createFoldFromRange(targetRange, settings.collapseInitially, null, isManualSelection);
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    UIState.clearSelectionCache();
  },

  bindMouseEvents() {
    document.addEventListener("mouseover", e => UIState.lastHoveredElement = Utils.getSafeElement(e.target), true);
    document.addEventListener("mouseup", () => this.updateDeepSelection(), true);
    document.addEventListener("pointerdown", e => {
      if (e.button === 2) {
        this.updateDeepSelection();
        this.syncContextMenu(e);
      }
    }, true);
    document.addEventListener("contextmenu", e => this.syncContextMenu(e), true);
  },

  bindKeyboardEvents() {
    document.addEventListener("keyup", () => this.updateDeepSelection(), true);
    document.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && Utils.getSafeElement(e.target)?.closest("textarea, input, [contenteditable='true']")) {
        UIState.lockTyping();
      }
    }, true);
  },

  bindClickEvents() {
    document.addEventListener("click", e => {
      const targetEl = Utils.getSafeElement(e.target);
      
      if (targetEl?.closest("button[data-testid='send-button'], button[aria-label='发送提示词'], form button[type='submit']")) {
        UIState.lockTyping();
      }

      const toggleBtn = targetEl?.closest(`.${CONFIG.CLASSES.BTN}`);
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        DOMEngine.toggleFoldBlock(toggleBtn.closest(`.${CONFIG.CLASSES.BLOCK}`), false);
        return;
      }

      const foldBlock = targetEl?.closest(`.${CONFIG.CLASSES.BLOCK}`);
      if (foldBlock && !foldBlock.classList.contains(CONFIG.CLASSES.COLLAPSED)) {
        if (e.clientX >= foldBlock.getBoundingClientRect().left - 4 && e.clientX <= foldBlock.getBoundingClientRect().left + CONFIG.UI.LEFT_HOTZONE_WIDTH) {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            DOMEngine.toggleFoldBlock(foldBlock, true);
          }
        }
      }
    }, true);
  },

  bindExtensionMessages() {
    chrome.runtime?.onMessage?.addListener((req, sender, sendResponse) => {
      const hasManualRange = !!UIState.cachedRange;
      const activeRange = DOMEngine.smartSniffTargetRange(UIState.lastHoveredElement, this.updateDeepSelection());
      
      switch (req.action) {
        case "TRIGGER_CONTEXT_ACTION":
          const foldWrapper = UIState.rightClickedElement?.closest(`.${CONFIG.CLASSES.BLOCK}`);
          if (foldWrapper) DOMEngine.restoreFold(foldWrapper);
          else if (activeRange) this.executeCreateFold(activeRange, hasManualRange);
          break;
        case "COMMAND_FOLD":
          if (activeRange) this.executeCreateFold(activeRange, hasManualRange);
          break;
        case "COMMAND_RESTORE":
          DOMEngine.restoreFold(UIState.lastHoveredElement?.closest(`.${CONFIG.CLASSES.BLOCK}`));
          break;
        case "CLEAR_PAGE_FOLDS":
          PersistenceManager.localCacheRecords = [];
          Utils.removeStorage(PersistenceManager.getStorageKey());
          document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`).forEach(w => DOMEngine.restoreFold(w));
          break;
        case "APPLY_CUSTOM_CSS":
          if (this.customStyleEl) this.customStyleEl.textContent = req.css;
          break;
      }
      sendResponse?.({ success: true });
      return true;
    });

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.isEnabled) {
          if (changes.isEnabled.newValue === false) {
            document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`).forEach(w => DOMEngine.restoreFold(w));
          } else if (changes.isEnabled.newValue === true) {
            PersistenceManager.restorePageState();
          }
        }
      });
    }
  },

  initDOMObserver() {
    this.domObserver = new MutationObserver(mutations => {
      if (window.location.href !== this.lastUrl) {
        this.lastUrl = window.location.href;
        document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`).forEach(w => DOMEngine.restoreFold(w));
        PersistenceManager.initCache().then(() => PersistenceManager.restorePageState());
        return;
      }

      if (UIState.isInternalAction || PersistenceManager.isRestoring || UIState.isSendingMessage || !PersistenceManager.localCacheRecords?.length) return;

      const existingIds = new Set(Array.from(document.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`)).map(el => el.dataset.tfId));
      if (!PersistenceManager.localCacheRecords.some(rec => !existingIds.has(rec.id))) return;

      if (!mutations.some(m => !Utils.getSafeElement(m.target)?.closest(`.${CONFIG.CLASSES.BLOCK}`))) return;

      clearTimeout(this.observerTimer);
      this.observerTimer = setTimeout(() => PersistenceManager.restorePageState(), CONFIG.TIMING.OBSERVER_DEBOUNCE);
    });

    this.domObserver.observe(document.body, { childList: true, subtree: true });
  },

  start() {
    this.initStyles();
    this.bindMouseEvents();
    this.bindKeyboardEvents();
    this.bindClickEvents();
    this.bindExtensionMessages();
    this.initDOMObserver();
    
    const triggerPageRestore = () => {
      PersistenceManager.initCache().then(() => {
        if (!PersistenceManager.localCacheRecords.length) return;
        CONFIG.TIMING.RESTORE_DELAYS.forEach(delay => setTimeout(() => PersistenceManager.restorePageState(), delay));
      });
    };

    triggerPageRestore();

    window.addEventListener("popstate", triggerPageRestore);
    window.addEventListener("hashchange", triggerPageRestore);

    setInterval(() => {
      if (window.location.href !== this.lastUrl) {
        this.lastUrl = window.location.href;
        triggerPageRestore();
      }
    }, CONFIG.TIMING.URL_POLL_INTERVAL);
  }
};

// 启动应用
AppController.start();