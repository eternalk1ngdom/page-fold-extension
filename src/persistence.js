/**
 * Text Folder - PersistenceManager
 * TreeWalker 绝对字符坐标树映射与无损持久化复原引擎 (核心生产冻结模块)
 */

const PersistenceManager = {
  localCacheRecords: [],
  isRestoring: false,

  getStorageKey: () => "tf_store_" + window.location.origin + decodeURIComponent(window.location.pathname) + window.location.search,

  async initCache() {
    const key = this.getStorageKey();
    const payload = (await Utils.getStorage([key]))[key];
    this.localCacheRecords = Array.isArray(payload?.data) ? payload.data : [];
  },

  registerFoldRecord(foldId, record) {
    if (!this.localCacheRecords) this.localCacheRecords = [];
    const idx = this.localCacheRecords.findIndex(r => r.id === foldId);
    idx >= 0 ? (this.localCacheRecords[idx] = record) : this.localCacheRecords.push(record);
    this.persistCache();
  },

  updateFoldStateOnly(foldId, isCollapsed) {
    if (!this.localCacheRecords) return;
    const item = this.localCacheRecords.find(r => r.id === foldId);
    if (item) {
      item.isCollapsed = isCollapsed;
      this.persistCache();
    }
  },

  removeFoldRecord(foldId) {
    if (!this.localCacheRecords) return;
    this.localCacheRecords = this.localCacheRecords.filter(r => r.id !== foldId);
    this.persistCache();
  },

  async persistCache() {
    const settings = await Utils.getStorage({ autoSave: CONFIG.DEFAULT_SETTINGS.autoSave });
    if (!settings?.autoSave) return;
    const key = this.getStorageKey();
    if (!this.localCacheRecords || !this.localCacheRecords.length) return Utils.removeStorage(key);
    await Utils.setStorage({ [key]: { updatedAt: Date.now(), data: this.localCacheRecords } });
  },

  findBestAnchorMatch(fullText, exact) {
    if (!exact || exact.length < 2) return null;

    const pos = fullText.indexOf(exact);
    if (pos !== -1) return { start: pos, end: pos + exact.length };

    const headLen = Math.min(30, Math.floor(exact.length / 2));
    const tailLen = Math.min(30, Math.floor(exact.length / 2));
    const head = exact.slice(0, headLen);
    const tail = exact.slice(-tailLen);

    let hPos = fullText.indexOf(head);
    while (hPos !== -1) {
      const estimatedTailPos = fullText.indexOf(tail, hPos);
      if (estimatedTailPos !== -1 && (estimatedTailPos - hPos) <= exact.length * 1.6) {
        return { start: hPos, end: estimatedTailPos + tail.length };
      }
      hPos = fullText.indexOf(head, hPos + 1);
    }
    return null;
  },

  async restorePageState() {
    if (this.isRestoring || UIState.isSendingMessage || UIState.isInternalAction) return false;
    const settings = await Utils.getStorage(CONFIG.DEFAULT_SETTINGS);
    if (!settings?.isEnabled || !settings?.autoSave || !this.localCacheRecords?.length) return false;

    const rootContainer = document.body;
    const existingIds = new Set(Array.from(rootContainer.querySelectorAll(`.${CONFIG.CLASSES.BLOCK}`)).map(el => el.dataset.tfId));
    const pending = this.localCacheRecords.filter(rec => !existingIds.has(rec.id));
    
    if (!pending.length) return true;

    this.isRestoring = true;
    try {
      const walker = document.createTreeWalker(rootContainer, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (node.parentElement?.closest(`script, style, .${CONFIG.CLASSES.BLOCK}, textarea, input, [data-writing-block-fullscreen-editor-region]`)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let fullText = "";
      const charMap = [];
      let node;
      while ((node = walker.nextNode())) {
        const raw = node.textContent;
        for (let i = 0; i < raw.length; i++) {
          const ch = raw[i];
          if (ch === "\u00a0" || /[ \t\r\n]/.test(ch)) {
            if (fullText.length === 0 || fullText[fullText.length - 1] !== " ") {
              fullText += " ";
              charMap.push({ node, offset: i });
            }
          } else {
            fullText += ch;
            charMap.push({ node, offset: i });
          }
        }
      }

      const tasks = [];
      pending.forEach(rec => {
        const match = this.findBestAnchorMatch(fullText, rec.exact);
        if (match && match.start < charMap.length && match.end <= charMap.length) {
          const sC = charMap[match.start];
          const eC = charMap[match.end - 1];
          if (sC && eC) {
            try {
              const range = document.createRange();
              range.setStart(sC.node, sC.offset);
              range.setEnd(eC.node, Math.min(eC.offset + 1, eC.node.textContent.length));
              if (DOMEngine.isSelectionSafe(range)) {
                tasks.push({ startIdx: match.start, range, id: rec.id, isCollapsed: rec.isCollapsed });
              }
            } catch (e) {}
          }
        }
      });

      if (tasks.length) {
        tasks.sort((a, b) => b.startIdx - a.startIdx);
        requestAnimationFrame(() => {
          tasks.forEach(t => DOMEngine.createFoldFromRange(t.range, t.isCollapsed, t.id, true));
        });
      }
    } finally {
      this.isRestoring = false;
    }
    return true;
  }
};