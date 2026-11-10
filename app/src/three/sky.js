import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { SKY_RADIUS } from './constants.js';

/* 天空穹顶纹理: 夜=星空+月亮, 日=蓝天+太阳+云 */
export function makeSky(day){
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 1024);
  if(day){
    grd.addColorStop(0,'#3f74b8'); grd.addColorStop(.45,'#7fa9d8');
    grd.addColorStop(.78,'#bcd4e6'); grd.addColorStop(.94,'#dee0d8');
    grd.addColorStop(1,'#f0e2c8');
  }else{
    grd.addColorStop(0,'#01030a'); grd.addColorStop(.55,'#071019'); grd.addColorStop(1,'#122036');
  }
  g.fillStyle = grd; g.fillRect(0, 0, 2048, 1024);
  const rnd = mulberry32(day ? 20261105 : 20261104);
  if(day){
    const sx = 1560, sy = 380;
    const sg = g.createRadialGradient(sx, sy, 10, sx, sy, 360);
    sg.addColorStop(0,'rgba(255,252,235,.95)'); sg.addColorStop(.22,'rgba(255,246,205,.5)'); sg.addColorStop(1,'rgba(255,246,205,0)');
    g.fillStyle = sg; g.fillRect(0, 0, 2048, 1024);
    g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(sx, sy, 34, 0, 7); g.fill();
    for(let i = 0; i < 18; i++){
      const cx = rnd()*2048, cy = 140+rnd()*600, s = 30+rnd()*58;
      const puffs = 5 + Math.floor(rnd()*6);
      for(let j = 0; j < puffs; j++){
        const ox = (rnd()-.5)*s*3.4, oy = (rnd()-.5)*s*.8, r = s*(.5+rnd()*.65);
        const a = .10 + rnd()*.20;
        const cg = g.createRadialGradient(cx+ox, cy+oy, 0, cx+ox, cy+oy, r);
        cg.addColorStop(0,`rgba(255,255,255,${a})`); cg.addColorStop(1,'rgba(255,255,255,0)');
        g.fillStyle = cg; g.beginPath(); g.arc(cx+ox, cy+oy, r, 0, 7); g.fill();
      }
    }
  }else{
    for(let i = 0; i < 850; i++){
      const x = rnd()*2048, y = rnd()*880;
      const r = rnd()*1.3+.3, a = .2+rnd()*.75;
      g.fillStyle = `rgba(${220+Math.floor(rnd()*35)},${228+Math.floor(rnd()*27)},255,${a})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    const mx = 400, my = 190;
    const mg = g.createRadialGradient(mx, my, 8, mx, my, 150);
    mg.addColorStop(0,'rgba(228,238,252,.55)'); mg.addColorStop(1,'rgba(228,238,252,0)');
    g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 150, 0, 7); g.fill();
    g.fillStyle = '#e9eff9'; g.beginPath(); g.arc(mx, my, 26, 0, 7); g.fill();
    g.fillStyle = 'rgba(190,205,228,.5)';
    g.beginPath(); g.arc(mx-8, my-6, 5, 0, 7); g.fill();
    g.beginPath(); g.arc(mx+9, my+8, 4, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSkyDome(scene, tex){
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 48, 24),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, transparent: true, depthWrite: false })
  );
  m.renderOrder = -1;
  scene.add(m);
  return m;
}
