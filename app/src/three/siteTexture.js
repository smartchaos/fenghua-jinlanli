import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { SITE_PAL } from './palette.js';
import { SITE_W, SITE_D } from './constants.js';

const W = 1680, H = 1960;
const px = x => (x + SITE_W/2) / SITE_W * W;
const py = z => (z + SITE_D/2) / SITE_D * H;

/* 小区平面纹理(1680×1960 canvas): 底草/河谷/道路/步道/绿带/模纹花坛/树冠投影/水系标注。
 * 返回纹理与树冠落点(供三维树共用同一随机分布)。 */
export function createSite(day, buildings, maxAnisotropy){
  const P = SITE_PAL[day ? 'day' : 'night'];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = P.base; g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W*0.5, H*0.55, 100, W*0.5, H*0.5, W*0.72);
  vg.addColorStop(0, P.vig); vg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);

  g.fillStyle = P.plot;
  g.fillRect(px(-105), py(-140), px(105)-px(-105), py(98)-py(-140));

  const rg = g.createLinearGradient(0, py(-178), 0, py(-142));
  rg.addColorStop(0, P.river[0]); rg.addColorStop(.55, P.river[1]); rg.addColorStop(1, P.river[2]);
  g.fillStyle = rg; g.fillRect(0, 0, W, py(-142));
  g.strokeStyle = P.wave; g.lineWidth = 2;
  for(let i = 0; i < 16; i++){
    const y = py(-176) + i*24;
    g.beginPath();
    for(let x = 0; x <= W; x += 24){
      const yy = y + Math.sin(x*0.008 + i)*5;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.fillStyle = P.bank; g.fillRect(0, py(-143.4), W, py(-142)-py(-143.4));
  g.fillStyle = P.bankEdge; g.fillRect(0, py(-142.2), W, 2);

  g.fillStyle = P.road;
  g.fillRect(px(100), 0, px(120)-px(100), H);
  g.fillRect(0, py(140), W, py(160)-py(140));
  g.strokeStyle = P.roadDash; g.lineWidth = 2;
  // 直行优先: 东路(南北向)中线贯穿交叉口, z140..160 实线通过; 南路(东西向)中线止于东路西缘, 不横穿
  g.setLineDash([22, 26]);
  g.beginPath(); g.moveTo(px(110), 0); g.lineTo(px(110), py(140)); g.stroke();
  g.beginPath(); g.moveTo(px(110), py(160)); g.lineTo(px(110), H); g.stroke();
  g.setLineDash([]);
  g.beginPath(); g.moveTo(px(110), py(140)); g.lineTo(px(110), py(160)); g.stroke();
  g.setLineDash([22, 26]);
  g.beginPath(); g.moveTo(0, py(150)); g.lineTo(px(100), py(150)); g.stroke();
  g.setLineDash([]);

  g.strokeStyle = P.path; g.lineWidth = 24; g.lineCap = 'round'; g.lineJoin = 'round';
  const paths = [
    [[-40,-95],[-40,95]], [[10,-95],[10,95]], [[60,-95],[60,95]],
    [[-110,71],[110,71]], [[-110,47],[110,47]],
    [[-110,15],[110,15]], [[-110,-68],[110,-68]], [[-110,95],[110,95]],
  ];
  paths.forEach(p=>{
    g.beginPath();
    p.forEach(([x, z], i)=> i ? g.lineTo(px(x), py(z)) : g.moveTo(px(x), py(z)));
    g.stroke();
  });
  g.strokeStyle = P.pathDash; g.lineWidth = 1.5; g.setLineDash([10, 16]);
  paths.forEach(p=>{
    g.beginPath();
    p.forEach(([x, z], i)=> i ? g.lineTo(px(x), py(z)) : g.moveTo(px(x), py(z)));
    g.stroke();
  });
  g.setLineDash([]);

  g.fillStyle = P.belt;
  [[-70,71,30,8],[-15,71,30,8],[35,71,30,8],[80,71,30,8],
   [-70,47,30,8],[-15,47,30,8],[35,47,30,8],[80,47,30,8],
   [-70,15,30,8],[-15,15,30,8],[35,15,30,8],[80,15,30,8],
   [-70,-68,30,8],[-15,-68,30,8],[35,-68,30,8],[80,-68,30,8]].forEach(([x, z, w, d])=>{
    g.beginPath(); g.ellipse(px(x), py(z), px(w)-px(0), py(d)-py(0), 0, 0, Math.PI*2); g.fill();
  });

  /* ---------- 南北两侧模纹花坛(鲜花图案) ---------- */
  const F = P.flower;
  const Sx = v => px(v) - px(0);
  const Sy = v => py(v) - py(0);
  function circleBed(cx, cz, r, ringCol, fillCol, dotCol){
    const X = px(cx), Y = py(cz), R = Sx(r), RW = Sx(0.8);
    g.fillStyle = F.edge; g.beginPath(); g.arc(X, Y, R + RW + 1.5, 0, Math.PI*2); g.fill();
    g.fillStyle = F.soil; g.beginPath(); g.arc(X, Y, R + RW, 0, Math.PI*2); g.fill();
    g.fillStyle = fillCol; g.beginPath(); g.arc(X, Y, R, 0, Math.PI*2); g.fill();
    g.strokeStyle = ringCol; g.lineWidth = 2.5;
    g.beginPath(); g.arc(X, Y, R - 1.5, 0, Math.PI*2); g.stroke();
    g.fillStyle = dotCol; g.beginPath(); g.arc(X, Y, Math.max(3, R*0.22), 0, Math.PI*2); g.fill();
    g.fillStyle = ringCol;
    const n = Math.max(10, Math.round(R/2.2));
    for(let i = 0; i < n; i++){
      const a = i/n*Math.PI*2;
      g.beginPath(); g.arc(X + Math.cos(a)*(R-1.5), Y + Math.sin(a)*(R-1.5), 1.6, 0, Math.PI*2); g.fill();
    }
  }
  function waveBand(zc, amp, colA, colB, x0, x1){
    const hw = Sy(2.4);
    const Y = x => py(zc + amp*Math.sin(x*0.055));
    g.fillStyle = F.soil;
    g.beginPath();
    let first = true;
    for(let x = x0; x <= x1; x += 2){ const X = px(x); if(first){ g.moveTo(X, Y(x)-hw); first = false; } else g.lineTo(X, Y(x)-hw); }
    for(let x = x1; x >= x0; x -= 2){ g.lineTo(px(x), Y(x)+hw); }
    g.closePath(); g.fill();
    let k = 0;
    for(let x = x0+2; x < x1-1; x += 3.2){
      g.fillStyle = (k%2) ? colA : colB;
      g.beginPath(); g.arc(px(x), Y(x)-hw*0.45, 1.7, 0, Math.PI*2); g.fill();
      g.fillStyle = (k%2) ? colB : colA;
      g.beginPath(); g.arc(px(x+1.6), Y(x)+hw*0.45, 1.7, 0, Math.PI*2); g.fill();
      k++;
    }
  }
  function diamondPatch(cx, cz, cols, rows, size, colA, colB){
    g.fillStyle = F.soil;
    g.fillRect(px(cx - cols*size), py(cz - rows*size), Sx(cols*size*2), Sy(rows*size*2));
    const sx = Sx(size), sy = Sy(size);
    for(let i = 0; i < cols*2; i++){
      for(let j = 0; j < rows*2; j++){
        const X = px(cx - cols*size + (i+0.5)*size), Y = py(cz - rows*size + (j+0.5)*size);
        g.fillStyle = ((i+j)%2) ? colA : colB;
        g.beginPath();
        g.moveTo(X, Y-sy*0.42); g.lineTo(X+sx*0.42, Y); g.lineTo(X, Y+sy*0.42); g.lineTo(X-sx*0.42, Y);
        g.closePath(); g.fill();
      }
    }
  }
  /* 南侧: 中轴主花坛 + 两侧圆坛 + 波浪花带 + 菱形格纹 */
  circleBed(10, 118, 13, F.red, F.greenHi, F.white);
  circleBed(-48, 118, 8, F.pink, F.green, F.yellow);
  circleBed(66, 118, 8, F.orange, F.green, F.red);
  waveBand(131, 2.2, F.yellow, F.red, -106, 95);
  diamondPatch(-88, 110, 2, 2, 4.5, F.pink, F.white);
  diamondPatch(85, 109, 2, 2, 4.5, F.yellow, F.orange);
  /* 北侧: 双波浪花带 + 小圆坛一列 */
  waveBand(-127, 2.0, F.pink, F.white, -106, 95);
  waveBand(-112, 1.8, F.yellow, F.orange, -106, 95);
  [-80,-52,-24,4,32,60,88].forEach(x=> circleBed(x, -119.5, 3.5, F.red, F.green, F.white));

  const rects = buildings.map(b=>({ x:b.x, z:b.z, w:(b.type==='洋房'?44:38)/2+7, d:(b.type==='洋房'?16:14)/2+7 }));
  const rnd = mulberry32(20261104);
  const treeSpots = [];
  for(let i = 0; i < 230; i++){
    const x = -110 + rnd()*220;
    const z = -95 + rnd()*190;
    if(rects.some(r=>Math.abs(x-r.x) < r.w && Math.abs(z-r.z) < r.d)) continue;
    if(x > 97 && x < 123) continue;                                   // 避让东路(x100..120)及树冠
    treeSpots.push({ x, z, s:0.75+rnd()*0.75, kind:rnd() });
    const rr = 2.6 + rnd()*4.4;
    const shade = P.treeLo + Math.floor(rnd()*P.treeSpan);
    g.fillStyle = P.treeFill(shade);
    g.beginPath(); g.ellipse(px(x), py(z), rr*2.6, rr*2.0, rnd()*3, 0, Math.PI*2); g.fill();
    g.fillStyle = P.treeHi;
    g.beginPath(); g.ellipse(px(x)-3, py(z)-3, rr*1.2, rr*0.9, 0, 0, Math.PI*2); g.fill();
  }

  g.textAlign = 'center'; g.fillStyle = P.lblRiver; g.font = '500 30px "PingFang SC",sans-serif';
  g.fillText('电 厂 河', px(0), py(-161));
  g.save(); g.translate(px(110), py(10)); g.rotate(Math.PI/2); g.fillStyle = P.lblRoad; g.fillText('顾 扬 路', 0, 0); g.restore();
  g.textAlign = 'left'; g.fillStyle = P.lblRoad; g.fillText('朱 家 坝 路', px(-60), py(152));

  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = maxAnisotropy;
  return { tex, treeSpots };
}

/* 外围草甸贴图（旷野风格，日夜双套） */
export function drawMeadow(day){
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 2048;
  const g = cv.getContext('2d');
  const P = day
    ? { base:['#8abd63','#7aac55'], patch:['#9ccc6e','#6da148','#aad479','#7fb35a'], path:'rgba(203,178,122,.55)', dot:['#eef6dd','#f4e9ae','#dcefff','#f2d8e0'] }
    : { base:['#15261b','#101e14'], patch:['#1a2f21','#0d1a12','#1d3325','#132419'], path:'rgba(70,64,42,.35)', dot:['#33503f','#3d4a38','#2e4460'] };
  const grd = g.createLinearGradient(0, 0, 2048, 2048);
  grd.addColorStop(0, P.base[0]); grd.addColorStop(1, P.base[1]);
  g.fillStyle = grd; g.fillRect(0, 0, 2048, 2048);
  const rnd = mulberry32(day ? 20261109 : 20261110);
  for(let i = 0; i < 280; i++){
    const x = rnd()*2048, y = rnd()*2048, r = 26+rnd()*130;
    g.globalAlpha = .18+rnd()*.3;
    g.fillStyle = P.patch[Math.floor(rnd()*P.patch.length)];
    g.beginPath(); g.ellipse(x, y, r, r*(.4+rnd()*.45), rnd()*3, 0, Math.PI*2); g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = P.path; g.lineWidth = 24; g.lineCap = 'round';
  [[-600,-500,-260,-140,40,-320],[300,600,520,260,640,-60]].forEach(seg=>{
    g.beginPath();
    g.moveTo(1024+seg[0], 1024+seg[1]);
    g.bezierCurveTo(1024+seg[2], 1024+seg[3], 1024+seg[2], 1024+seg[3], 1024+seg[4], 1024+seg[5]);
    g.stroke();
  });
  for(let i = 0; i < 420; i++){
    g.globalAlpha = .3+rnd()*.4;
    g.fillStyle = P.dot[Math.floor(rnd()*P.dot.length)];
    g.beginPath(); g.arc(rnd()*2048, rnd()*2048, 2+rnd()*3.2, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  return tex;
}
