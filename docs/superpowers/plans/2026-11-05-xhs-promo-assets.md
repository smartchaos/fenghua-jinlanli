# 小红书推介素材 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, session 内执行).

**Goal:** 产出 8 张 3:4 小红书轮播图（1242×1660 PNG）+ 配套文案，推广业主入群 3D 可视化站点。

**Architecture:** headless Chrome 实拍 model.html/report.html 得底图 → HTML/CSS 排版模板合成终稿。执行方式：native（用户已在设计审批时明确"开工"）。

**Tech Stack:** puppeteer-core + chrome-headless-shell（本机已装，见 skill://puppeteer-core-headless-audit 接线）、bun run、macOS 系统字体 PingFang SC、sips 缩放。

**Spec:** docs/2026-11-05-xhs-promo-design.md

## Global Constraints

- 终稿规格：1242×1660（3:4）PNG；合成在 2484×3320 下完成，结尾统一 sips 缩到 1242×1660。
- 图中禁止微信群二维码；尾页只放网址 + 评论/私信引导。
- 场景截图必须来自真实渲染（model.html 的 window.__MODEL），不得用 shots/theme/ 旧图。
- 页面 UI 覆盖层（TopBar/Legend/Panel 等）不得入镜。
- 文案逐字以 spec 的素材构成表为准。

## Review Focus

- 按需渲染陷阱：闲置停绘时截图拿到旧帧——每次摆机位后必须等 renderer.render 计数器自增再截（skill 已记录的坑）。
- intro 生长动画未结束就拍，楼体是扁的——等 introDone（楼体 scale.y==1 且相机归位）再开拍。
- portrait 3:4 与默认横屏构图差异大——HOME 机位在 portrait 下需实测取景，必要时拉远。
- 夜雾 450 起雾：远景机位超 500m 会被雾洗掉，逐镜头核像素亮度。
- report.html 截图不得包含任何个人信息列（该页本就不含 members.csv，截前仍核一遍 DOM 文本）。

---

### Task 1: 拍摄底图

**Files:**
- Create: `marketing/xhs/shoot.mjs`

**Interfaces:**
- Produces: `marketing/xhs/raw/{cover-night,facade-night,day-low,split-day,split-night,bridge-night}.png`、`marketing/xhs/raw/report.png`（均 2484×3320）

- [ ] **Step 1: 验证 chrome-headless-shell 存在**（glob `~/.cache/puppeteer/chrome-headless-shell/*/.../chrome-headless-shell`，缺失则按 skill 从 npmmirror 装）
- [ ] **Step 2: 写 shoot.mjs**：puppeteer-core 按 skill 接线；viewport 1242×1660 dsf=2；file:// 打开 model.html（--allow-file-access-from-files）；等 `window.__MODEL`；注入 render 计数器；运行时隐藏 canvas 之外所有 UI 元素；等 introDone
- [ ] **Step 3: 六个机位逐镜拍摄**：每镜 `camera.position.set/target.set` + `controls.dispatchEvent({type:'change'})` → 轮询 `__RC` 自增 → screenshot。机位：cover=HOME(-190,265,340→-70,5,0)；facade=页内算 joined 最多的楼，距 ~75m；day-low=日景低角(-240,130,330)；split 对=同 cover 机位日夜各一张（applyTheme(day,true) 瞬时切）；bridge=(-240,35,300→-350,10,150)。report.html 另开页截 1242×1660
- [ ] **Step 4: 校验底图**：7 张均存在；PIL 核每张非全黑（均亮 >8）且画面有内容（方差 >100）；肉眼逐张过目构图

### Task 2: 排版合成终稿

**Files:**
- Create: `marketing/xhs/compose.html`、`marketing/xhs/compose.mjs`

**Interfaces:**
- Consumes: Task 1 的 raw/*.png
- Produces: `marketing/xhs/final/01-cover.png` … `08-cta.png`（1242×1660）

- [ ] **Step 1: compose.html 三类版式**：封面（大字主标+副标）、内容页（顶部标题条+整图+底部贴纸句）、尾页（引导+网址）。统一样式：深色渐变压底、PingFang SC 800、强调色 #FFD966；第 7 页用 cover-night 高斯模糊做底
- [ ] **Step 2: compose.mjs 注入文案逐页截图**（2484×3320），脚本断言：无水平溢出、文字节点均在视口内（getBoundingClientRect）
- [ ] **Step 3: sips 缩放到 1242×1660**
- [ ] **Step 4: 逐张肉眼过目**（视觉缺陷当场修版式）

### Task 3: 文案交付

**Files:**
- Create: `marketing/xhs/copy.md`（标题/正文/标签，逐字来自 spec）

- [ ] **Step 1: 写 copy.md**
- [ ] **Step 2: 汇总交付**：final/ 8 张 + copy.md 路径清单报给用户
