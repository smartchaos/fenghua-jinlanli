import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './rng.js';
import { WORLD_HALF } from './constants.js';
import { regColor, flatMat, themedMats, grainOverlay } from './theme.js';
import { asphaltMaterial, roadSurfaceMaterial } from './roads.js';
import SURROUNDINGS from './surroundings.json';

const CITY = {
  cell: 46,
  rings: [[180, 600, 0.86], [600, 1100, 0.62], [1100, 1600, 0.36]],
  silhouette: [1600, 2100],
  seed: 20261110,
};

const CANAL = SURROUNDINGS.meta.canal;
const EXTENT = SURROUNDINGS.meta.extent;
const VIADUCT_Z = SURROUNDINGS.meta.viaductZ;
const COMPOUNDS = SURROUNDINGS.compounds;
const ROADS = SURROUNDINGS.roads;
const WATERS = SURROUNDINGS.waters;
const GREEN_ZONES = SURROUNDINGS.greenZones || [];
const CLEAR_ZONES = SURROUNDINGS.clearZones || [];
const PLANT = SURROUNDINGS.powerPlant || null;

/* ---------- 几何判定 ---------- */
function pointInPoly(x, z, poly){
  let inside = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(x, z, x0, z0, x1, z1){
  const vx = x1 - x0, vz = z1 - z0;
  const L2 = vx * vx + vz * vz;
  const t = L2 ? Math.max(0, Math.min(1, ((x - x0) * vx + (z - z0) * vz) / L2)) : 0;
  return Math.hypot(x - (x0 + t * vx), z - (z0 + t * vz));
}

function polyHit(x, z, poly, pad = 0){
  if(pointInPoly(x, z, poly)) return true;
  if(pad > 0){
    return pointInPoly(x + pad, z, poly) || pointInPoly(x - pad, z, poly) ||
           pointInPoly(x, z + pad, poly) || pointInPoly(x, z - pad, poly);
  }
  return false;
}

function hitsStatic(x, z, w, d){
  const r = Math.max(w, d) / 2;
  if(Math.abs(x - CANAL.center) < CANAL.width / 2 + r + 8) return true;
  if(Math.abs(z - VIADUCT_Z) < 8 + r) return true;
  for(const road of ROADS){
    if(segDist(x, z, road.x0, road.z0, road.x1, road.z1) < road.w / 2 + r + 4) return true;
  }
  for(const water of WATERS){
    if(segDist(x, z, water.x0, water.z0, water.x1, water.z1) < water.w / 2 + r + 4) return true;
  }
  const pad = Math.max(w, d) / 2 + 4;
  for(const comp of COMPOUNDS){
    if(polyHit(x, z, comp.poly, pad)) return true;
  }
  for(const g of GREEN_ZONES){
    if(polyHit(x, z, g.poly, pad)) return true;
  }
  for(const g of CLEAR_ZONES){
    if(polyHit(x, z, g.poly, pad)) return true;
  }
  if(PLANT && polyHit(x, z, PLANT.poly, pad)) return true;
  if(PLANT && PLANT.auxPoly && polyHit(x, z, PLANT.auxPoly, pad)) return true;
  return false;
}

/* 禁建区：小区本体 / 运河 / 真实小区 / 绿地 / 主干道 / 电厂河 / 高架 */
export function isForbidden(x, z){
  if(Math.abs(x) < 140 && Math.abs(z) < 210) return true;
  if(Math.abs(x - CANAL.center) < CANAL.width / 2 + 40) return true;
  if(Math.abs(z - VIADUCT_Z) < 26) return true;
  for(const comp of COMPOUNDS){
    if(pointInPoly(x, z, comp.poly)) return true;
  }
  for(const g of GREEN_ZONES){
    if(pointInPoly(x, z, g.poly)) return true;
  }
  for(const g of CLEAR_ZONES){
    if(pointInPoly(x, z, g.poly)) return true;
  }
  if(PLANT && pointInPoly(x, z, PLANT.poly)) return true;
  if(PLANT && PLANT.auxPoly && pointInPoly(x, z, PLANT.auxPoly)) return true;
  for(const road of ROADS){
    if(segDist(x, z, road.x0, road.z0, road.x1, road.z1) < road.w / 2 + 8) return true;
  }
  for(const water of WATERS){
    if(segDist(x, z, water.x0, water.z0, water.x1, water.z1) < water.w / 2 + 8) return true;
  }
  return false;
}

/* ---------- 立面图集 ----------
 * 512² 拆成 2×2 格，四个部位各用一格，单材质单贴图即可实现材质分区：
 *   0 幕墙(左上) / 1 金属翅片与实墙(右上) / 2 屋面(左下) / 3 基座首层(右下)
 * 配色对齐 Hy4 企鹅岛样例的「白银建筑 + 蓝灰玻璃」主色调，夜间转冷灰蓝并亮少量窗。 */
function makeFacadeTexture(day, maxAniso){
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  const hash = i => { const v = Math.sin(i * 78.233) * 43758.5453; return v - Math.floor(v); };
  const tile = (i, draw) => {
    g.save();
    g.translate((i % 2) * 256, Math.floor(i / 2) * 256);
    g.beginPath(); g.rect(0, 0, 256, 256); g.clip();
    draw(g); g.restore();
  };

  /* 0 幕墙：竖向银白铝板 + 横向蓝灰玻璃带 */
  tile(0, q => {
    q.fillStyle = day ? '#d9dedb' : '#3b4650'; q.fillRect(0, 0, 256, 256);
    for(let row = 0; row < 10; row++){
      const y = row * 25.6;
      const grd = q.createLinearGradient(0, y + 6, 0, y + 19);
      if(day){ grd.addColorStop(0, '#b9cbd6'); grd.addColorStop(.45, '#8fa6b4'); grd.addColorStop(1, '#728c9c'); }
      else { grd.addColorStop(0, '#2c3d4b'); grd.addColorStop(.5, '#1d2c38'); grd.addColorStop(1, '#111c26'); }
      q.fillStyle = grd; q.fillRect(0, y + 6, 256, 13);
      q.fillStyle = day ? 'rgba(255,255,255,.30)' : 'rgba(160,195,225,.10)';
      q.fillRect(0, y + 6, 256, 2);
      q.fillStyle = day ? 'rgba(70,84,94,.35)' : 'rgba(0,0,0,.45)';
      q.fillRect(0, y + 19, 256, 2);
    }
    q.fillStyle = day ? 'rgba(255,255,255,.55)' : 'rgba(150,175,195,.12)';
    for(let c = 0; c < 8; c++) q.fillRect(c * 32, 0, 3, 256);
    if(!day){
      for(let i = 0; i < 26; i++){
        const c = Math.floor(hash(i * 3) * 8), r = Math.floor(hash(i * 3 + 1) * 10);
        q.fillStyle = `rgba(255,196,112,${(.25 + hash(i * 3 + 2) * .5).toFixed(2)})`;
        q.fillRect(c * 32 + 4, r * 25.6 + 7, 24, 10);
      }
    }
    q.fillStyle = day ? 'rgba(255,255,255,.07)' : 'rgba(180,210,240,.04)';
    q.beginPath(); q.moveTo(0, 0); q.lineTo(90, 0); q.lineTo(0, 256); q.closePath(); q.fill();
  });

  /* 1 金属翅片/实体墙：细竖棱 + 中部高光 */
  tile(1, q => {
    const grd = q.createLinearGradient(0, 0, 256, 0);
    if(day){ grd.addColorStop(0, '#e9ece8'); grd.addColorStop(.5, '#f6f7f4'); grd.addColorStop(1, '#cdd4d0'); }
    else { grd.addColorStop(0, '#4d5963'); grd.addColorStop(.5, '#697681'); grd.addColorStop(1, '#3e4953'); }
    q.fillStyle = grd; q.fillRect(0, 0, 256, 256);
    q.fillStyle = day ? 'rgba(90,105,110,.16)' : 'rgba(215,232,245,.09)';
    for(let c = 0; c < 16; c++) q.fillRect(c * 16, 0, 1.5, 256);
    q.fillStyle = day ? 'rgba(255,255,255,.32)' : 'rgba(200,225,245,.07)';
    q.fillRect(64, 0, 6, 256);
  });

  /* 2 屋面：混凝土灰 + 设备块投影 */
  tile(2, q => {
    q.fillStyle = day ? '#aeb3ae' : '#333b42'; q.fillRect(0, 0, 256, 256);
    q.fillStyle = day ? 'rgba(70,78,80,.20)' : 'rgba(10,15,20,.35)';
    q.fillRect(0, 0, 256, 3); q.fillRect(0, 253, 256, 3);
    for(let i = 0; i < 9; i++){
      const x = 12 + hash(i * 5) * 210, y = 16 + hash(i * 5 + 1) * 205, w = 18 + hash(i * 5 + 2) * 30;
      q.fillStyle = day ? 'rgba(75,82,84,.28)' : 'rgba(12,18,24,.45)';
      q.fillRect(x + w * .08, y + w * .12, w, w * .7);
      q.fillStyle = day ? '#c8cdc8' : '#4a555e';
      q.fillRect(x, y, w, w * .7);
    }
  });

  /* 3 基座首层：深色石材 + 通高玻璃橱窗 */
  tile(3, q => {
    q.fillStyle = day ? '#798187' : '#242c34'; q.fillRect(0, 0, 256, 256);
    const grd = q.createLinearGradient(0, 40, 0, 190);
    if(day){ grd.addColorStop(0, '#9fb4c0'); grd.addColorStop(1, '#5e7482'); }
    else { grd.addColorStop(0, '#2a3b48'); grd.addColorStop(1, '#16212b'); }
    q.fillStyle = grd; q.fillRect(8, 40, 240, 150);
    q.fillStyle = day ? 'rgba(60,70,76,.55)' : 'rgba(8,12,16,.70)';
    for(let c = 0; c < 7; c++) q.fillRect(8 + c * 40, 40, 4, 150);
    q.fillStyle = day ? 'rgba(255,255,255,.18)' : 'rgba(255,186,110,.16)';
    q.fillRect(8, 40, 240, 4);
    q.fillStyle = day ? 'rgba(255,255,255,.10)' : 'rgba(255,190,120,.10)';
    q.fillRect(0, 196, 256, 60);
  });

  grainOverlay(g, 512, 512, 0.5);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  /* 掠射角下拉远时 512² 图集的 16~32px 细条纹会摩尔纹 shimmer；
   * 与路网贴图一致用设备上限，不能固定写 4。 */
  t.anisotropy = maxAniso;
  return t;
}

function makeBuildingMaterial(maxAniso){
  const m = new THREE.MeshStandardMaterial({
    map: makeFacadeTexture(false, maxAniso), roughness: 0.62, metalness: 0.16,
  });
  m.userData.nightTex = m.map;
  m.userData.dayTex = makeFacadeTexture(true, maxAniso);
  themedMats.push(m);
  regColor(m.color, 0xa9b3bd, 0xf1f3f0);
  return m;
}

/* ---------- 建筑形态原型 ----------
 * 参照 Hy4「企鹅岛数字沙盘」：云状抬升体块、错落塔楼+参数化金属翅片、
 * 锯齿错位住宅+共享退台、阶梯收分塔。把原来「单个长方体+一张条纹贴图」
 * 换成有体量层级（基座/主体/退台/冠部/翅片）的复合原型。
 * 几何归一到单位体 (x,z∈[-.5,.5], y∈[-.5,.5])，由 InstancedMesh 按 (w,h,d) 缩放，
 * 仍是每类一次 draw call；所有部件 footprint ≤1，不越出原有禁建区判定范围。
 * 注意：setInst() 会把实例中心放在 y=h/2，因此原型底部必须是 -0.5，
 * 否则整栋楼会被抬高 h/2、悬在空中。 */
const TILE_WALL = 0, TILE_FIN = 1, TILE_ROOF = 2, TILE_BASE = 3;
/* 外围草甸 y=-0.35 / 绿地叠加层 y=-0.30；楼体再下沉 0.5m 扎进地面，杜绝底边露缝 */
const GROUND_SINK = -0.5;

function archetypePart(w, h, d, x, y, z, tile){
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const u0 = (tile % 2) * 0.5 + 0.008;
  const v0 = (tile < 2 ? 0.5 : 0) + 0.008;   /* canvas 上半对应 v∈[.5,1] */
  for(let i = 0; i < uv.count; i++){
    uv.setXY(i, u0 + uv.getX(i) * 0.484, v0 + uv.getY(i) * 0.484);
  }
  uv.needsUpdate = true;
  g.translate(x, y, z);
  return g;
}

/* 各相邻体块竖向交叠 ≥0.006(≈楼高 0.2m)，避免接缝共面 z-fighting；
 * 翅片凸出立面 0.02(≈0.5m)，由真实几何产生阴影线，不再靠贴图假竖棱。 */
function archetype(kind){
  const P = [];
  const add = (w, h, d, x, y, z, t) => P.push(archetypePart(w, h, d, x, y, z, t));
  const W = TILE_WALL, F = TILE_FIN, R = TILE_ROOF, B = TILE_BASE;
  if(kind === 'slab' || kind === 'residential'){
    /* 板楼住宅：基座 / 主体 / 顶部退台 / 檐板 / 竖翅或阳台挑板 */
    add(1.00, 0.10, 1.00, 0, 0.05, 0, B);
    add(0.98, 0.80, 0.98, 0, 0.50, 0, W);
    add(0.86, 0.11, 0.86, 0, 0.945, 0, W);
    add(0.90, 0.025, 0.90, 0, 1.005, 0, R);
    if(kind === 'residential'){
      for(let k = 0; k < 3; k++){
        const y = 0.30 + k * 0.22;
        add(1.00, 0.016, 0.055, 0, y, 0.505, F);
        add(1.00, 0.016, 0.055, 0, y, -0.505, F);
      }
    }else{
      for(let i = -1; i <= 1; i++){
        add(0.042, 0.77, 0.024, i * 0.29, 0.50, 0.497, F);
        add(0.042, 0.77, 0.024, i * 0.29, 0.50, -0.497, F);
      }
    }
  }else if(kind === 'tower'){
    /* 错落塔楼：裙房基座 / 主塔 / 收分冠 / 塔尖 / 参数化金属竖翅 */
    add(1.00, 0.13, 1.00, 0, 0.065, 0, B);
    add(0.88, 0.75, 0.88, 0, 0.50, 0, W);
    add(0.64, 0.11, 0.64, 0, 0.925, 0, W);
    add(0.68, 0.024, 0.68, 0, 0.985, 0, R);
    add(0.09, 0.075, 0.09, 0, 1.025, 0, F);
    for(const x of [-0.33, -0.11, 0.11, 0.33]){
      add(0.034, 0.73, 0.026, x, 0.50, 0.446, F);
      add(0.034, 0.73, 0.026, x, 0.50, -0.446, F);
    }
  }else if(kind === 'podium'){
    /* 低层裙房：横向体量 + 屋面抬升体块 + 采光带 + 首层玻璃带 */
    add(1.00, 0.12, 1.00, 0, 0.06, 0, B);
    add(0.98, 0.60, 0.98, 0, 0.41, 0, W);
    add(1.00, 0.03, 1.00, 0, 0.715, 0, R);
    add(0.56, 0.26, 0.60, 0, 0.84, 0, W);
    add(0.60, 0.024, 0.64, 0, 0.975, 0, R);
    add(1.00, 0.055, 0.03, 0, 0.19, 0.498, F);
    for(const z of [-0.30, 0.30]){
      add(0.14, 0.02, 0.50, -0.30, 0.735, z, F);
      add(0.14, 0.02, 0.50, 0.30, 0.735, z, F);
    }
  }else{ /* landmark：三级阶梯收分塔 + 角部竖翅 + 塔尖 */
    add(1.00, 0.09, 1.00, 0, 0.045, 0, B);
    add(0.94, 0.42, 0.94, 0, 0.30, 0, W);
    add(0.76, 0.28, 0.76, 0, 0.645, 0, W);
    add(0.56, 0.18, 0.56, 0, 0.865, 0, W);
    add(0.32, 0.05, 0.32, 0, 0.975, 0, R);
    add(0.08, 0.09, 0.08, 0, 1.035, 0, F);
    for(const x of [-0.36, 0.36]) add(0.03, 0.40, 0.03, x, 0.30, 0.47, F);
  }
  const geo = mergeGeometries(P);
  P.forEach(p => p.dispose());
  geo.translate(0, -0.5, 0);        /* [0,1] → [-.5,.5]，底面精确落在 y=0 */
  return geo;
}

/* 白银/冷灰/暖灰的轻微色差，打散「一片同色积木」的重复感 */
const TINTS = [0xffffff, 0xe9eeec, 0xf2ede4, 0xdde7ea, 0xf0f1ee];
function tintInstances(mesh, list){
  const c = new THREE.Color();
  list.forEach((it, i) => {
    const k = Math.abs(Math.round(it.x * 7 + it.z * 13 + i * 31)) % TINTS.length;
    mesh.setColorAt(i, c.setHex(TINTS[k]));
  });
  if(mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/* ---------- 真实小区楼群 ---------- */
function heightFor(kind, floors){
  if(kind === '洋房') return floors * 3.2 + 1.4;
  return 4.4 + (floors - 1) * 3.05 + 1.4;
}

function realInstances(){
  const list = [];
  for(const comp of COMPOUNDS){
    for(const b of comp.buildings){
      list.push({
        x: b.x, z: b.z, w: b.w, d: b.d, h: heightFor(comp.kind, b.f),
        rot: (b.rot || 0) * Math.PI / 180,
        type: 'real', kind: comp.kind, group: comp.id, real: true,
      });
    }
  }
  return list;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function setInst(mesh, i, x, z, w, h, d, rot){
  _e.set(0, rot || 0, 0); _q.setFromEuler(_e);
  _v.set(x, h / 2, z); _s.set(w, h, d);
  _m4.compose(_v, _q, _s);
  mesh.setMatrixAt(i, _m4);
}

function makeRealMesh(list, maxAniso){
  const mesh = new THREE.InstancedMesh(
    archetype('residential'), makeBuildingMaterial(maxAniso), list.length);
  mesh.name = 'city-real';
  mesh.position.y = GROUND_SINK;
  list.forEach((it, i) => setInst(mesh, i, it.x, it.z, it.w, it.h, it.d, it.rot));
  mesh.instanceMatrix.needsUpdate = true;
  tintInstances(mesh, list);
  mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}

/* ---------- 真实路网: 双向四车道, 逐条贴图 ----------
 * 全路网同一顶高 0.26（高于东路 0.06 / 南路 0.16 / 电厂河水面 ≥10cm）；
 * 南北向在每条东西向城市路处断开、与其路缘齐平衔接, 交叉口不再叠面 */
function makeRoads(maxAniso){
  const list = ROADS.filter(r => r.render);
  if(!list.length) return null;
  const grp = new THREE.Group(); grp.name = 'city-roads';
  const asphalt = asphaltMaterial();
  const TOP = 0.26, DEPTH = 0.70;               // 底面 -0.44, 沉入草甸(-0.35)以下不悬空
  const ewRoads = list.filter(r => r.x0 !== r.x1);
  const add = (cx, cz, w, L, alongU) => {
    const geo = new THREE.BoxGeometry(alongU ? L : w, DEPTH, alongU ? w : L);
    const m = new THREE.Mesh(geo,
      [asphalt, asphalt, roadSurfaceMaterial(L, alongU, maxAniso), asphalt, asphalt, asphalt]);
    m.position.set(cx, TOP - DEPTH / 2, cz);
    m.castShadow = false; m.receiveShadow = false;
    grp.add(m);
  };
  for(const r of list){
    if(r.x0 !== r.x1){ add((r.x0 + r.x1) / 2, r.z0, r.w, Math.abs(r.x1 - r.x0), true); continue; }
    const lo = Math.min(r.z0, r.z1), hi = Math.max(r.z0, r.z1);
    const cuts = ewRoads
      .filter(e => r.x0 >= Math.min(e.x0, e.x1) && r.x0 <= Math.max(e.x0, e.x1))
      .map(e => [e.z0 - e.w / 2, e.z0 + e.w / 2])
      .sort((a, b) => a[0] - b[0]);
    let cur = lo;
    const segs = [];
    for(const [c0, c1] of cuts){
      if(c0 > cur) segs.push([cur, Math.min(c0, hi)]);
      cur = Math.max(cur, c1);
    }
    if(cur < hi) segs.push([cur, hi]);
    for(const [z0, z1] of segs){
      if(z1 - z0 < 2) continue;
      add(r.x0, (z0 + z1) / 2, r.w, z1 - z0, false);
    }
  }
  return grp;
}

/* ---------- 程序化城市填充 ---------- */
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
        const roll = rnd();
        let type, w, d, h;
        if(roll < .06 && r > 420){ type = 'landmark'; w = 16 + rnd()*8; d = 16 + rnd()*8; h = 58 + rnd()*24; }
        else if(roll < .30){ type = 'tower'; w = 18 + rnd()*8; d = 16 + rnd()*8; h = 34 + rnd()*24; }
        else if(roll < .48){ type = 'podium'; w = 30 + rnd()*18; d = 22 + rnd()*14; h = 8 + rnd()*6; }
        else { type = 'slab'; w = 14 + rnd()*16; d = 12 + rnd()*12; h = 16 + rnd()*20; }
        if(hitsStatic(x, z, w, d)){ rejected++; continue; }
        instances.push({ x, z, type, w, d, h });
      }
    }
  }
  return { instances, rejected };
}

function makeGreenTexture(day){
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  const hash = i => { const v = Math.sin(i*78.233)*43758.5453; return v - Math.floor(v); };
  g.fillStyle = day ? 'rgba(90,116,78,.10)' : 'rgba(26,44,30,.12)';
  for(let i = 0; i < 180; i++){
    const x = hash(i*3)*512, y = hash(i*3+1)*512, r = 8 + hash(i*3+2)*26;
    g.beginPath(); g.ellipse(x, y, r, r*(.5 + hash(i*7)*.5), 0, 0, Math.PI*2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function makeGreenMesh(){
  /* 绿地贴花层与草甸只差 5cm，而 dist=1000m(maxDistance) 的深度分辨率已达 5.96cm，
   * 拉到最远时两者会被量化成同一深度而争夺可见性（贴花斑点时隐时现）。
   * 不写深度不等于不做 depthTest，故用 polygonOffset 固定贴花比草甸更近，
   * 无需改动既有分层高度，也不会盖到建筑（建筑顶面深度差远大于偏移单位）。 */
  const mat = new THREE.MeshBasicMaterial({
    map: makeGreenTexture(false), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  mat.userData.nightTex = mat.map;
  mat.userData.dayTex = makeGreenTexture(true);
  themedMats.push(mat);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.30;
  mesh.name = 'city-green';
  mesh.renderOrder = 0;
  return mesh;
}

function makeViaduct(){
  /* 留石高架真实在小区以南约 3km, 这里作为南侧远景放在 z=+1950 */
  const grp = new THREE.Group(); grp.name = 'city-viaduct';
  grp.position.y = 8;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(WORLD_HALF * 2, 0.8, 12), flatMat(0x1a1e24, 0x8c8d88));
  deck.name = 'city-viaduct-deck';
  deck.position.set(0, 0, VIADUCT_Z);
  deck.castShadow = false; deck.receiveShadow = false;
  grp.add(deck);
  const railMat = flatMat(0x8f959d, 0xf2f2ee);   // 白色护栏
  [-5.75, 5.75].forEach(zoff => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(WORLD_HALF * 2, 1.0, 0.5), railMat);
    rail.position.set(0, 0.80, VIADUCT_Z + zoff);
    rail.castShadow = false; rail.receiveShadow = false;
    grp.add(rail);
  });
  const xs = [];
  for(let x = -WORLD_HALF + 40; x <= WORLD_HALF - 40; x += 60) xs.push(x);
  const piers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3, 7.6, 3), flatMat(0x20242b, 0x9a9a94), xs.length);
  const m4 = new THREE.Matrix4();
  xs.forEach((x, i) => { m4.makeTranslation(x, -4, VIADUCT_Z); piers.setMatrixAt(i, m4); });
  piers.instanceMatrix.needsUpdate = true;
  piers.castShadow = false; piers.receiveShadow = false;
  grp.add(piers);
  return grp;
}

function makeSilhouette(rnd){
  const list = [];
  let skipped = 0;
  for(let i = 0; i < 320; i++){
    const a = rnd() * Math.PI * 2;
    const r = CITY.silhouette[0] + rnd() * (CITY.silhouette[1] - CITY.silhouette[0]);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(isForbidden(x, z)){ skipped++; continue; }
    const bw = 12 + rnd()*16, bd = 12 + rnd()*16, bh = 20 + rnd()*30;
    if(hitsStatic(x, z, bw, bd)){ skipped++; continue; }
    list.push({ x, z, type: 'silhouette', w: bw, d: bd, h: bh });
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f6b78, roughness: 1 });
  regColor(mat.color, 0x1d2632, 0x8b98a6);
  const mesh = new THREE.InstancedMesh(archetype('tower'), mat, list.length);
  mesh.name = 'city-silhouette';
  mesh.position.y = GROUND_SINK;
  list.forEach((it, i) => setInst(mesh, i, it.x, it.z, it.w, it.h, it.d, it.rot));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  return { mesh, list, skipped };
}

function makeBaseMesh(all){
  const list = all.filter(it => it.type !== 'silhouette');
  /* 贴地散水/接触阴影：只露出约 4cm 的一圈深色边，随楼体一起下沉，
   * 既不留「黑色矩形垫块」，也不让楼脚与草甸之间出现亮缝。 */
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    flatMat(0x141a18, 0x6f7a68, {
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    }), list.length);
  mesh.name = 'city-base';
  mesh.position.y = -0.40;
  list.forEach((it, i) => setInst(mesh, i, it.x, it.z, it.w * 1.08, 0.14, it.d * 1.08, it.rot));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}

/* ---------- 半山电厂（燃气）：拱康路以东厂区（八卦田/机力冷却塔/主厂房）+ 顾扬路以东库房辅区 ---------- */
function makePlant(){
  if(!PLANT) return null;
  const grp = new THREE.Group();
  grp.name = 'city-plant';

  /* 厂区地坪（混凝土灰，仅厂区范围） */
  const xs = PLANT.poly.map(p => p[0]), zs = PLANT.poly.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const yardMat = flatMat(0x2b2f31, 0x9fa29c);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), yardMat);
  yard.rotation.x = -Math.PI / 2;
  yard.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
  grp.add(yard);

  /* 厂房/库房：浅色墙体 + 深色屋面 */
  const hallMat = new THREE.MeshStandardMaterial({ color: 0x9ea6aa, roughness: 0.9, metalness: 0.05 });
  regColor(hallMat.color, 0x4d545b, 0x9ea6aa);
  const halls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), hallMat, PLANT.halls.length);
  halls.name = 'plant-halls';
  PLANT.halls.forEach((h, i) => setInst(halls, i, h.x, h.z, h.w, h.h, h.d, h.rot || 0));
  halls.instanceMatrix.needsUpdate = true;
  halls.castShadow = false; halls.receiveShadow = false;
  grp.add(halls);

  const roofMat = flatMat(0x1f242b, 0x6d737b);
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), roofMat, PLANT.halls.length);
  roofs.name = 'plant-roofs';
  /* 屋面是独立高度的板，不能走 setInst()（其 y 固定为 h/2）；
   * 中心压到厂房顶下 5cm，交叠避免与厂房顶面共面闪烁。 */
  PLANT.halls.forEach((h, i) => {
    _e.set(0, h.rot || 0, 0); _q.setFromEuler(_e);
    _v.set(h.x, h.h + 0.85, h.z); _s.set(h.w + 1.5, 1.8, h.d + 1.5);
    _m4.compose(_v, _q, _s); roofs.setMatrixAt(i, _m4);
  });
  roofs.instanceMatrix.needsUpdate = true;
  roofs.castShadow = false; roofs.receiveShadow = false;
  grp.add(roofs);

  /* 机力通风冷却塔（两列，顶部圆台风帽） */
  const towMat = new THREE.MeshStandardMaterial({ color: 0xcfd2ce, roughness: 0.85 });
  regColor(towMat.color, 0x63686e, 0xd6d8d3);
  const towers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.92, 1.06, 1, 14), towMat, PLANT.towers.length);
  towers.name = 'plant-towers';
  PLANT.towers.forEach((t, i) => {
    _q.identity(); _v.set(t.x, 9.5, t.z); _s.set(11, 19, 11);
    _m4.compose(_v, _q, _s); towers.setMatrixAt(i, _m4);
  });
  towers.instanceMatrix.needsUpdate = true;
  towers.castShadow = false; towers.receiveShadow = false;
  grp.add(towers);

  /* 八卦田：八角绿地 + 环路 + 八向园路 */
  const bg = PLANT.bagua;
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0x5f8a4c, roughness: 1 });
  regColor(fieldMat.color, 0x18280f, 0x86b06a);
  const pathMat = flatMat(0x8a8574, 0xd8d4c2);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(bg.r, 8), fieldMat);
  disc.rotation.x = -Math.PI / 2; disc.rotation.z = Math.PI / 8;
  disc.position.set(bg.x, 0.14, bg.z);
  grp.add(disc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(bg.r * 0.66, bg.r * 0.78, 8), pathMat);
  ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 8;
  ring.position.set(bg.x, 0.25, bg.z);
  grp.add(ring);
  const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), pathMat, 8);
  spokes.name = 'plant-bagua';
  for(let i = 0; i < 8; i++){
    const a = i * Math.PI / 4;
    const len = bg.r * 0.62;
    _q.setFromEuler(_e.set(0, a, 0));
    _v.set(bg.x + Math.sin(a) * len / 2, 0.25, bg.z + Math.cos(a) * len / 2);
    _s.set(3.2, 0.12, len);
    _m4.compose(_v, _q, _s); spokes.setMatrixAt(i, _m4);
  }
  spokes.instanceMatrix.needsUpdate = true;
  spokes.castShadow = false; spokes.receiveShadow = false;
  grp.add(spokes);
  return grp;
}

export function createCityscape(scene, renderer){
  const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
  const group = new THREE.Group();
  group.name = 'cityscape';
  const rnd = mulberry32(CITY.seed);
  const { instances, rejected } = generate(rnd);
  const sil = makeSilhouette(rnd);
  const real = realInstances();
  const all = instances.concat(sil.list, real);

  const byType = { slab: 0, tower: 0, podium: 0, landmark: 0, silhouette: 0, real: 0 };
  all.forEach(it => { byType[it.type]++; });
  for(const type of ['slab', 'tower', 'podium', 'landmark']){
    const list = all.filter(it => it.type === type);
    if(!list.length) continue;
    const mesh = new THREE.InstancedMesh(archetype(type), makeBuildingMaterial(maxAniso), list.length);
    mesh.name = 'city-' + type;
    mesh.position.y = GROUND_SINK;
    list.forEach((it, i) => setInst(mesh, i, it.x, it.z, it.w, it.h, it.d, it.rot));
    mesh.instanceMatrix.needsUpdate = true;
    tintInstances(mesh, list);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  group.add(makeRealMesh(real, maxAniso));

  const roads = makeRoads(maxAniso);
  if(roads) group.add(roads);
  const plant = makePlant();
  if(plant) group.add(plant);
  group.add(makeBaseMesh(all));
  group.add(makeGreenMesh());
  group.add(makeViaduct());
  group.add(sil.mesh);
  scene.add(group);

  const stats = {
    placed: all.length,
    rejected: rejected + sil.skipped,
    byType,
    instances: all,
    real: {
      count: real.length,
      compounds: COMPOUNDS.map(c => ({
        id: c.id, name: c.name, kind: c.kind, count: c.buildings.length,
      })),
    },
    surroundings: SURROUNDINGS,
    viaductZ: VIADUCT_Z,
    extent: EXTENT,
    plant: PLANT ? {
      name: PLANT.name,
      halls: PLANT.halls.length,
      towers: PLANT.towers.length,
    } : null,
  };
  return { group, stats };
}
