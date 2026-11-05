import * as THREE from 'three';
import { regColor } from './theme.js';
import { heightOf } from '../data/index.js';

/* 楼名+入群率标签 Sprite（随楼生长的 intro 动画控制 opacity） */
function makeLabel(b){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 176;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(6,12,20,.72)';
  g.beginPath(); g.roundRect(18, 12, 476, 152, 22); g.fill();
  g.strokeStyle = 'rgba(246,178,107,.32)'; g.lineWidth = 2; g.stroke();
  g.textAlign = 'center';
  g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 14;
  g.fillStyle = '#f2f5fa'; g.font = '600 70px "PingFang SC",sans-serif';
  g.fillText(b.name, 256, 82);
  g.shadowBlur = 8;
  g.fillStyle = 'rgba(246,178,107,.95)'; g.font = '500 30px "SF Mono",Menlo,monospace';
  g.fillText(`${b.joined}/${b.total}  ·  ${(b.rate*100).toFixed(0)}%`, 256, 136);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(30, 10.5, 1);
  return sp;
}

/* 立面纹理(颜色+夜光): 架空层渐变 / 亮窗(已入群)=琥珀 / 暗窗(未入群)=蓝灰 */
function makeFacade(b, day, roomsByB){
  const cols = b.type === '洋房' ? 4 : 3;
  const rows = b.floors;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024;
  const em = document.createElement('canvas'); em.width = 1024; em.height = 1024;
  const g = cv.getContext('2d'); const e = em.getContext('2d');
  const M = 44;
  const cw = (1024 - M*2) / cols, ch = (1024 - M*2) / rows;
  const tint = (day ? ['#d8cdb4','#d3c7ad','#cdc0a4','#dbd0ba'] : ['#d8d1c3','#d4ccbc','#cfc7b7','#d9d0bf'])[b.id%4];
  const base = g.createLinearGradient(0, 0, 0, 1024);
  base.addColorStop(0, tint); base.addColorStop(.55, day ? '#c8bba0' : '#c9c1b2'); base.addColorStop(1, day ? '#b2a488' : '#b3aa9b');
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for(let i = 0; i < cols; i++){
    const x = M + i*cw;
    g.fillStyle = day ? 'rgba(70,60,45,.22)' : 'rgba(90,82,70,.18)';
    g.fillRect(x, M, 5, 1024-M*2);
  }
  g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, M, 1024, 4);
  const sheen = g.createLinearGradient(0, 0, 1024, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(.5, day ? 'rgba(255,250,236,.10)' : 'rgba(255,244,224,.05)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.fillRect(0, 0, 1024, 1024);
  e.fillStyle = '#000'; e.fillRect(0, 0, 1024, 1024);

  const floorRooms = roomsByB[b.id] || [];
  for(let f = 1; f <= rows; f++){
    const yTop = 1024 - M - f*ch;
    g.fillStyle = day ? 'rgba(88,76,58,.38)' : 'rgba(100,92,80,.28)'; g.fillRect(M, yTop+ch-3, 1024-M*2, 3);
    if(b.type !== '洋房' && f < b.residentFrom){
      const lg = g.createLinearGradient(0, yTop, 0, yTop+ch);
      if(day){ lg.addColorStop(0,'#697378'); lg.addColorStop(.55,'#879196'); lg.addColorStop(1,'#525a60'); }
      else { lg.addColorStop(0,'#2a2b2b'); lg.addColorStop(.55,'#3a342a'); lg.addColorStop(1,'#171a1e'); }
      g.fillStyle = lg; g.fillRect(M+10, yTop+ch*0.18, 1024-M*2-20, ch*0.68);
      if(!day){
        const eg = e.createLinearGradient(0, yTop, 0, yTop+ch);
        eg.addColorStop(0,'rgba(255,190,120,.10)'); eg.addColorStop(.6,'rgba(255,180,100,.55)'); eg.addColorStop(1,'rgba(255,160,80,.12)');
        e.fillStyle = eg; e.fillRect(M+10, yTop+ch*0.18, 1024-M*2-20, ch*0.68);
      }
      g.fillStyle = day ? 'rgba(25,31,36,.6)' : 'rgba(10,12,14,.65)';
      for(let d = 0; d < 3; d++) g.fillRect(1024/2-120+d*84, yTop+ch*0.34, 58, ch*0.52);
      continue;
    }
    const fr = floorRooms.filter(r=>r.f === f);
    fr.forEach(r=>{
      const c = cols - 1 - r.col;
      const x = M + c*cw + cw*0.17;
      const ww = cw*0.66;
      const y = yTop + ch*0.19;
      const hh = ch*0.46;
      const on = r.joined > 0;
      g.fillStyle = day ? 'rgba(72,62,46,.5)' : 'rgba(70,64,55,.42)';
      g.fillRect(x-3, y-3, ww+6, hh+6);
      if(on){
        const wg = g.createLinearGradient(0, y, 0, y+hh);
        if(day){ wg.addColorStop(0,'#f8c766'); wg.addColorStop(.5,'#f0ab45'); wg.addColorStop(1,'#dd912e'); }
        else { wg.addColorStop(0,'#ffe3b4'); wg.addColorStop(.5,'#ffc477'); wg.addColorStop(1,'#e89b4f'); }
        g.fillStyle = wg; g.fillRect(x, y, ww, hh);
        g.fillStyle = day ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.28)'; g.fillRect(x, y, ww, hh*0.16);
      }else{
        g.fillStyle = day ? '#7b9cbd' : '#1b2532'; g.fillRect(x, y, ww, hh);
        g.fillStyle = day ? 'rgba(255,255,255,.4)' : 'rgba(120,160,210,.07)'; g.fillRect(x, y, ww, hh*0.2);
      }
      g.fillStyle = day ? 'rgba(48,42,32,.6)' : 'rgba(60,55,48,.5)'; g.fillRect(x+ww/2-1, y, 2, hh);
      g.fillStyle = day ? 'rgba(66,56,42,.45)' : 'rgba(80,72,62,.30)'; g.fillRect(x-2, y+hh+4, ww+4, 2);
      if(on && !day){
        const grad = e.createRadialGradient(x+ww/2, y+hh/2, 2, x+ww/2, y+hh/2, ww*0.75);
        grad.addColorStop(0,'rgba(255,220,170,1)');
        grad.addColorStop(.5,'rgba(255,178,96,.85)');
        grad.addColorStop(1,'rgba(255,150,60,0)');
        e.fillStyle = grad;
        e.fillRect(x-6, y-6, ww+12, hh+12);
      }
    });
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const glow = new THREE.CanvasTexture(em);
  glow.colorSpace = THREE.SRGBColorSpace; glow.anisotropy = 8;
  return { map, glow };
}

/* 山墙(±x 端头)纹理: 每层一条通宽边窗带; 亮灯=该端头列有房间已入群, 与相邻南北立面严格一致。
 * endCol: 该端头贴邻的立面列号(+x 端=col 0, -x 端=col cols-1, 由 BoxGeometry UV 方向推得) */
function makeSide(b, day, roomsByB, endCol){
  const rows = b.floors;
  const cols = b.type === '洋房' ? 4 : 3;
  const W = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = 1024;
  const em = document.createElement('canvas'); em.width = W; em.height = 1024;
  const g = cv.getContext('2d'); const e = em.getContext('2d');
  const M = 20;
  const bw = W - M*2, ch = (1024 - M*2) / rows;
  const tint = (day ? ['#cdc3ae','#c8bda6','#c3b79e','#d0c5b0'] : ['#d2cab9','#cec5b3','#c9c0ae','#d3cabb'])[b.id%4];
  const base = g.createLinearGradient(0, 0, 0, 1024);
  base.addColorStop(0, tint); base.addColorStop(.6, day ? '#b5a78c' : '#bcb2a1'); base.addColorStop(1, day ? '#a2947a' : '#aaa191');
  g.fillStyle = base; g.fillRect(0, 0, W, 1024);
  /* 端头竖向分缝 */
  g.fillStyle = day ? 'rgba(90,78,60,.20)' : 'rgba(70,64,54,.18)';
  g.fillRect(W/2-1, M, 2, 1024-M*2);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, 1024);

  const floorRooms = roomsByB[b.id] || [];
  for(let f = 1; f <= rows; f++){
    const yTop = 1024 - M - f*ch;
    g.fillStyle = day ? 'rgba(88,76,58,.38)' : 'rgba(100,92,80,.28)';
    g.fillRect(M, yTop+ch-3, bw, 3);
    if(b.type !== '洋房' && f < b.residentFrom){
      /* 架空层: 通宽玻璃带 */
      const lg = g.createLinearGradient(0, yTop, 0, yTop+ch);
      if(day){ lg.addColorStop(0,'#6d7478'); lg.addColorStop(.55,'#8b9296'); lg.addColorStop(1,'#50585e'); }
      else { lg.addColorStop(0,'#28292a'); lg.addColorStop(.55,'#38322a'); lg.addColorStop(1,'#16191d'); }
      g.fillStyle = lg; g.fillRect(M+4, yTop+ch*0.14, bw-8, ch*0.72);
      if(!day){
        const eg = e.createLinearGradient(0, yTop, 0, yTop+ch);
        eg.addColorStop(0,'rgba(255,190,120,.08)'); eg.addColorStop(.6,'rgba(255,180,100,.4)'); eg.addColorStop(1,'rgba(255,160,80,.1)');
        e.fillStyle = eg; e.fillRect(M+4, yTop+ch*0.14, bw-8, ch*0.72);
      }
      continue;
    }
    /* 该端头列本层房间: 无房间则留空墙(与正立面一致) */
    const edge = floorRooms.filter(r=>r.f === f && r.col === endCol);
    if(!edge.length) continue;
    const lit = edge.some(r=>r.joined > 0);
    /* 通宽边窗带 */
    const x = M+7, ww = bw-14, y = yTop+ch*0.2, hh = ch*0.48;
    g.fillStyle = day ? 'rgba(72,62,46,.5)' : 'rgba(70,64,55,.42)';
    g.fillRect(x-4, y-4, ww+8, hh+8);
    if(lit){
      const wg = g.createLinearGradient(0, y, 0, y+hh);
      if(day){ wg.addColorStop(0,'#f8c766'); wg.addColorStop(.5,'#f0ab45'); wg.addColorStop(1,'#dd912e'); }
      else { wg.addColorStop(0,'#ffe3b4'); wg.addColorStop(.5,'#ffc477'); wg.addColorStop(1,'#e89b4f'); }
      g.fillStyle = wg; g.fillRect(x, y, ww, hh);
      g.fillStyle = day ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.28)'; g.fillRect(x, y, ww, hh*0.16);
    }else{
      g.fillStyle = day ? '#7b9cbd' : '#1b2532'; g.fillRect(x, y, ww, hh);
      g.fillStyle = day ? 'rgba(255,255,255,.4)' : 'rgba(120,160,210,.07)'; g.fillRect(x, y, ww, hh*0.2);
    }
    /* 竖梃 */
    g.fillStyle = day ? 'rgba(48,42,32,.6)' : 'rgba(60,55,48,.5)';
    for(let k = 1; k < 4; k++) g.fillRect(x+ww*k/4-1.5, y, 3, hh);
    g.fillStyle = day ? 'rgba(66,56,42,.45)' : 'rgba(80,72,62,.30)'; g.fillRect(x-2, y+hh+4, ww+4, 2);
    if(lit && !day){
      const grad = e.createRadialGradient(x+ww/2, y+hh/2, 2, x+ww/2, y+hh/2, ww*0.55);
      grad.addColorStop(0,'rgba(255,220,170,1)');
      grad.addColorStop(.5,'rgba(255,178,96,.85)');
      grad.addColorStop(1,'rgba(255,150,60,0)');
      e.fillStyle = grad;
      e.fillRect(x-6, y-6, ww+12, hh+12);
    }
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const glow = new THREE.CanvasTexture(em);
  glow.colorSpace = THREE.SRGBColorSpace; glow.anisotropy = 8;
  return { map, glow };
}

/* 竖棱圆角横截面(俯视, x 右 z 下, 逆时针): 每个转角弧在 45° 处对半劈开,
 * 两半各归相邻平面之一(前接半弧 u<0、后随半弧 u>1, ClampToEdge 钳到贴图边缘色),
 * 转角两侧色调对称, 视同真实 mitre 拼缝; 面间顶点不共享以保证棱线法线锐利 */
function roundedWallGeometry(w, d, h, r){
  const hw = w/2, hd = d/2, HALF = 3;
  const pos = [], nor = [], uv = [], idx = [];
  const groups = [];
  let vb = 0, ib = 0;
  /* 各面 = 本转角后半弧(am→a1, 归本面 u∈[-ext,0]) + 平段(u 0→1) + 下一转角前半弧(a0→am, 归本面 u∈[1,1+ext]);
   * mi=材质组号; 角序 px→nz→nx→pz */
  const sections = [
    { mi: 0, arc: { kx: hw-r,  kz: hd-r,  a0: Math.PI/2, a1: 0 },
      flat: { x0: hw, z0: hd-r, x1: hw, z1: -(hd-r) } },
    { mi: 5, arc: { kx: hw-r,  kz: -(hd-r), a0: 0, a1: -Math.PI/2 },
      flat: { x0: hw-r, z0: -hd, x1: -(hw-r), z1: -hd } },
    { mi: 1, arc: { kx: -(hw-r), kz: -(hd-r), a0: -Math.PI/2, a1: -Math.PI },
      flat: { x0: -hw, z0: -(hd-r), x1: -hw, z1: hd-r } },
    { mi: 4, arc: { kx: -(hw-r), kz: hd-r, a0: Math.PI, a1: Math.PI/2 },
      flat: { x0: -(hw-r), z0: hd, x1: hw-r, z1: hd } },
  ];
  const arcPt = (arc, a, u) => ({
    x: arc.kx + r*Math.cos(a), z: arc.kz + r*Math.sin(a),
    nx: Math.cos(a), nz: Math.sin(a), u
  });
  for(let si = 0; si < sections.length; si++){
    const s = sections[si];
    const nxSec = sections[(si + 1) % sections.length];
    const flatLen = Math.hypot(s.flat.x1-s.flat.x0, s.flat.z1-s.flat.z0);
    const ext = (r*Math.PI/4) / flatLen; /* 半弧长折算成 u 越界量 */
    const am = s.arc.a0 + (s.arc.a1 - s.arc.a0) / 2;
    const nam = nxSec.arc.a0 + (nxSec.arc.a1 - nxSec.arc.a0) / 2;
    const nxFlatLen = Math.hypot(nxSec.flat.x1-nxSec.flat.x0, nxSec.flat.z1-nxSec.flat.z0);
    const nxExt = (r*Math.PI/4) / nxFlatLen;
    const pts = [];
    /* 本转角后半弧: 45° 点 → 平段起点(a1), 归本面, u∈[-ext,0] */
    for(let i = HALF; i >= 0; i--){
      const a = s.arc.a1 + (am - s.arc.a1) * i / HALF;
      pts.push(arcPt(s.arc, a, -ext * i / HALF));
    }
    /* 平段: 跳过首点(=前弧末点, 顶点不共享), 末点保留(接后弧) */
    for(let i = 1; i <= 5; i++){
      const t = i / 5;
      pts.push({ x: s.flat.x0 + (s.flat.x1-s.flat.x0)*t, z: s.flat.z0 + (s.flat.z1-s.flat.z0)*t,
                 nx: 0, nz: 0, u: t, flat: true });
    }
    /* 下一转角前半弧: 平段末端(a0) → 45° 点, 归本面, u∈[1,1+nxExt] */
    for(let i = 1; i <= HALF; i++){
      const a = nxSec.arc.a0 + (nam - nxSec.arc.a0) * i / HALF;
      pts.push(arcPt(nxSec.arc, a, 1 + nxExt * i / HALF));
    }
    for(const p of pts){
      if(p.flat){
        if(s.mi === 0){ p.nx = 1; } else if(s.mi === 1){ p.nx = -1; }
        else if(s.mi === 4){ p.nz = 1; } else { p.nz = -1; }
      }
      /* nz(北)面与 pz(南)面共用同一张立面 canvas; pz 平段 u=0 在西端, 而 nz 平段
       * x0→x1 为东→西(u=0 在东端), 直接共用会东西镜像。翻转 nz 的 u 使两面列序一致 */
      const pu = s.mi === 5 ? 1 - p.u : p.u;
      pos.push(p.x, 0, p.z, p.x, h, p.z);
      nor.push(p.nx, 0, p.nz, p.nx, 0, p.nz);
      uv.push(pu, 0, pu, 1);
    }
    for(let i = 0; i < pts.length - 1; i++){
      idx.push(vb + 2*i, vb + 2*i + 2, vb + 2*i + 1, vb + 2*i + 2, vb + 2*i + 3, vb + 2*i + 1);
    }
    groups.push([ib, (pts.length - 1) * 6, s.mi]);
    ib += (pts.length - 1) * 6;
    vb += pts.length * 2;
  }
  /* 顶盖: 圆角矩形平面(锐利顶棱), 跟随同一轮廓 */
  const capStart = ib;
  const capPts = [];
  for(const s of sections){
    for(let i = 0; i <= 6; i++){
      const a = s.arc.a0 + (s.arc.a1 - s.arc.a0) * i / 6;
      const p = { x: s.arc.kx + r*Math.cos(a), z: s.arc.kz + r*Math.sin(a) };
      const last = capPts[capPts.length - 1];
      if(!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.z - p.z) > 1e-6) capPts.push(p);
    }
    const f = s.flat, e = { x: f.x1, z: f.z1 };
    const last = capPts[capPts.length - 1];
    if(Math.abs(last.x - e.x) > 1e-6 || Math.abs(last.z - e.z) > 1e-6) capPts.push(e);
  }
  const ci = pos.length / 3;
  pos.push(0, h, 0); nor.push(0, 1, 0); uv.push(0, 0);
  for(const p of capPts){ pos.push(p.x, h, p.z); nor.push(0, 1, 0); uv.push(0, 0); }
  for(let i = 0; i < capPts.length; i++){
    const j = (i + 1) % capPts.length;
    idx.push(ci, ci + 1 + i, ci + 1 + j);
  }
  groups.push([capStart, capPts.length * 3, 2]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  for(const [start, count, mi] of groups) geo.addGroup(start, count, mi);
  return geo;
}

/* 圆角矩形 Shape(屋顶板/女儿墙环用), 角半径 r */
function roundedRectShape(w, d, r){
  const s = new THREE.Shape(), hw = w/2, hd = d/2;
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd); s.absarc(hw - r, -hd + r, r, -Math.PI/2, 0, false);
  s.lineTo(hw, hd - r); s.absarc(hw - r, hd - r, r, 0, Math.PI/2, false);
  s.lineTo(-hw + r, hd); s.absarc(-hw + r, hd - r, r, Math.PI/2, Math.PI, false);
  s.lineTo(-hw, -hd + r); s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI*1.5, false);
  return s;
}

/* 12 栋楼: 基座/圆角棱立面盒/屋顶/女儿墙/核心筒/门厅雨棚; 初始压扁待 intro 生长 */
export function createBuildings(scene, buildings, roomsByB){
  const groups = [];
  const pickMeshes = [];
  const labels = [];
  const facades = [];

  buildings.forEach((b, idx)=>{
    const w = b.type === '洋房' ? 44 : 38;
    const d = b.type === '洋房' ? 16 : 14;
    const h = heightOf(b);
    const group = new THREE.Group();
    group.position.set(b.x, 0, b.z);

    const pod = new THREE.Mesh(
      new THREE.BoxGeometry(w+3.2, 1.4, d+3.2),
      new THREE.MeshStandardMaterial({ color: 0x171f29, roughness: .9, metalness: .05 })
    );
    regColor(pod.material.color, 0x171f29, 0x2c3540);
    pod.position.y = 0.7;
    pod.castShadow = true; pod.receiveShadow = true;
    group.add(pod);

    const facadeMat = new THREE.MeshStandardMaterial({
      map: null, emissiveMap: null, emissive: 0xffffff, emissiveIntensity: 0.95,
      roughness: 0.48, metalness: 0.22
    });
    const entry = { mat: facadeMat, b, n: makeFacade(b, false, roomsByB), d: null, mk: (bb, day)=>makeFacade(bb, day, roomsByB) };
    facades.push(entry);
    facadeMat.map = entry.n.map;
    facadeMat.emissiveMap = entry.n.glow;
    const sideCols = b.type === '洋房' ? 4 : 3;
    const mkSideMat = endCol => {
      const m = new THREE.MeshStandardMaterial({
        map: null, emissiveMap: null, emissive: 0xffffff, emissiveIntensity: 0.8,
        roughness: 0.55, metalness: 0.16
      });
      const en = { mat: m, b, n: makeSide(b, false, roomsByB, endCol), d: null, mk: (bb, day)=>makeSide(bb, day, roomsByB, endCol) };
      facades.push(en);
      m.map = en.n.map;
      m.emissiveMap = en.n.glow;
      return m;
    };
    /* px 面(+x 端)贴邻立面 col 0, nx 面(-x 端)贴邻立面 col cols-1 */
    const sideMatPx = mkSideMat(0);
    const sideMatNx = mkSideMat(sideCols-1);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x565b62, roughness: 0.9, metalness: 0.08 });
    regColor(roofMat.color, 0x565b62, 0x474e59);
    /* 四面香槟铝板 + 竖棱圆角(顶部保持锐利直角); 材质组序同旧 BoxGeometry: 0=px 1=nx 2=顶 4=pz 5=nz */
    const rc = b.type === '洋房' ? 2.4 : 2.0;
    const body = new THREE.Mesh(
      roundedWallGeometry(w, d, h, rc),
      [sideMatPx, sideMatNx, roofMat, roofMat, facadeMat, facadeMat]
    );
    body.position.y = 1.4;
    body.castShadow = true; body.receiveShadow = true;
    body.userData.b = b;
    group.add(body);
    pickMeshes.push(body);

    const roofShape = roundedRectShape(w + 0.9, d + 0.9, rc);
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 0.9, bevelEnabled: false });
    roofGeo.rotateX(-Math.PI/2);
    const roof = new THREE.Mesh(
      roofGeo,
      new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: .85, metalness: .05 })
    );
    regColor(roof.material.color, 0x8a8478, 0x746e62);
    roof.position.y = 1.4 + h;
    roof.castShadow = true;
    group.add(roof);

    const paraMat = new THREE.MeshStandardMaterial({ color: 0xaaa294, roughness: .82, metalness: .06 });
    regColor(paraMat.color, 0xaaa294, 0x8e8471);
    const paraShape = roundedRectShape(w + 0.9, d + 0.9, rc);
    const paraHole = roundedRectShape(w + 0.2, d + 0.2, Math.max(rc - 0.35, 0.1));
    paraShape.holes.push(paraHole);
    const paraGeo = new THREE.ExtrudeGeometry(paraShape, { depth: 1.1, bevelEnabled: false });
    paraGeo.rotateX(-Math.PI/2);
    const para = new THREE.Mesh(paraGeo, paraMat);
    para.position.y = 1.4 + h + 0.4;
    para.castShadow = true;
    group.add(para);

    if(b.type !== '洋房'){
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(w*0.32, 3.2, d*0.42),
        new THREE.MeshStandardMaterial({ color: 0x6e7278, roughness: .85 })
      );
      core.position.set(-w*0.18, 1.4 + h + 1.6, 0);
      core.castShadow = true;
      group.add(core);
    }else{
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(w*0.22, 2.2, d*0.34),
        new THREE.MeshStandardMaterial({ color: 0x77756e, roughness: .88 })
      );
      core.position.set(w*0.12, 1.4+h+1.5, -d*0.1);
      core.castShadow = true;
      group.add(core);
    }

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(w*0.34, 0.35, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x42464c, roughness: .75, metalness: .12 })
    );
    canopy.position.set(0, 4.25, d/2+1.0);
    canopy.castShadow = true;
    group.add(canopy);
    const ent = new THREE.Mesh(
      new THREE.PlaneGeometry(w*0.34, 2.0),
      new THREE.MeshBasicMaterial({ color: 0xffbe72, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ent.position.set(0, 4.6, d/2 + 0.06);
    group.add(ent);

    const label = makeLabel(b);
    label.position.set(b.x, 64, b.z);
    scene.add(label);
    labels.push(label);

    group.scale.y = 0.001;
    group.userData.idx = idx;
    scene.add(group);
    groups.push(group);
  });

  function setFacadeMaps(day){
    facades.forEach(f=>{
      const k = day ? 'd' : 'n';
      if(!f[k]) f[k] = f.mk(f.b, day);
      f.mat.map = f[k].map;
      f.mat.emissiveMap = f[k].glow;
      f.mat.needsUpdate = true;
    });
  }

  return { groups, pickMeshes, labels, setFacadeMaps };
}
