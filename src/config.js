/**
 * Text Folder - Config
 * 全局配置、样式常量与选择器白名单/黑名单定义 (生产冻结模块)
 */

const CONFIG = {
  CLASSES: {
    BLOCK: "tf-fold-block",
    COLLAPSED: "is-collapsed",
    HEADER: "tf-fold-header",
    BTN: "tf-toggle-btn",
    BODY: "tf-fold-body",
    FOLDED: "folded"
  },
  DEFAULT_SETTINGS: {
    isEnabled: true,
    collapseInitially: true,
    autoSave: false
  },
  TIMING: {
    OBSERVER_DEBOUNCE: 180,
    TYPING_LOCK: 1500,
    URL_POLL_INTERVAL: 500,
    RESTORE_DELAYS: [100, 400, 900, 1800, 3000]
  },
  UI: {
    LEFT_HOTZONE_WIDTH: 14
  },
  SELECTORS: {
    CODE: "pre, code, code-block, [class*='segment-code'], [class*='code-block'], [class*='code_block'], .md-code-block, .ds-code-box, .cm-content, .highlight",
    TEXT: "p, div.ds-markdown-paragraph, div.para, [class*='para'], li, blockquote, h1, h2, h3, h4, h5, h6",
    SAFE_EDITABLE: ".markdown, pre, code, code-block, .cm-content, message-content, [data-message-author-role], .ds-markdown, .model-response-text, .RichText",
    UNSAFE: [
      "canvas", "svg", "iframe", "video", "audio",
      ".monaco-editor", ".ace_editor",
      "#prompt-textarea",
      "[data-writing-block-fullscreen-editor-region]",
      "[role='textbox']",
      "input", "textarea", "select"
    ].join(",")
  }
};

const STYLES = {
  BASE: `
    .${CONFIG.CLASSES.BLOCK} {
      display: block !important;
      border-radius: 6px !important;
      padding: 6px 12px 8px ${CONFIG.UI.LEFT_HOTZONE_WIDTH}px !important;
      margin: 6px 0 !important;
      position: relative !important;
      box-sizing: border-box !important;
      width: 100% !important;
      clear: both !important;
      background-color: rgba(59, 130, 246, 0.06) !important;
      border-left: 3px solid #3b82f6 !important;
      border-top: 1px dashed rgba(59, 130, 246, 0.2) !important;
      border-right: 1px dashed rgba(59, 130, 246, 0.2) !important;
      border-bottom: 1px dashed rgba(59, 130, 246, 0.2) !important;
      color: inherit !important;
    }

    pre .${CONFIG.CLASSES.BLOCK},
    code .${CONFIG.CLASSES.BLOCK},
    code-block .${CONFIG.CLASSES.BLOCK},
    div[class*="code"] .${CONFIG.CLASSES.BLOCK},
    [class*="segment-code"] .${CONFIG.CLASSES.BLOCK},
    .md-code-block .${CONFIG.CLASSES.BLOCK},
    .ds-code-box .${CONFIG.CLASSES.BLOCK},
    .cm-content .${CONFIG.CLASSES.BLOCK} {
      width: calc(100% - var(--tf-indent-offset, 0px)) !important;
      background-color: transparent !important;
      border-top: none !important;
      border-right: none !important;
      border-bottom: none !important;
      border-left: 2px solid rgba(59, 130, 246, 0.5) !important;
      padding: 2px 0 2px 8px !important;
      margin-top: 2px !important;
      margin-bottom: 2px !important;
      margin-right: 0 !important;
      margin-left: var(--tf-indent-offset, 0px) !important;
      box-shadow: none !important;
      color: inherit !important;
    }

    pre .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    code .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    code-block .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    div[class*="code"] .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    [class*="segment-code"] .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    .md-code-block .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED},
    .ds-code-box .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} {
      background-color: transparent !important;
      border-left-color: #64748b !important;
      padding: 1px 0 !important;
      margin-top: 1px !important;
      margin-bottom: 1px !important;
      margin-right: 0 !important;
      margin-left: var(--tf-indent-offset, 0px) !important;
    }

    .${CONFIG.CLASSES.BLOCK}:not(.${CONFIG.CLASSES.COLLAPSED})::before {
      content: "" !important;
      position: absolute !important;
      top: 0 !important;
      left: -3px !important;
      width: ${CONFIG.UI.LEFT_HOTZONE_WIDTH}px !important;
      height: 100% !important;
      cursor: pointer !important;
      z-index: 15 !important;
    }
    .${CONFIG.CLASSES.BLOCK}:not(.${CONFIG.CLASSES.COLLAPSED}):hover {
      border-left-color: #2563eb !important;
    }

    .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} {
      padding: 2px 6px !important;
      margin: 2px 0 !important;
      background-color: rgba(100, 116, 139, 0.1) !important;
      border-left-color: #64748b !important;
    }
    .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} .${CONFIG.CLASSES.HEADER} {
      margin-bottom: 0 !important;
    }

    p:has(> .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED}),
    div:has(> .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED}) {
      margin-bottom: 2px !important;
    }

    .${CONFIG.CLASSES.BODY} code,
    .${CONFIG.CLASSES.BODY} pre,
    .${CONFIG.CLASSES.BODY} code-block,
    pre .${CONFIG.CLASSES.BODY},
    .${CONFIG.CLASSES.BODY} div[class*="code"],
    .${CONFIG.CLASSES.BODY} [class*="segment-code"],
    .${CONFIG.CLASSES.BODY} .md-code-block,
    .${CONFIG.CLASSES.BODY} .ds-code-box,
    .${CONFIG.CLASSES.BODY} .cm-content {
      font-family: "Google Sans Code", "Roboto Mono", "Fira Code", "Fira Mono", Menlo, Monaco, Consolas, "Cascadia Mono", "Ubuntu Mono", "DejaVu Sans Mono", "Liberation Mono", "JetBrains Mono", monospace !important;
      font-size: 12.5px !important;
      line-height: 1.6 !important;
    }

    .${CONFIG.CLASSES.BODY} pre *,
    .${CONFIG.CLASSES.BODY} code *,
    .${CONFIG.CLASSES.BODY} code-block *,
    .${CONFIG.CLASSES.BODY} div[class*="code"] *,
    .${CONFIG.CLASSES.BODY} [class*="segment-code"] *,
    .${CONFIG.CLASSES.BODY} .md-code-block *,
    .${CONFIG.CLASSES.BODY} .ds-code-box * {
      font-family: inherit !important;
      font-size: inherit !important;
      line-height: inherit !important;
    }

    .${CONFIG.CLASSES.BODY} pre,
    .${CONFIG.CLASSES.BODY} code-block,
    .${CONFIG.CLASSES.BODY} div[class*="code"],
    .${CONFIG.CLASSES.BODY} [class*="segment-code"],
    .${CONFIG.CLASSES.BODY} .md-code-block,
    .${CONFIG.CLASSES.BODY} .ds-code-box,
    pre .${CONFIG.CLASSES.BODY} {
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }

    .${CONFIG.CLASSES.BODY} p > code,
    .${CONFIG.CLASSES.BODY} li > code,
    .${CONFIG.CLASSES.BODY} span > code {
      display: inline-block !important;
      white-space: normal !important;
      padding: 0.15em 0.35em !important;
      font-size: 0.9em !important;
    }

    .${CONFIG.CLASSES.HEADER} {
      display: flex !important;
      align-items: center !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      margin-bottom: 4px !important;
    }

    .${CONFIG.CLASSES.BTN} {
      cursor: pointer !important;
      font-size: 12px !important;
      line-height: 1.2 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-weight: 500 !important;
      padding: 2px 8px !important;
      border-radius: 4px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      border: 1px solid rgba(125, 125, 125, 0.3) !important;
      background: rgba(125, 125, 125, 0.15) !important;
      color: #334155 !important;
      opacity: 0.95 !important;
      position: relative !important;
      z-index: 10 !important;
      pointer-events: auto !important;
      transition: all 0.15s ease !important;
      text-decoration: none !important;
      font-style: normal !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
    }
    .${CONFIG.CLASSES.BTN} * {
      color: inherit !important;
      font-style: normal !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
    }
    .${CONFIG.CLASSES.BTN}:hover {
      background: rgba(125, 125, 125, 0.25) !important;
      opacity: 1 !important;
    }

    pre .${CONFIG.CLASSES.BTN},
    code .${CONFIG.CLASSES.BTN},
    code-block .${CONFIG.CLASSES.BTN},
    div[class*="code"] .${CONFIG.CLASSES.BTN},
    [class*="segment-code"] .${CONFIG.CLASSES.BTN},
    .md-code-block .${CONFIG.CLASSES.BTN},
    .ds-code-box .${CONFIG.CLASSES.BTN},
    .cm-content .${CONFIG.CLASSES.BTN},
    [class*="hljs"] .${CONFIG.CLASSES.BTN},
    [class*="token"] .${CONFIG.CLASSES.BTN} {
      color: #e2e8f0 !important;
      background: rgba(255, 255, 255, 0.12) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
    }
    pre .${CONFIG.CLASSES.BTN}:hover,
    code .${CONFIG.CLASSES.BTN}:hover,
    code-block .${CONFIG.CLASSES.BTN}:hover,
    div[class*="code"] .${CONFIG.CLASSES.BTN}:hover,
    [class*="segment-code"] .${CONFIG.CLASSES.BTN}:hover,
    .md-code-block .${CONFIG.CLASSES.BTN}:hover,
    .ds-code-box .${CONFIG.CLASSES.BTN}:hover {
      background: rgba(255, 255, 255, 0.2) !important;
    }

    .${CONFIG.CLASSES.BODY}.${CONFIG.CLASSES.FOLDED} { display: none !important; }
    
    .${CONFIG.CLASSES.BODY} {
      display: block !important;
      margin-top: 4px !important;
      color: inherit !important;
    }

    @media (prefers-color-scheme: dark) {
      .${CONFIG.CLASSES.BLOCK} {
        background-color: rgba(255, 255, 255, 0.04) !important;
        border-left: 3px solid #60a5fa !important;
        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      .${CONFIG.CLASSES.BLOCK}.${CONFIG.CLASSES.COLLAPSED} {
        background-color: rgba(0, 0, 0, 0.3) !important;
        border-left: 3px solid #94a3b8 !important;
      }
      .${CONFIG.CLASSES.BLOCK}:not(.${CONFIG.CLASSES.COLLAPSED}):hover {
        border-left-color: #93c5fd !important;
      }
      .${CONFIG.CLASSES.BTN} {
        color: #e2e8f0 !important;
        background: rgba(255, 255, 255, 0.12) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      .${CONFIG.CLASSES.BTN}:hover {
        background: rgba(255, 255, 255, 0.2) !important;
      }
    }

    .${CONFIG.CLASSES.BODY} li { margin-left: 1.8em !important; padding-left: 0.2em !important; list-style-position: outside !important; }
    .${CONFIG.CLASSES.BODY} ol, .${CONFIG.CLASSES.BODY} ul { padding-left: 1.8em !important; margin: 4px 0 !important; }
    .${CONFIG.CLASSES.BODY} > *:first-child { margin-top: 0 !important; }
    .${CONFIG.CLASSES.BODY} > *:last-child { margin-bottom: 0 !important; }
  `
};