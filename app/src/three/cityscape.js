import * as THREE from 'three';
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

/* ---------- 材质 ---------- */
function makeFacadeTexture(day){
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = day ? '#b9bab5' : '#333b45'; g.fillRect(0, 0, 512, 512);
  for(let row = 0; row < 16; row++){
    const y = row * 32;
    g.fillStyle = day ? 'rgba(90,98,104,.38)' : 'rgba(12,18,26,.65)';
    for(let col = 0; col < 12; col++) g.fillRect(col * 42 + 6, y + 8, 30, 16);
    g.fillStyle = day ? 'rgba(255,255,255,.14)' : 'rgba(150,180,210,.10)';
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
  regColor(m.color, 0x6b737d, 0x9a9d98);
  return m;
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

function makeRealMesh(list){
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), makeBuildingMaterial(), list.length);
  mesh.name = 'city-real';
  list.forEach((it, i) => setInst(mesh, i, it.x, it.z, it.w, it.h, it.d, it.rot));
  mesh.instanceMatrix.needsUpdate = true;
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
  const mat = new THREE.MeshBasicMaterial({
    map: makeGreenTexture(false), transparent: true, depthWrite: false,
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
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
  mesh.name = 'city-silhouette';
  list.forEach((it, i) => setInst(mesh, i, it.x, it.z, it.w, it.h, it.d, it.rot));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  return { mesh, list, skipped };
}

function makeBaseMesh(all){
  const list = all.filter(it => it.type !== 'silhouette');
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), flatMat(0x1a201a, 0x555c4c), list.length);
  mesh.name = 'city-base';
  list.forEach((it, i) => setInst(mesh, i, it.x, it.z, it.w * 1.18, 0.5, it.d * 1.18, it.rot));
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
  PLANT.halls.forEach((h, i) => setInst(roofs, i, h.x, h.h + 0.9, h.w + 1.5, 1.8, h.d + 1.5, h.rot || 0));
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
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for(const type of ['slab', 'tower', 'podium', 'landmark']){
    const list = all.filter(it => it.type === type);
    if(!list.length) continue;
    const mesh = new THREE.InstancedMesh(geo, makeBuildingMaterial(), list.length);
    mesh.name = 'city-' + type;
    list.forEach((it, i) => setInst(mesh, i, it.x, it.z, it.w, it.h, it.d, it.rot));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  group.add(makeRealMesh(real));

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
