/**
 * Text Folder - UIState
 * 全局共享状态、选区缓存与操作锁管理器 (生产冻结模块)
 */

const UIState = {
  rightClickedElement: null,
  lastHoveredElement: null,
  cachedRange: null,
  isSendingMessage: false,
  isInternalAction: false,

  clearSelectionCache() {
    this.cachedRange = null;
  },

  lockTyping() {
    this.isSendingMessage = true;
    setTimeout(() => { this.isSendingMessage = false; }, CONFIG.TIMING.TYPING_LOCK);
  }
};