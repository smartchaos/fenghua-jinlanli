import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { RX, RZ } from './constants.js';
import { regColor, flatMat, themedMats, grainOverlay } from './theme.js';

const CITY = {
  cell: 46,
  rings: [[250, 450, 0.8], [450, 700, 0.62], [700, 900, 0.35]],
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
  regColor(m.color, 0x7c838c, 0xb6b8b2);
  return m;
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
        const roll = rnd();
        let type, w, d, h;
        if(roll < .06 && r > 420 && r < 900){ type = 'landmark'; w = 16 + rnd()*8; d = 16 + rnd()*8; h = 58 + rnd()*24; }
        else if(roll < .30){ type = 'tower'; w = 18 + rnd()*8; d = 16 + rnd()*8; h = 34 + rnd()*24; }
        else if(roll < .48){ type = 'podium'; w = 30 + rnd()*18; d = 22 + rnd()*14; h = 8 + rnd()*6; }
        else { type = 'slab'; w = 14 + rnd()*16; d = 12 + rnd()*12; h = 16 + rnd()*20; }
        instances.push({ x, z, type, w, d, h });
      }
    }
  }
  return { instances, rejected };
}

function makeRoadsMesh(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 1024, 1024);
  const step = 1024 / 12;
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(112,114,112,.50)';
  for(let i = 0; i <= 12; i++){
    const p = i * step;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(1024, p); g.stroke();
  }
  g.strokeStyle = 'rgba(235,233,220,.42)'; g.lineWidth = 1.5; g.setLineDash([12, 18]);
  for(let i = 0; i <= 12; i++){
    const p = i * step;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(1024, p); g.stroke();
  }
  g.setLineDash([]);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  /* 与 city-green 同处 y=-0.30: 两者都不写深度、按 renderOrder 定序，避免盖过水面 */
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.30;
  mesh.name = 'city-roads';
  mesh.renderOrder = 1;
  return mesh;
}

function makeGreenTexture(day){
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  const hash = i => { const v = Math.sin(i*78.233)*43758.5453; return v - Math.floor(v); };
  g.fillStyle = day ? 'rgba(96,124,84,.28)' : 'rgba(26,44,30,.22)';
  for(let i = 0; i < 180; i++){
    const x = hash(i*3)*512, y = hash(i*3+1)*512, r = 8 + hash(i*3+2)*26;
    g.beginPath(); g.ellipse(x, y, r, r*(.5 + hash(i*7)*.5), 0, 0, Math.PI*2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGreenMesh(){
  const mat = new THREE.MeshBasicMaterial({
    map: makeGreenTexture(false), transparent: true, depthWrite: false,
  });
  mat.userData.nightTex = mat.map;
  mat.userData.dayTex = makeGreenTexture(true);
  themedMats.push(mat);
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
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1500, 0.8, 12), flatMat(0x1a1e24, 0x8c8d88));
  deck.position.set(0, 0, -300);
  deck.castShadow = false; deck.receiveShadow = false;
  grp.add(deck);
  const xs = [];
  for(let x = -720; x <= 720; x += 60) xs.push(x);
  const piers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3, 7.6, 3), flatMat(0x20242b, 0x9a9a94), xs.length);
  const m4 = new THREE.Matrix4();
  xs.forEach((x, i) => { m4.makeTranslation(x, -4, -300); piers.setMatrixAt(i, m4); });
  piers.instanceMatrix.needsUpdate = true;
  piers.castShadow = false; piers.receiveShadow = false;
  grp.add(piers);
  return grp;
}

function makeSilhouette(rnd){
  const list = [];
  let skipped = 0;
  for(let i = 0; i < 260; i++){
    const a = rnd() * Math.PI * 2;
    const r = CITY.silhouette[0] + rnd() * (CITY.silhouette[1] - CITY.silhouette[0]);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(isForbidden(x, z)){ skipped++; continue; }
    list.push({ x, z, type: 'silhouette', w: 12 + rnd()*16, d: 12 + rnd()*16, h: 20 + rnd()*30 });
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f6b78, roughness: 1 });
  regColor(mat.color, 0x1d2632, 0x8b98a6);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
  mesh.name = 'city-silhouette';
  const m4 = new THREE.Matrix4();
  list.forEach((it, i) => {
    m4.makeScale(it.w, it.h, it.d);
    m4.setPosition(it.x, it.h / 2, it.z);
    mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  return { mesh, list, skipped };
}

function makeBaseMesh(all){
  const list = all.filter(it => it.type !== 'silhouette');
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), flatMat(0x1a201a, 0x555c4c), list.length);
  mesh.name = 'city-base';
  const m4 = new THREE.Matrix4();
  list.forEach((it, i) => {
    m4.makeScale(it.w * 1.18, 0.5, it.d * 1.18);
    m4.setPosition(it.x, 0.12, it.z);
    mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}

export function createCityscape(scene){
  const group = new THREE.Group();
  group.name = 'cityscape';
  const rnd = mulberry32(CITY.seed);
  const { instances, rejected } = generate(rnd);
  const sil = makeSilhouette(rnd);
  const all = instances.concat(sil.list);

  const byType = { slab: 0, tower: 0, podium: 0, landmark: 0, silhouette: 0 };
  all.forEach(it => { byType[it.type]++; });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4();
  for(const type of ['slab', 'tower', 'podium', 'landmark']){
    const list = all.filter(it => it.type === type);
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

  group.add(makeBaseMesh(all));
  group.add(makeGreenMesh());
  group.add(makeRoadsMesh());
  group.add(makeViaduct());
  group.add(sil.mesh);
  scene.add(group);

  const stats = { placed: all.length, rejected: rejected + sil.skipped, byType, instances: all };
  return { group, stats };
}
