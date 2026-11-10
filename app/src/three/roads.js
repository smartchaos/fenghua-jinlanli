import * as THREE from 'three';
import { flatMat, themedMats } from './theme.js';
import SURROUNDINGS from './surroundings.json';

/* =========================================================================
 * 路网统一样式: 双向四车道柏油路 + 路灯 + 信号灯
 * 断面(横向 0..1, 以 128px 贴图宽绘制):
 *   边线(白实) / 车道分界(白虚) / 中央双黄线 / 车道分界(白虚) / 边线(白实)
 * ========================================================================= */

const ASPHALT = { night: '#101317', day: '#3d4248' };
const WHITE = { night: 'rgba(228,235,242,.62)', day: 'rgba(255,255,255,.92)' };
const YELLOW = { night: 'rgba(216,180,72,.72)', day: 'rgba(255,208,64,.95)' };

const W_PX = 128;            // 断面像素
const L_PX = 512;            // 沿路像素(对应 80m, 保证 10m 一段虚线无缝)
const TILE_M = 80;
const DASH_ON = 5, DASH_PERIOD = 10;

/* 断面分区: [起点, 终点, 颜色, 实/虚] */
const XSEC = [
  [0.055, 0.078, WHITE, 'solid'],
  [0.258, 0.281, WHITE, 'dash'],
  [0.462, 0.485, YELLOW, 'solid'],
  [0.515, 0.538, YELLOW, 'solid'],
  [0.719, 0.742, WHITE, 'dash'],
  [0.922, 0.945, WHITE, 'solid'],
];

/* 沿路方向为 canvas 的 x 轴(alongU)还是 y 轴 */
function paintLanes(g, alongU, day){
  const A = W_PX, L = L_PX;
  const W = alongU ? L : A, H = alongU ? A : L;
  const rect = (u0, u1, v0, v1) => alongU
    ? [v0 * L, u0 * A, (v1 - v0) * L, (u1 - u0) * A]
    : [u0 * A, v0 * L, (u1 - u0) * A, (v1 - v0) * L];
  g.clearRect(0, 0, W, H);
  g.fillStyle = day ? ASPHALT.day : ASPHALT.night;
  g.fillRect(0, 0, W, H);
  for(const [u0, u1, col, mode] of XSEC){
    g.fillStyle = day ? col.day : col.night;
    if(mode === 'solid'){ g.fillRect(...rect(u0, u1, 0, 1)); continue; }
    const on = DASH_ON / TILE_M, per = DASH_PERIOD / TILE_M;
    for(let v = 0; v < 1 - 1e-6; v += per) g.fillRect(...rect(u0, u1, v, v + on));
  }
}

/* 双向四车道沥青路面材质; len 为这条路/桥面的长度(米), alongU 表示纹理长轴沿贴图 u(盒体顶面) */
export function roadSurfaceMaterial(len, alongU, aniso){
  const draw = day => {
    const cv = document.createElement('canvas');
    cv.width = alongU ? L_PX : W_PX;
    cv.height = alongU ? W_PX : L_PX;
    paintLanes(cv.getContext('2d'), alongU, day);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso || 4;
    if(alongU){ t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / TILE_M, 1); }
    else { t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, len / TILE_M); }
    return t;
  };
  const m = new THREE.MeshBasicMaterial({ map: draw(false) });
  m.userData.nightTex = draw(false);
  m.userData.dayTex = draw(true);
  themedMats.push(m);
  return m;
}

export function asphaltMaterial(){ return flatMat(0x101317, 0x3d4248); }

/* 交叉口顶面: 沥青 + 四向斑马线 + 停止线 */
export function junctionMaterial(aniso){
  const draw = day => {
    const S = 160, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = day ? ASPHALT.day : ASPHALT.night; g.fillRect(0, 0, S, S);
    g.fillStyle = day ? WHITE.day : WHITE.night;
    const band = 0.115, gap = 0.02;   // 斑马线带宽(占路口)
    const stripe = 0.045;
    // 南北路斑马线(横跨路宽, 条纹沿路向 = v)
    for(let u = gap; u < 1 - gap; u += stripe * 2){
      g.fillRect(u * S, 0, stripe * S, band * S);
      g.fillRect(u * S, (1 - band) * S, stripe * S, band * S);
    }
    // 东西路斑马线(条纹沿路向 = u)
    for(let v = gap; v < 1 - gap; v += stripe * 2){
      g.fillRect(0, v * S, band * S, stripe * S);
      g.fillRect((1 - band) * S, v * S, band * S, stripe * S);
    }
    // 停止线
    g.fillRect(gap * S, (band + 0.012) * S, (1 - 2 * gap) * S, 0.016 * S);
    g.fillRect(gap * S, (1 - band - 0.028) * S, (1 - 2 * gap) * S, 0.016 * S);
    g.fillRect((band + 0.012) * S, gap * S, 0.016 * S, (1 - 2 * gap) * S);
    g.fillRect((1 - band - 0.028) * S, gap * S, 0.016 * S, (1 - 2 * gap) * S);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso || 4;
    return t;
  };
  const m = new THREE.MeshBasicMaterial({ map: draw(false) });
  m.userData.nightTex = draw(false);
  m.userData.dayTex = draw(true);
  themedMats.push(m);
  return m;
}

/* ---------------- 路网线表 ---------------- */
const LIMIT = 1500;      // 路灯/信号灯铺装范围(视野外不生成, 控制实例量)
export const ROAD_LINES = [
  { name: '顾扬路', x0: 110, z0: -2600, x1: 110, z1: 2600, w: 20, topY: 0.06, axis: 'ns' },
  { name: '朱家坝路', x0: -915, z0: 150, x1: 120, z1: 150, w: 20, topY: 0.12, axis: 'ew' },
  ...SURROUNDINGS.roads.filter(r => r.render).map(r => ({
    name: r.name, x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, w: r.w,
    topY: r.x0 === r.x1 ? 0.13 : 0.20,
    axis: r.x0 === r.x1 ? 'ns' : 'ew',
  })),
];

/* 桥位/入口等不宜立杆处 */
const LAMP_SKIP = [
  { x0: 88, x1: 132, z0: -212, z1: -112 },   // 东路跨电厂河桥(桥面外无落脚)
  { x0: -1180, x1: -820, z0: 112, z1: 188 }, // 斜拉桥及两端匝道
  { x0: 86, x1: 128, z0: -26, z1: 56 },      // 东入口门楼前场
];

const dummy = new THREE.Object3D();
function inst(geo, mat, count){
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.castShadow = false; m.receiveShadow = false;
  m.frustumCulled = false;
  return m;
}
/* 夜间灯头辉光: 加性混合小球, 白天 alpha=0 完全隐去 */
function glowMaterial(){
  const mk = a => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 8;
    const g = cv.getContext('2d');
    g.fillStyle = `rgba(255,226,168,${a})`; g.fillRect(0, 0, 8, 8);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const m = new THREE.MeshBasicMaterial({
    map: mk(0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  m.userData.nightTex = mk(0.8);
  m.userData.dayTex = mk(0);
  themedMats.push(m);
  return m;
}
function place(mesh, i, x, y, z, rotY = 0, sx = 1){
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, rotY, 0);
  dummy.scale.set(sx, 1, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

/* ---------------- 路灯 ---------------- */
export function createStreetLamps(parent, lines, opts = {}){
  const spacing = opts.spacing ?? 42;
  const limit = opts.limit ?? LIMIT;
  const spots = [];
  for(const L of lines){
    const dx = L.x1 - L.x0, dz = L.z1 - L.z0;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    const nx = uz, nz = -ux;                 // 法向(右侧)
    const off = L.w / 2 + 1.6;
    for(let s = spacing * 0.55; s < len; s += spacing){
      for(const side of [1, -1]){
        const x = L.x0 + ux * s + nx * off * side;
        const z = L.z0 + uz * s + nz * off * side;
        if(Math.abs(x) > limit || Math.abs(z) > limit) continue;
        if(LAMP_SKIP.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) continue;
        spots.push({ x, z, rot: Math.atan2(nz * side, -nx * side) });  // 灯臂指向路中
      }
    }
  }
  const n = spots.length;
  if(!n) return null;

  const poleGeo = new THREE.CylinderGeometry(0.13, 0.2, 9.2, 6);
  poleGeo.translate(0, 3.9, 0);          // 底端 -0.7, 埋入草甸(-0.35)/底图(-0.04)以下不悬空
  const armGeo = new THREE.CylinderGeometry(0.085, 0.085, 2.7, 5);
  armGeo.rotateZ(-Math.PI / 2); armGeo.translate(1.35, 8.16, 0);
  const headGeo = new THREE.BoxGeometry(1.2, 0.17, 0.46);
  headGeo.translate(2.75, 8.06, 0);
  const lensGeo = new THREE.CircleGeometry(0.4, 12);
  lensGeo.rotateX(Math.PI / 2); lensGeo.translate(2.75, 7.955, 0);
  const glowGeo = new THREE.SphereGeometry(0.55, 8, 6);
  glowGeo.translate(2.75, 7.85, 0);

  const poleMat = flatMat(0x1c2026, 0x4a5158);
  const armMat = flatMat(0x232830, 0x5a6168);
  const headMat = flatMat(0x2b3037, 0x6b7178);
  const lensMat = flatMat(0xffe3ad, 0xbfc4c9);

  const grp = new THREE.Group(); grp.name = 'street-lamps';
  const poles = inst(poleGeo, poleMat, n);
  const arms = inst(armGeo, armMat, n);
  const heads = inst(headGeo, headMat, n);
  const lenses = inst(lensGeo, lensMat, n);
  const glows = inst(glowGeo, glowMaterial(), n);
  spots.forEach((s, i) => {
    place(poles, i, s.x, 0, s.z, s.rot);
    place(arms, i, s.x, 0, s.z, s.rot);
    place(heads, i, s.x, 0, s.z, s.rot);
    place(lenses, i, s.x, 0, s.z, s.rot);
    place(glows, i, s.x, 0, s.z, s.rot);
  });
  [poles, arms, heads, lenses, glows].forEach(m => { m.instanceMatrix.needsUpdate = true; grp.add(m); });
  parent.add(grp);
  return grp;
}

/* ---------------- 信号灯 ---------------- */
const RED = new THREE.Color(0xff4530), RED_D = new THREE.Color(0x461410);
const YEL = new THREE.Color(0xffb340), YEL_D = new THREE.Color(0x463413);
const GRN = new THREE.Color(0x32d74b), GRN_D = new THREE.Color(0x123a1b);

/* 由路网线表求各交叉口位置 */
function crossings(lines, limit){
  const ns = lines.filter(l => l.axis === 'ns');
  const ew = lines.filter(l => l.axis === 'ew');
  const out = [];
  for(const a of ns) for(const b of ew){
    const x = a.x0, z = b.z0;
    if(x < Math.min(b.x0, b.x1) || x > Math.max(b.x0, b.x1)) continue;
    if(z < Math.min(a.z0, a.z1) || z > Math.max(a.z0, a.z1)) continue;
    if(Math.abs(x) > limit || Math.abs(z) > limit) continue;
    out.push({ x, z, hN: a.w / 2, hE: b.w / 2 });
  }
  return out;
}

export function createTrafficLights(parent, lines, opts = {}){
  const limit = opts.limit ?? LIMIT;
  const xs = crossings(lines, limit);
  if(!xs.length) return null;

  const nodes = [];
  xs.forEach((c, k) => {
    const nsGreen = k % 2 === 0;   // 方向轮换, 避免全场同色
    // 四条进口道: d = 行进方向; right = (dz,-dx)
    const approaches = [
      { d: [0, 1], hAlong: c.hE, hAcross: c.hN, lit: nsGreen ? 'green' : 'red' },
      { d: [0, -1], hAlong: c.hE, hAcross: c.hN, lit: nsGreen ? 'green' : 'red' },
      { d: [1, 0], hAlong: c.hN, hAcross: c.hE, lit: nsGreen ? 'red' : 'green' },
      { d: [-1, 0], hAlong: c.hN, hAcross: c.hE, lit: nsGreen ? 'red' : 'green' },
    ];
    for(const ap of approaches){
      const [dx, dz] = ap.d;
      const rx = dz, rz = -dx;
      const armLen = ap.hAcross + 2.0;
      const px = c.x + dx * (ap.hAlong + 1.2) + rx * armLen;
      const pz = c.z + dz * (ap.hAlong + 1.2) + rz * armLen;
      const armRot = Math.atan2(-(-rz), -rx);          // 灯臂指向路中 = -right
      const headRot = Math.atan2(-dz, dx);             // 灯面朝向来车 = -d
      const hx = px + (-rx) * armLen, hz = pz + (-rz) * armLen;
      nodes.push({ px, pz, armRot, headRot, armLen, hx, hz, lit: ap.lit });
    }
  });

  const N = nodes.length;
  const poleGeo = new THREE.CylinderGeometry(0.2, 0.26, 7.4, 6);
  poleGeo.translate(0, 3.1, 0);          // 底端 -0.6, 埋入地面以下不悬空
  const armGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 5); armGeo.rotateZ(-Math.PI / 2);
  const headGeo = new THREE.BoxGeometry(0.66, 1.86, 0.46);
  const lampGeo = new THREE.CircleGeometry(0.2, 10); lampGeo.rotateY(-Math.PI / 2);

  const darkMetal = flatMat(0x17191d, 0x3a3f45);
  const grp = new THREE.Group(); grp.name = 'traffic-lights';
  const poles = inst(poleGeo, darkMetal, N);
  const arms = inst(armGeo, darkMetal, N);
  const heads = inst(headGeo, darkMetal, N);
  const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N * 3);
  lamps.castShadow = false; lamps.receiveShadow = false; lamps.frustumCulled = false;
  lamps.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3 * 3), 3);

  const LAMPS = [['red', RED, RED_D], ['yellow', YEL, YEL_D], ['green', GRN, GRN_D]];
  nodes.forEach((nd, i) => {
    place(poles, i, nd.px, 0, nd.pz, nd.armRot);
    // 灯臂沿指向路中的方向铺开
    dummy.position.set(nd.px + Math.cos(nd.armRot) * nd.armLen / 2, 6.7, nd.pz - Math.sin(nd.armRot) * nd.armLen / 2);
    dummy.rotation.set(0, nd.armRot, 0);
    dummy.scale.set(nd.armLen, 1, 1);
    dummy.updateMatrix(); arms.setMatrixAt(i, dummy.matrix);
    place(heads, i, nd.hx, 5.95, nd.hz, nd.headRot);
    const cy = Math.cos(nd.headRot), sy = Math.sin(nd.headRot);
    LAMPS.forEach(([key, lit, dim], j) => {
      const lx = -0.36, ly = 0.6 - j * 0.6, lz = 0;
      const x = nd.hx + lx * cy + lz * sy;
      const z = nd.hz - lx * sy + lz * cy;
      const k = i * 3 + j;
      place(lamps, k, x, 5.95 + ly, z, nd.headRot);
      lamps.setColorAt(k, nd.lit === key ? lit : dim);
    });
  });
  poles.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  lamps.instanceMatrix.needsUpdate = true;
  lamps.instanceColor.needsUpdate = true;
  grp.add(poles, arms, heads, lamps);
  parent.add(grp);
  return grp;
}

/* 一次性给全路网铺路灯与信号灯 */
export function createRoadFurniture(parent, lines = ROAD_LINES){
  createStreetLamps(parent, lines);
  createTrafficLights(parent, lines);
}
