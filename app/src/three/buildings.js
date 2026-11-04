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
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
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
  map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
  const glow = new THREE.CanvasTexture(em);
  glow.encoding = THREE.sRGBEncoding; glow.anisotropy = 8;
  return { map, glow };
}

/* 12 栋楼: 基座/立面盒/屋顶/女儿墙/核心筒/门厅雨棚; 初始压扁待 intro 生长 */
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
      roughness: 0.78, metalness: 0.04
    });
    const entry = { mat: facadeMat, b, n: makeFacade(b, false, roomsByB), d: null };
    facades.push(entry);
    facadeMat.map = entry.n.map;
    facadeMat.emissiveMap = entry.n.glow;
    const endMat = new THREE.MeshStandardMaterial({ color: 0xc4bbab, roughness: 0.88, metalness: 0.03 });
    regColor(endMat.color, 0xc4bbab, 0xa3967a);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x565b62, roughness: 0.9, metalness: 0.08 });
    regColor(roofMat.color, 0x565b62, 0x474e59);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [endMat, endMat, roofMat, roofMat, facadeMat, facadeMat]);
    body.position.y = 1.4 + h/2;
    body.castShadow = true; body.receiveShadow = true;
    body.userData.b = b;
    group.add(body);
    pickMeshes.push(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w+0.9, 0.9, d+0.9),
      new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: .85, metalness: .05 })
    );
    regColor(roof.material.color, 0x8a8478, 0x746e62);
    roof.position.y = 1.4 + h + 0.45;
    roof.castShadow = true;
    group.add(roof);

    const paraMat = new THREE.MeshStandardMaterial({ color: 0xaaa294, roughness: .82, metalness: .06 });
    regColor(paraMat.color, 0xaaa294, 0x8e8471);
    const frontBack = new THREE.BoxGeometry(w+0.9, 1.1, 0.35);
    [-1, 1].forEach(s=>{
      const p = new THREE.Mesh(frontBack, paraMat);
      p.position.set(0, 1.4+h+0.95, s*(d+0.9)/2);
      p.castShadow = true; group.add(p);
    });
    const sideGeo = new THREE.BoxGeometry(0.35, 1.1, d+0.9);
    [-1, 1].forEach(s=>{
      const p = new THREE.Mesh(sideGeo, paraMat);
      p.position.set(s*(w+0.9)/2, 1.4+h+0.95, 0);
      p.castShadow = true; group.add(p);
    });

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
      if(!f[k]) f[k] = makeFacade(f.b, day, roomsByB);
      f.mat.map = f[k].map;
      f.mat.emissiveMap = f[k].glow;
      f.mat.needsUpdate = true;
    });
  }

  return { groups, pickMeshes, labels, setFacadeMaps };
}
