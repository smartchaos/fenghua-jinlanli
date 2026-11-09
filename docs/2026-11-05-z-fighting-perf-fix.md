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
- 本仓库几何基准：见下节「2026-11-09 分层表」。任意两个大面积重叠的水平上表面间距必须 ≥5cm；`scripts/check-depth.py` 为强制回归检查。
- 验证渲染是否真停：headless 下 RAF 被节流，`renderer.info.render.frame` 会假阳性/假阴性，必须包装 `renderer.render` 计数。

## 2026-11-09 补充：贴地平面层叠间距不足（缩小时小区地面闪烁）

### 现象与根因

用户报告「小区地面在缩小的时候会闪烁」。透视深度在 `near=1 / far=2000` 下，距离 `z` 处可分辨的世界间距约
`dz = (far-near)·z² / (far·near·(2²⁴-1))`：dist=400 时 0.95cm，dist=600 时 2.14cm，dist=620（`maxDistance`）时 2.29cm。
而平台顶 Box 顶面 `y=3.0`（`wilds.js`）与平台顶地块分片 `y=3.02`（`ground.js` 的 `SITE_LIFT + 0.02`）只差 **2cm**——近处够用，拉远就小于一个深度量化步长，整个小区地面开始与平台顶面竞争。这解释了为什么只在缩小时出现。

### 排查方法（已固化为脚本）

用世界 AABB（`boundingBox.applyMatrix4(matrixWorld)`）扫描所有**不透明、写深度、非 InstancedMesh** 的水平上表面，两两比较顶面 y 与 XZ 重叠面积；`scripts/check-depth.py` 以「Δtop <5cm 且重叠 >100」为风险判据。本次 RED 扫出 17 对，集中在两组：

1. 平台顶地面 `3.02` vs 平台 Box `3.0`（5 对，最大重叠面积 22437）与水景池岸 `3.05`（3 对）；
2. 底层贴地平面：`site` 底图 `0` 与东路路面 `0.015` / 南路 `0.025` / 桥面 `0.03` / 交叉口补丁 `0.035` / 电厂河水面 `0.06`，以及路面与补丁之间、电厂河与运河水面 `0.03` 之间，全部只有 1–6cm。

### 修复后分层（任意重叠对 Δ≥6cm）

| 层 | y | 来源 |
|---|---|---|
| 外围草甸 | -0.35 | `ground.js` |
| 运河水面 | -0.08 | `canal.js` |
| site 底图 | 0 | `ground.js` |
| 东路路面 / 桥面顶 / 电厂河水面 | 0.06（三者 XZ 不重叠） | `canal.js` / `ground.js` |
| 南路路面 | 0.12 | `canal.js` |
| 交叉口补丁顶 | 0.18 | `canal.js` |
| 平台 Box 顶 | 3.0 | `wilds.js` |
| 平台顶地块分片 | 3.10 | `ground.js` |
| 水景池岸 | 3.20 | `wilds.js` |
| 水景池水面 | 3.28 | `wilds.js` |

同步调整：`siteTexture.js` 的 `treeSpots` 抬到 `SITE_LIFT + 0.10`，避免树根陷入新地面；`canal.js` 交叉口补丁盒体加高到 0.24，保持底面埋入底图、顶面 0.18。

### 新增几何的约束

任何贴地平面/实体顶面都必须落在上表之外，或与其它大面积重叠表面保持 ≥5cm 间距；提交前跑 `python3 scripts/check-depth.py`（产物与源码各一次）。静态截图抓不到 z-fighting，判据以几何间距为准；透明且不写深度的贴花层（`city-green` / `city-roads`）不参与深度竞争，已从扫描中排除。
