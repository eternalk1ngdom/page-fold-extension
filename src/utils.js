/**
 * Text Folder - Utils
 * 通用 DOM 工具与 Chrome 扩展 API 异步封装 (生产冻结模块)
 */

const Utils = {
  getSafeElement: (node) => (!node ? null : (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement || null)),

  cleanText: (str) => (str || "").replace(/\u00a0/g, " ").replace(/[ \t\r\n]+/g, " ").trim(),

  async getStorage(keys) {
    if (!chrome.runtime?.id) return {};
    return new Promise(resolve => chrome.storage.local.get(keys, res => resolve(chrome.runtime.lastError ? {} : res)));
  },

  async setStorage(items) {
    if (!chrome.runtime?.id) return;
    return new Promise(resolve => chrome.storage.local.set(items, resolve));
  },

  async removeStorage(keys) {
    if (!chrome.runtime?.id) return;
    return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
  },

  sendMessage(msg) {
    if (!chrome.runtime?.id) return;
    try { chrome.runtime.sendMessage(msg, () => chrome.runtime.lastError); } catch (e) {}
  }
};