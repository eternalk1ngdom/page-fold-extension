# 更新日志 (Changelog)

本项目的所有重要更改都将记录在此文件中。
版本号遵循 [语义化版本规范 (SemVer)](https://semver.org/lang/zh-CN/)。

---

## [1.0.2] - 2026-08-31

### 新增 (Added)
* **代码层级物理缩进对齐**：基于 `getBoundingClientRect` 计算物理坐标偏移量（`--tf-indent-offset`），折叠与展开多级嵌套代码时严格遵循原始代码递进关系，彻底解决代码行顶格错位问题。
* **严格单层平铺与嵌套防御**：在 `isSelectionSafe` 与嗅探引擎中增加硬性拦截，严禁在已折叠区域内部再创建子折叠块，杜绝 DOM 结构递归碎片化。
* **跨异构边界撕裂防御 (`isCrossBoundarySelection`)**：实时检测并拦截“代码块尾部 + 外部正文”的跨界框选，杜绝浏览器底层切割导致的 DOM 容器撕裂与黑框破坏。
* **语法高亮色彩完全隔离**：锁定折叠胶囊按钮独立中性色彩规范（`#e2e8f0` / `#334155`），防止在 Gemini 等平台的高亮注释或字符串（`hljs-string`、`token`）内折叠时按钮被染成绿色。
* **宿主文字色彩 100% 透传**：正文折叠容器全面采用 `color: inherit !important;`，移除系统暗色媒体查询对正文字色的强制覆盖，修复百度百科等纯白底网页黑字折叠后变白隐形的问题。
* **绝对字符坐标记忆与对齐恢复**：基于 URL 隔离存储与高精度字符坐标树（`charMap`），支持页面刷新及 SPA 路由切换后的阶梯式多阶段自动复原，确保不规则空白与多行文本定位零偏移。
* **局部代码框选保护**：引入 `isManualSelection` 标识，代码块内部划选局部代码时严格保持在划选内部，杜绝整块外壳被误卷入。

### 修复 (Fixed)
* **持久化复原错位与选区消失**：回滚粗粒度切片计算，修复规范化空白导致的 TextNode 真实偏移量失真问题，彻底解决百度百科与 AI 代码块刷新后折叠区域错位或消失的缺陷。
* **长会话操作主线程卡顿**：引入 `isInternalAction` 内部事件阻断锁，在插件执行折叠、解包与切换时暂时挂起 `MutationObserver` 重扫描，消除超长页面频繁 Reflow 造成的画面掉帧。
* **Kimi Token 结构缩进计算失效**：重构深层 Token 穿透与物理吸附逻辑，解决 Kimi 在 Prism.js 标签嵌套下丢失首行缩进的问题。
* **双重缩进叠加 Bug**：引入 `trimLeadingWhitespace`，自动剔除首行冗余空格，避免“外层 margin-left + 内部原生空格”导致的代码向右凸出。
* **多平台代码字号穿透膨胀**：通过穿透选择器将 DeepSeek、ChatGPT、Gemini 等平台的代码及子高亮 `<span>` 字号严格锁定在 $\le 12.5\text{px}$ 并注入等宽字体栈。
* **解包缩进与前置空格丢失**：移除 `restoreFold` 中的 `parent.normalize()`，改用 `DocumentFragment` 原位插回，保护 Python、Go 等依赖缩进的代码格式。
* **知乎大下边距断层**：通过 `:has()` 伪类在收起状态下消除知乎段落自带的 21px 边距，实现上下紧凑贴合。
* **CSS 优先级冲突**：修复基础样式中带 `!important` 的 margin 规则覆盖 JS 动态缩进的问题。

### 优化 (Changed)
* **代码可读性与架构注释全覆盖**：为 `CONFIG`、`DOMEngine`、`PersistenceManager` 及 `AppController` 补充规范的工程化逐模块注释，厘清生命周期调度。
* **不可折叠编辑区防御加固**：扩展 `CONFIG.SELECTORS.UNSAFE`，全面拦截 `[role='textbox']`、各类富文本输入框与全屏编辑器区域，防止输入法或打字时误触发。
* **选择器与清理算法精简**：统一代码块与正文选择器常量（`CONFIG.SELECTORS`），合并 `cleanEmptyGhostNodes` 前后向迭代逻辑，提升执行效率。
* **全场景综合真实靶场升级 (`test_fixture.html`)**：1:1 接入 DeepSeek、Kimi、Gemini、ChatGPT 真实 DOM 结构，集成字号防御、色彩防染色、严禁嵌套、白底字色透传、绝对坐标记忆复原 5 项自动化全量回归断言。