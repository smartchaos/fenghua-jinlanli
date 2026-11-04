# 2026-11-05 修复记录：南路桥口 z-fighting 闪烁 + 渲染功耗

提交：`56b4dd8`（已推送，Pages 已上线）

## 问题现象

1. 南侧道路（南路/朱家坝路，z=150）与斜拉桥交接处画面总是闪烁。
2. 页面挂着手不动，电脑发热严重。

## 根因与修复

### 1. 闪烁 = z-fighting（canal.js）

运河两岸**驳岸**是贯通整条运河的矮墙：`BoxGeometry(7, 2.2, len)` 中心 y=0.7 → **顶面 y=1.8**，与斜拉桥桥面盒体顶面（y=1.0 + 1.6/2 = **1.8**）**精确共面**。桥位处两岸各有一块 ~7m×17m 的重合区（东岸 x -268..-261 那块正好在南路上桥口），相机一动脉冲深度抖动即闪烁。

修复：驳岸在桥位（z 138..162，对齐滨河绿带既有缺口）断开。

- 东岸：原 `[[-492,616],[331,938]]`（只留电厂河口缺口）→ `[[-492,616],[0,276],[481,638]]`
- 西岸：原单条 1600m 贯通 → `[[-331,938],[481,638]]` 两条

验证：场景探针扫描桥位区域，除桥面外不再有任何顶面 y=1.8 的网格。

### 2. 发热 = 渲染循环空转（app.js）

`animate()` 原先无条件 60fps 全场景渲染（2× 像素比 + 2048² PCFSoft 阴影 + 抗锯齿），闲置时也满负荷；且 `shadowMap.autoUpdate` 默认 true，静态场景每帧重算阴影贴图。

修复：

- **按需渲染**：新增 `needsRender` 标志。触发条件：controls `change` 事件（旋转/缩放/阻尼/自动巡览）、主题过渡（`themeT !== themeTarget`）、intro 生长动画、聚焦动画/选中环呼吸（`interaction.update()` 返回 `active`）、resize、面板开合（interaction 新增 `onChange` 回调）。闲置时主循环仍在跑（RAF 不能停，成本可忽略），但**零 `renderer.render` 调用**。
- **阴影冻结**：`renderer.shadowMap.autoUpdate = false`，仅 intro 期间 `needsUpdate = true`（楼体 scale.y 在动）。相机移动不改变静态场景的阴影，贴图一次渲染永久复用。

验证：包装 `renderer.render` 计数，闲置时 3 个强制帧 0 次渲染调用；相机移动渲染恰好 1 次。注意 headless Chromium 会节流 RAF，直接读 `renderer.info.render.frame` 不可靠，需用包装计数。

### 3. 附带：路面贴图各向异性（canal.js）

`roadTexMat` / `roadTexMatX` / 交叉口补丁的 CanvasTexture 未设 `anisotropy`（默认 1），而场地/立面贴图都用 `maxAniso`。掠射角下 3px 白色边线/虚线会摩尔纹 shimmer，与"桥口闪烁"观感叠加。修复：`createCanal(scene, renderer)` 传入 renderer，三处贴图设 `t.anisotropy = maxAniso`。

## 改动文件

| 文件 | 改动 |
|---|---|
| `app/src/three/canal.js` | 驳岸桥位缺口；路面/补丁贴图 anisotropy |
| `app/src/three/app.js` | 按需渲染；阴影冻结；`onChange` 回调接线 |
| `app/src/three/interaction.js` | `update()` 返回是否需持续渲染；`onChange` 钩子 |
| `model.html` | 构建产物（`npm run build` 同步） |

## 排错备忘（下次类似问题直接查）

- z-fighting 定位法：场景探针遍历 mesh 的 `boundingBox.applyMatrix4(matrixWorld)`，找距离 <2cm 的重合顶面；静态截图抓不到，要移动相机连拍 diff。
- 本仓库几何基准：桥面顶 y=1.8、驳岸顶 y=1.8、路面 y=0.025、交叉口补丁顶 y=0.035、东路路面 y=0.015、绿带 y=0.02、运河水 y=0.03。新增任何顶面落在 ±2cm 内的元素都会闪。
- 验证渲染是否真停：headless 下 RAF 被节流，`renderer.info.render.frame` 会假阳性/假阴性，必须包装 `renderer.render` 计数。
