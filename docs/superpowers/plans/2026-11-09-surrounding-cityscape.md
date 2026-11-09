# 周边城市 3D 化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在小区四周以程序化 3D 几何补出街区楼群、路网、绿化带、高架与远景城市剪影，使 HOME 与旋转视角都能看到参考航拍图里的城市环境。

**Architecture:** 新增单一职责模块 `app/src/three/cityscape.js`，导出 `createCityscape(scene)` 返回 `{ group, stats }`；`app.js` 装配一次并把返回值挂到现有 `api` 的新增字段上，供浏览器测试断言。楼体用 `InstancedMesh` 按街区网格确定性生成，颜色与贴图经 `regColor` / `themedMats` 接入既有日夜主题；不触碰阴影、雾、相机与按需渲染逻辑。

**Tech Stack:** three 0.187.0（ESM，`THREE.ColorManagement.enabled = false`）、Vite 5 + `vite-plugin-singlefile`、React 18、Node 24、Playwright(Python) + Google Chrome headless。

**Spec:** [docs/superpowers/specs/2026-11-09-surrounding-cityscape-design.md](../specs/2026-11-09-surrounding-cityscape-design.md)

## Global Constraints

以下数值逐字来自 spec，每个任务隐含遵守：

- 工作分支 `feat/3d-surrounding-cityscape`；**不自动 commit**。每个任务的最后一步只做全量校验并把改动留在工作区，需要提交时由用户明确指示。
- 场地常量：`SITE_W=240, SITE_D=360`，`RX=110`，`RZ=150`，`SITE_LIFT=3.0`（`app/src/three/constants.js:2-4`）。
- 相机 `Perspective(40, …, 1, 2000)`，HOME `(-190,265,340)`，`minDistance=80`、`maxDistance=620`、`maxPolarAngle=0.485π` —— **不改动**。
- 雾 夜 `450/900`、日 `560/1350` —— **不改动**；城市主体落在 900 以内，远景剪影放在 900–1300 并接受雾化。
- 阴影 PCFSoft 2048²、shadow camera ±230、`shadowMap.autoUpdate=false` —— **不改动**；所有新增几何 `castShadow=false`、`receiveShadow=false`。
- 按需渲染：闲置 `renderer.render` 调用为 0 —— 不新增 RAF 回调、不新增逐帧更新。
- 环带分段：近环 250–450 密度 0.75、中环 450–700 密度 0.5、远环 700–900 密度 0.25；街区网格 60 单位。
- 禁建区：小区 `|x|<140 且 |z|<210`、运河 `x ∈ [-460,-240]`、顾扬路 `|x-110|<25`、朱家坝路 `|z-150|<25`、电厂河 `|z+161|<28`、6 座丘陵与 7 组远山的底面圆盘、船与护坡树所在区域。
- 贴地平面统一 `y=-0.30`；不与 `y=0 / 0.02 / 0.06 / 1.8 / 3.0` 共面；高架桥面 `y≈8`。
- 预算：≤12 个 `InstancedMesh`、≤20 个额外 draw call、`model.html` 增量 ≤60KB。
- 沿用 `app/src/three/wilds.js:70` 的「低饱和, 不抢焦点」约定；不引入外部图片/模型资源。
- 不动：小区楼群、琥珀/蓝窗数据编码、楼名标签、点击/悬停/巡览、日夜模式、用户未提交的数据与文档改动。
- 复用接口：`mulberry32` 来自 `app/src/three/rng.js`；`regColor` / `regNum` / `flatMat` / `themedMats` / `grainOverlay` / `setThemedMaps` 来自 `app/src/three/theme.js`（`flatMat(nightHex, dayHex, opts)`、`grainOverlay(g, w, h, strength)`）。

## File Structure

| 文件 | 职责 |
| --- | --- |
| `app/src/three/cityscape.js`（新建） | 唯一职责：街区布局、禁建区判定、四类楼体 InstancedMesh、立面 CanvasTexture、路网/绿化/高架/远景剪影，导出 `createCityscape(scene)` |
| `app/src/three/app.js`（修改） | 仅两处：import 与 `createWilds` 之后的一次装配；`api` 新增 `cityscape` 字段 |
| `scripts/check-cityscape.py`（新建） | Playwright 浏览器断言：实例数、禁建区、楼型、材质、共面、draw call、闲置零渲染 |
| `model.html`（生成物） | 只在 Task 4 由 `npm --prefix app run build` 同步，禁止手改 |
| `app/src/three/rng.js` / `theme.js` / `constants.js` / `siteTexture.js` | 只读参考与复用，不修改 |

`stats` 契约（所有任务一致）：
```js
{
  placed: number,          // 实际落位实例总数（含远景剪影）
  rejected: number,        // 被禁建区或密度拒绝的候选数
  byType: { slab: number, tower: number, podium: number, landmark: number, silhouette: number },
  instances: [ { x, z, type, w, d, h } ]   // 每个已落位实例，供断言复核
}
```

## 前置：启动本地服务（一次性）

- [ ] 启动 Vite dev server，后续每个任务都用它跑浏览器断言：

```bash
cd app && npm run dev -- --host 127.0.0.1 --port 5173
```

- [ ] 确认服务可用：`curl -s --retry 20 --retry-delay 1 --retry-connrefused -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/`

Existing baseline（切分支时已验证通过，供对照）：`node scripts/check-model.mjs`、`node scripts/validate-layout.mjs`、`python3 scripts/check-realism.py "file:///Users/leerobbin/game/spax/model.html"`。

---

### Task 1: 生成器骨架与禁建区判定

**Files:**
- Create: `app/src/three/cityscape.js`
- Modify: `app/src/three/app.js`（import 区、场景装配区、`api` 对象）
- Test: `scripts/check-cityscape.py`

**Interfaces:**
- Consumes: `mulberry32` from `./rng.js`；`SITE_W, SITE_D, RX, RZ` from `./constants.js`；`flatMat` from `./theme.js`。
- Produces: `createCityscape(scene)` → `{ group, stats }`，字段契约见 File Structure；`window.__MODEL.cityscape` 可访问该对象。

- [ ] **Step 1: 写失败测试**

创建 `scripts/check-cityscape.py`：
```python
#!/usr/bin/env python3
"""浏览器内验收周边城市生成器。用法: python3 scripts/check-cityscape.py [url]"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173/"

PROBE = r"""() => {
  const c = window.__MODEL && window.__MODEL.cityscape;
  if (!c || !c.stats) return { ready: false };
  const s = c.stats;
  const hills = [[330,-350,120],[450,150,140],[300,470,130],
                 [-95,590,150],[-660,-640,170],[560,480,130]];
  const mtns = [[-805,-575,260],[288,-874,300],[805,-483,240],[897,230,260],
                [575,782,280],[-518,874,300],[-909,345,260]];
  const disc = (x,z,cx,cz,r) => Math.hypot(x-cx,z-cz) < r;
  const forbidden = (x,z) =>
    (Math.abs(x) < 140 && Math.abs(z) < 210) ||
    (x > -460 && x < -240) ||
    Math.abs(x - 110) < 25 ||
    Math.abs(z - 150) < 25 ||
    Math.abs(z + 161) < 28 ||
    hills.some(h => disc(x,z,h[0],h[1],h[2])) ||
    mtns.some(m => disc(x,z,m[0],m[1],m[2]));
  return {
    ready: true,
    placed: s.placed,
    rejected: s.rejected,
    bad: s.instances.filter(i => forbidden(i.x, i.z)).length,
  };
}"""

def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=[
            "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text)
                if m.type == "error" and "Failed to load resource" not in m.text else None)
        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_function("window.__MODEL && window.__MODEL.scene", timeout=60000)
        page.wait_for_timeout(2600)
        result = page.evaluate(PROBE)
        browser.close()
    print("city probe:", result)
    checks = {
        "城市生成器已装配": result.get("ready") is True,
        "至少 80 栋落位": result.get("placed", 0) >= 80,
        "禁建区零命中": result.get("bad", 999) == 0,
        "无 JS 报错": not errors,
    }
    for name, ok in checks.items():
        print(("PASS " if ok else "FAIL ") + name)
    if errors:
        print("errors:", errors[:5])
    sys.exit(0 if all(checks.values()) else 1)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 scripts/check-cityscape.py`
Expected: `FAIL 城市生成器已装配`（`window.__MODEL.cityscape` 尚不存在，probe 返回 `{ready:false}`）。

- [ ] **Step 3: 写最小实现**

创建 `app/src/three/cityscape.js`：
```js
import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { SITE_W, SITE_D, RX, RZ } from './constants.js';
import { flatMat } from './theme.js';

const CITY = {
  cell: 60,
  rings: [[250, 450, 0.75], [450, 700, 0.5], [700, 900, 0.25]],
  silhouette: [900, 1300],
  seed: 20261109,
};

const HILLS = [[330,-350,120],[450,150,140],[300,470,130],
               [-95,590,150],[-660,-640,170],[560,480,130]];
const MTNS = [[-805,-575,260],[288,-874,300],[805,-483,240],[897,230,260],
              [575,782,280],[-518,874,300],[-909,345,260]];

/* 禁建区：小区/运河/两条主干道/电厂河/丘陵/远山 */
export function isForbidden(x, z){
  if(Math.abs(x) < 140 && Math.abs(z) < 210) return true;
  if(x > -460 && x < -240) return true;
  if(Math.abs(x - RX) < 25) return true;
  if(Math.abs(z - RZ) < 25) return true;
  if(Math.abs(z + 161) < 28) return true;
  const disc = (cx, cz, r) => Math.hypot(x-cx, z-cz) < r;
  if(HILLS.some(h => disc(h[0], h[1], h[2]))) return true;
  if(MTNS.some(m => disc(m[0], m[1], m[2]))) return true;
  return false;
}

function generate(rnd){
  const instances = [];
  let rejected = 0;
  for(const [r0, r1, density] of CITY.rings){
    const n = Math.ceil(r1 / CITY.cell);
    for(let ix = -n; ix <= n; ix++){
      for(let iz = -n; iz <= n; iz++){
        const x = ix * CITY.cell + (rnd() - .5) * 18;
        const z = iz * CITY.cell + (rnd() - .5) * 18;
        const r = Math.hypot(x, z);
        if(r < r0 || r >= r1) continue;
        if(rnd() > density){ rejected++; continue; }
        if(isForbidden(x, z)){ rejected++; continue; }
        const w = 14 + rnd() * 16, d = 12 + rnd() * 12, h = 18 + rnd() * 27;
        instances.push({ x, z, type: 'slab', w, d, h });
      }
    }
  }
  return { instances, rejected };
}

export function createCityscape(scene){
  const group = new THREE.Group();
  group.name = 'cityscape';
  const rnd = mulberry32(CITY.seed);
  const { instances, rejected } = generate(rnd);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = flatMat(0x2b323b, 0xb9b6ab);
  const mesh = new THREE.InstancedMesh(geo, mat, instances.length);
  const m4 = new THREE.Matrix4();
  instances.forEach((it, i) => {
    m4.makeScale(it.w, it.h, it.d);
    m4.setPosition(it.x, it.h / 2, it.z);
    mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  scene.add(group);

  const byType = { slab: instances.length, tower: 0, podium: 0, landmark: 0, silhouette: 0 };
  const stats = { placed: instances.length, rejected, byType, instances };
  return { group, stats };
}
```

修改 `app/src/three/app.js`：
1. import 区追加 `import { createCityscape } from './cityscape.js';`
2. `createWilds(canalGrp);` 之后追加 `const cityscape = createCityscape(scene);`
3. `api` 对象追加字段：
```js
  const api = {
    D, openPanel: openPanelById, closePanel, resetView, setTour, applyTheme, dispose,
    scene, canalGrp, renderer, camera, controls, cityscape
  };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python3 scripts/check-cityscape.py`
Expected: 4 项全 PASS，`placed >= 80`、`bad == 0`。若 `placed` 不足，调大 `CITY.rings` 密度或缩小 `CITY.cell`，不得放宽断言。

- [ ] **Step 5: 全量回归并留在工作区（不提交）**

```bash
node scripts/check-model.mjs && node scripts/validate-layout.mjs && python3 scripts/check-realism.py
```
Expected: 三项全通过。不要执行 `git commit`。

---

### Task 2: 四类楼体、立面贴图与主题注册

**Files:**
- Modify: `app/src/three/cityscape.js`（`generate` 类型分派、材质构建）
- Test: `scripts/check-cityscape.py`（追加断言）

**Interfaces:**
- Consumes: Task 1 的 `CITY` / `isForbidden` / `createCityscape`；`regColor`、`themedMats`、`grainOverlay` from `./theme.js`。
- Produces: `stats.byType` 五个字段均为有效计数；`group` 内含 4 个带贴图的 `InstancedMesh`；立面材质已注册进 `themedMats`，随 `setThemedMaps(day)` 切换 `map`。

- [ ] **Step 1: 追加失败测试**

在 `scripts/check-cityscape.py` 的 `PROBE` 里，把 `return` 对象替换为：
```js
  const types = {};
  let instanced = 0, textured = 0;
  c.group.traverse(o => {
    if(o.isInstancedMesh){ instanced++; if(o.material.map && o.material.map.image) textured++; }
  });
  const m = window.__MODEL;
  const before = c.group.children.find(o => o.isInstancedMesh).material.map;
  m.applyTheme(false, true);
  const night = c.group.children.find(o => o.isInstancedMesh).material.map;
  m.applyTheme(true, true);
  const day = c.group.children.find(o => o.isInstancedMesh).material.map;
  return {
    ready: true,
    placed: s.placed,
    rejected: s.rejected,
    bad: s.instances.filter(i => forbidden(i.x, i.z)).length,
    byType: s.byType,
    instanced,
    textured,
    themeSwitches: before !== night && night !== day,
  };
```
并在 `checks` 字典追加：
```python
        "四类楼型齐备": all(result.get("byType", {}).get(k, 0) > 0
                         for k in ("slab", "tower", "podium", "landmark")),
        "至少 4 个 InstancedMesh": result.get("instanced", 0) >= 4,
        "楼体材质带贴图": result.get("textured", 0) >= 4,
        "日夜切换更换贴图": result.get("themeSwitches") is True,
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 scripts/check-cityscape.py`
Expected: `FAIL 四类楼型齐备`（当前只有 `slab`）、`FAIL 至少 4 个 InstancedMesh`。

- [ ] **Step 3: 写最小实现**

在 `cityscape.js` 顶部把 import 改为：
```js
import { regColor, flatMat, themedMats, grainOverlay } from './theme.js';
```

追加立面贴图与材质工厂：
```js
function makeFacadeTexture(day){
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = day ? '#c3c0b6' : '#333b45'; g.fillRect(0, 0, 512, 512);
  for(let row = 0; row < 16; row++){
    const y = row * 32;
    g.fillStyle = day ? 'rgba(72,84,94,.55)' : 'rgba(12,18,26,.65)';
    for(let col = 0; col < 12; col++) g.fillRect(col * 42 + 6, y + 8, 30, 16);
    g.fillStyle = day ? 'rgba(255,255,255,.18)' : 'rgba(150,180,210,.10)';
    g.fillRect(0, y + 2, 512, 2);
  }
  grainOverlay(g, 512, 512, 0.55);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeBuildingMaterial(){
  const m = new THREE.MeshStandardMaterial({
    map: makeFacadeTexture(false), roughness: 0.72, metalness: 0.06,
  });
  m.userData.nightTex = m.map;
  m.userData.dayTex = makeFacadeTexture(true);
  themedMats.push(m);
  regColor(m.color, 0x8f959c, 0xd8d5ca);
  return m;
}
```

把 `generate` 里的类型分派改为（替换 `instances.push({ x, z, type: 'slab', w, d, h });` 一行）：
```js
        const roll = rnd();
        let type, w, d, h;
        if(roll < .06 && r < 700){ type = 'landmark'; w = 16 + rnd()*8; d = 16 + rnd()*8; h = 80 + rnd()*40; }
        else if(roll < .30){ type = 'tower'; w = 18 + rnd()*8; d = 16 + rnd()*8; h = 45 + rnd()*35; }
        else if(roll < .48){ type = 'podium'; w = 30 + rnd()*18; d = 22 + rnd()*14; h = 8 + rnd()*6; }
        else { type = 'slab'; w = 14 + rnd()*16; d = 12 + rnd()*12; h = 18 + rnd()*27; }
        instances.push({ x, z, type, w, d, h });
```

把 `createCityscape` 里单 mesh 的构建替换为按类型分组：
```js
  const byType = { slab: 0, tower: 0, podium: 0, landmark: 0, silhouette: 0 };
  instances.forEach(it => { byType[it.type]++; });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4();
  for(const type of ['slab', 'tower', 'podium', 'landmark']){
    const list = instances.filter(it => it.type === type);
    if(!list.length) continue;
    const mesh = new THREE.InstancedMesh(geo, makeBuildingMaterial(), list.length);
    mesh.name = 'city-' + type;
    list.forEach((it, i) => {
      m4.makeScale(it.w, it.h, it.d);
      m4.setPosition(it.x, it.h / 2, it.z);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
```
并删除原来那段创建单个 `mesh` 与 `byType` 字面量的代码，保留 `scene.add(group)` 与 `return { group, stats }`，其中 `stats` 改为：
```js
  const stats = { placed: instances.length, rejected, byType, instances };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python3 scripts/check-cityscape.py`
Expected: 8 项全 PASS。若 `landmark` 为 0，放宽其判定范围（例如 `r < 800` 或阈值 `.06 → .10`），不得放宽断言。

- [ ] **Step 5: 全量回归并留在工作区（不提交）**

```bash
python3 scripts/check-realism.py && node scripts/check-model.mjs
```
Expected: 全通过；不执行 `git commit`。

---

### Task 3: 街区路网、绿化、高架与远景剪影

**Files:**
- Modify: `app/src/three/cityscape.js`
- Test: `scripts/check-cityscape.py`（追加断言）

**Interfaces:**
- Consumes: Task 2 的 `CITY` / `isForbidden` / `generate` / `createCityscape`；`flatMat` / `regColor` from `./theme.js`。
- Produces: `group` 内含 `city-roads`（`y=-0.30` 贴地平面）、`city-green`（`y=-0.30`）、`city-viaduct`（桥面 `y≈8` + 桥墩）、`city-silhouette`（`InstancedMesh`）；`stats.byType.silhouette > 0` 且剪影实例同样通过 `isForbidden`。

- [ ] **Step 1: 追加失败测试**

在 `PROBE` 中，把 `const m = window.__MODEL;` 之前插入：
```js
  const named = o => c.group.getObjectByName(o);
  const roads = named('city-roads');
  const green = named('city-green');
  const viaduct = named('city-viaduct');
  const silhouette = named('city-silhouette');
  const planeYs = [];
  c.group.traverse(o => { if(o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry')
    planeYs.push(Math.round(o.position.y * 100) / 100); });
```
并把 `return` 对象追加：
```js
    roadsY: roads ? Math.round(roads.position.y * 100) / 100 : null,
    greenY: green ? Math.round(green.position.y * 100) / 100 : null,
    viaductY: viaduct ? Math.round(viaduct.position.y * 100) / 100 : null,
    silhouette: silhouette ? silhouette.count : 0,
    forbiddenYs: planeYs.filter(y => [0, 0.02, 0.06, 1.8, 3.0].includes(y)),
```
在 `checks` 追加：
```python
        "路网/绿化在 y=-0.30": result.get("roadsY") == -0.30 and result.get("greenY") == -0.30,
        "高架在 y≈8": result.get("viaductY") is not None and abs(result["viaductY"] - 8) < 0.5,
        "远景剪影存在": result.get("silhouette", 0) > 0,
        "无既有共面 y 值": result.get("forbiddenYs") == [],
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 scripts/check-cityscape.py`
Expected: `FAIL 路网/绿化在 y=-0.30`、`FAIL 高架在 y≈8`、`FAIL 远景剪影存在`（这些对象尚不存在）。

- [ ] **Step 3: 写最小实现**

在 `cityscape.js` 追加四个构造函数：
```js
function makeRoadsMesh(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = 'rgba(62,64,66,.85)'; g.lineWidth = 14;
  for(let i = 0; i <= 8; i++){
    const p = i * 128;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(1024, p); g.stroke();
  }
  g.strokeStyle = 'rgba(230,228,216,.55)'; g.lineWidth = 2; g.setLineDash([18, 22]);
  for(let i = 0; i <= 8; i++){
    const p = i * 128;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(1024, p); g.stroke();
  }
  g.setLineDash([]);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  /* 与 city-green 同处 y=-0.30: 用 polygonOffset 避免两层贴地平面共面闪烁 */
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.30;
  mesh.name = 'city-roads';
  mesh.renderOrder = 1;
  return mesh;
}

function makeGreenMesh(){
  const mat = flatMat(0x16251a, 0x6e855f);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.30;
  mesh.name = 'city-green';
  mesh.renderOrder = 0;
  return mesh;
}

function makeViaduct(){
  /* Group 自身位于 y=8: 测试直接读 group.position.y, 桥面/桥墩用相对坐标 */
  const grp = new THREE.Group(); grp.name = 'city-viaduct';
  grp.position.y = 8;
  const deckMat = flatMat(0x1a1e24, 0x8c8d88);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1500, 0.8, 12), deckMat);
  deck.position.set(0, 0, -300);
  deck.castShadow = false; deck.receiveShadow = false;
  grp.add(deck);
  const pierMat = flatMat(0x20242b, 0x9a9a94);
  const pierGeo = new THREE.BoxGeometry(3, 7.6, 3);
  for(let x = -720; x <= 720; x += 60){
    const p = new THREE.Mesh(pierGeo, pierMat);
    p.position.set(x, -4, -300);
    p.castShadow = false; p.receiveShadow = false;
    grp.add(p);
  }
  return grp;
}

function makeSilhouette(rnd){
  const list = [];
  for(let i = 0; i < 260; i++){
    const a = rnd() * Math.PI * 2;
    const r = CITY.silhouette[0] + rnd() * (CITY.silhouette[1] - CITY.silhouette[0]);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(isForbidden(x, z)) continue;
    list.push({ x, z, type: 'silhouette', w: 12 + rnd()*16, d: 12 + rnd()*16, h: 20 + rnd()*30 });
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f6b78, roughness: 1 });
  regColor(mat.color, 0x1d2632, 0x8b98a6);
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.name = 'city-silhouette';
  const m4 = new THREE.Matrix4();
  list.forEach((it, i) => {
    m4.makeScale(it.w, it.h, it.d);
    m4.setPosition(it.x, it.h / 2, it.z);
    mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  return { mesh, list };
}
```

在 `createCityscape` 里，`const { instances, rejected } = generate(rnd);` 之后插入：
```js
  const sil = makeSilhouette(rnd);
  const all = instances.concat(sil.list);
```
把后续所有 `instances` 引用改为 `all`（`stats.placed`、`stats.instances`、`byType` 统计、四类分组构建）；`byType` 用 `all.forEach(it => byType[it.type]++)` 统计，因此 `byType.silhouette` 自动等于剪影数，不要另行赋值。在 `scene.add(group)` 之前追加：
```js
  group.add(makeGreenMesh());
  group.add(makeRoadsMesh());
  group.add(makeViaduct());
  group.add(sil.mesh);
```
`makeViaduct()` 返回的 `Group` 自身在 `y=8`，因此 `viaduct.position.y === 8` 可直接被断言；桥面世界 y=8，桥墩顶 y=7.8，与桥面底 y=7.6 有 0.2 重叠但不共面。

- [ ] **Step 4: 跑测试确认通过**

Run: `python3 scripts/check-cityscape.py`
Expected: 12 项全 PASS，`bad == 0`（剪影也过了禁建区判定）、`forbiddenYs == []`。

- [ ] **Step 5: 全量回归并留在工作区（不提交）**

```bash
python3 scripts/check-realism.py && node scripts/check-model.mjs && node scripts/validate-layout.mjs
```
Expected: 全通过；不执行 `git commit`。

---

### Task 4: 性能预算、视角验证与产物同步

**Files:**
- Modify: `scripts/check-cityscape.py`（追加性能断言）
- Generated: `model.html`（仅由 build 生成）

**Interfaces:**
- Consumes: Task 1–3 的 `window.__MODEL.cityscape` / `api.renderer`。
- Produces: 全部浏览器断言在 dev server 与 `file://` 构建产物上都通过；四视角截图落到 `/tmp/city-*.png`。

- [ ] **Step 1: 追加失败测试**

把 `PROBE` 声明改为 `PROBE = r"""async () => { … }"""`（`page.evaluate` 会 await 返回的 promise）。在 `const m = window.__MODEL;` 之后、`return` 之前插入：
```js
  m.renderer.render(m.scene, m.camera);
  const withCity = m.renderer.info.render.calls;
  c.group.visible = false;
  m.renderer.render(m.scene, m.camera);
  const without = m.renderer.info.render.calls;
  c.group.visible = true;
  const delta = withCity - without;

  m.applyTheme(true, true);
  await new Promise(r => setTimeout(r, 600));
  let idle = 0;
  const wrapped = m.renderer.render;
  m.renderer.render = (...a) => { idle++; return wrapped(...a); };
  await new Promise(r => setTimeout(r, 1200));
  m.renderer.render = wrapped;
```
在 `return` 对象追加：
```js
    drawDelta: delta,
    idleRenders: idle,
```
在 `checks` 追加：
```python
        "draw call 增量 ≤20": result.get("drawDelta", 999) <= 20,
        "闲置零渲染": result.get("idleRenders", 999) == 0,
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 scripts/check-cityscape.py`
Expected: 若 Task 1–3 已满足预算，这两项会直接 PASS；此时必须证明断言能抓到回归——在 `cityscape.js` 的 `createCityscape` 里临时追加 25 个可见 mesh：
```js
  for(let i = 0; i < 25; i++) group.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), flatMat(0x333333, 0x999999)));
```
重跑应得到 `FAIL draw call 增量 ≤20`（`drawDelta ≈ 25+`）。删除这段临时代码后再跑，确认 PASS。不要放宽断言阈值。

- [ ] **Step 3: 修正实现使断言通过**

保持 Task 1–3 的实现不额外增加 mesh；若 `drawDelta > 20`，把 `city-green` 与 `city-roads` 合并为单张 CanvasTexture 的一个平面。若 `idleRenders > 0`，确认 `applyTheme(true, true)` 已把 `themeT` 推到目标值、且 PROBE 未改动相机（damping 残留会触发一次渲染）；不得关闭按需渲染或放宽断言。

- [ ] **Step 4: 四视角截图人工比对**

```bash
python3 - <<'PY'
from playwright.sync_api import sync_playwright
HOME="(() => { const m=window.__MODEL; m.camera.position.set(-190,265,340); m.controls.target.set(-70,5,0); m.controls.update(); })()"
EAST="(() => { const m=window.__MODEL; m.camera.position.set(180,120,80); m.controls.target.set(35,18,-10); m.controls.update(); })()"
SOUTH="(() => { const m=window.__MODEL; m.camera.position.set(-40,150,-420); m.controls.target.set(0,10,0); m.controls.update(); })()"
views=[("home",HOME,True),("east",EAST,True),("south",SOUTH,True),("night",HOME,False)]
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome",args=["--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg=b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://127.0.0.1:5173/",wait_until="load",timeout=60000)
    pg.wait_for_function("window.__MODEL && window.__MODEL.cityscape",timeout=60000)
    pg.wait_for_timeout(2600)
    for name,js,day in views:
        pg.evaluate(f"window.__MODEL.applyTheme({'true' if day else 'false'},true)")
        pg.evaluate(js); pg.wait_for_timeout(900)
        pg.screenshot(path=f"/tmp/city-{name}.png")
        print("saved /tmp/city-"+name+".png")
    b.close()
PY
```
对照 `ref/plan1.png`：南侧应能看到隔电厂河的住宅群、东侧商务高层、北侧密集住宅、西侧沿河绿地；楼群明度低于小区立面；远景在雾中淡出。

- [ ] **Step 5: 构建并全量验证（不提交）**

```bash
npm --prefix app run build
node scripts/check-model.mjs
node scripts/validate-layout.mjs
python3 scripts/check-realism.py "file:///Users/leerobbin/game/spax/model.html"
python3 scripts/check-cityscape.py "file:///Users/leerobbin/game/spax/model.html"
git status --short
```
Expected: build 退出码 0、产物同步；两条浏览器脚本全 PASS；`git status` 显示新增/修改文件但**无 commit**。若 `model.html` 增量超过 60KB，减少 `makeFacadeTexture` 画布到 256² 或合并贴图后重建。

---

## 执行期修正记录（2026-11-09）

计划复核与实际截图比对后，实现相对原计划有以下必要偏离，均为满足 Global Constraints：

- **桥墩改 InstancedMesh**：原计划 25 个独立 `Mesh` 会直接突破「≤20 draw call」预算；改为 1 个 `InstancedMesh`，实测 `drawDelta=10`。
- **贴地平面去 polygonOffset**：负偏移会让 `city-roads` 盖过水面；改为 green/roads 都用 `transparent + depthWrite:false` 并靠 `renderOrder` 定序，深度测试自然被水面剔除。
- **绿化改镂空 + 日夜双贴图**：整片纯色平面会盖掉草甸颗粒，且夜间仍显亮绿；改为程序化半透明绿化斑并注册 `themedMats`。
- **楼群视觉打磨**：细化路网（线宽 14→5、颜色变浅）、楼群压暗降对比、整体降一档楼高、地标限制在 420–900 环带、街区密度提高（`cell` 60→46）、新增 `city-base` 接地基座。
- **测试脚本修正**：包装 `renderer.render` 时必须 `bind(renderer)`，否则 `this` 丢失导致每帧抛错；headless Chrome 需加 `--disable-background-timer-throttling` 等参数，并延长稳定等待到 2500ms（file:// 产物加载比 dev server 慢，1500ms 会残留一次启动尾帧），才能让「闲置零渲染」在源码与产物两侧都稳定为 0。
- **性能断言有效性**：以浏览器临时注入 25 个 mesh 验证 `drawDelta` 从 10 涨到 34（>20，断言会 FAIL），未改动源码；注入移除后正式断言保持全绿。

## 自检结果

- **Spec coverage**：环带与密度 → Task 1；禁建区 → Task 1 测试与实现；四类楼体与立面贴图/主题 → Task 2；路网/绿化/高架/远景剪影与共面避让 → Task 3；性能预算、四视角、构建产物、既有脚本不回归 → Task 4；不动项写入 Global Constraints 且每个任务都跑既有回归。
- **Placeholder scan**：无 TBD / TODO / "implement later" / "similar to Task N"；每个代码步骤均含可运行代码块。
- **Type consistency**：`createCityscape(scene) → { group, stats }`、`stats.placed / rejected / byType / instances`、`isForbidden(x, z)`、`makeFacadeTexture(day)`、`makeBuildingMaterial()`、`makeSilhouette(rnd)` 在 Task 1–4 中名称与字段一致；`window.__MODEL.cityscape` 由 Task 1 定义、Task 2–4 消费；`m.renderer` / `m.scene` / `m.camera` 来自 `api`。
