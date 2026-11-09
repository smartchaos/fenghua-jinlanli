import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { SITE_PAL } from './palette.js';
import { grainOverlay } from './theme.js';
import { SITE_W, SITE_D, SITE_LIFT } from './constants.js';

const W = 1680, H = 1960;
const px = x => (x + SITE_W/2) / SITE_W * W;
const py = z => (z + SITE_D/2) / SITE_D * H;

/* 树影: 径向渐隐取代实心椭圆, 让地面有林下透光感 */
function softShade(g, x, y, rx, ry, rot, rgb, a){
  g.save();
  g.translate(x, y); g.rotate(rot); g.scale(rx, ry);
  const rg = g.createRadialGradient(0, 0, 0.08, 0, 0, 1);
  rg.addColorStop(0, `rgba(${rgb},${a})`);
  rg.addColorStop(.55, `rgba(${rgb},${a*0.7})`);
  rg.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = rg;
  g.beginPath(); g.arc(0, 0, 1, 0, Math.PI*2); g.fill();
  g.restore();
}

/* 平台顶地块分片(东侧 x59.8..83 / z0.5..29.5 为门洞通道, 留在 y=0) */
const PLOT_RECTS = [
  { x0:-105, x1:83,   z0:-138, z1:0.5,  seed:11 },
  { x0:-105, x1:83,   z0:29.5, z1:97,   seed:22 },
  { x0:-105, x1:59.8, z0:0.5,  z1:29.5, seed:33 },
];

/* 模纹花坛工具: 画布坐标经 M(px/py/sx/sy) 映射, 越界内容自然裁掉 */
function bedTools(g, P, M){
  const F = P.flower;
  const Sx = v => v * M.sx, Sy = v => v * M.sy;
  function circleBed(cx, cz, r, ringCol, fillCol, dotCol){
    const X = M.px(cx), Y = M.py(cz), R = Sx(r), RW = Sx(0.8);
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
    const Y = x => M.py(zc + amp*Math.sin(x*0.055));
    g.fillStyle = F.soil;
    g.beginPath();
    let first = true;
    for(let x = x0; x <= x1; x += 2){ const X = M.px(x); if(first){ g.moveTo(X, Y(x)-hw); first = false; } else g.lineTo(X, Y(x)-hw); }
    for(let x = x1; x >= x0; x -= 2){ g.lineTo(M.px(x), Y(x)+hw); }
    g.closePath(); g.fill();
    let k = 0;
    for(let x = x0+2; x < x1-1; x += 3.2){
      g.fillStyle = (k%2) ? colA : colB;
      g.beginPath(); g.arc(M.px(x), Y(x)-hw*0.45, 1.7, 0, Math.PI*2); g.fill();
      g.fillStyle = (k%2) ? colB : colA;
      g.beginPath(); g.arc(M.px(x+1.6), Y(x)+hw*0.45, 1.7, 0, Math.PI*2); g.fill();
      k++;
    }
  }
  function diamondPatch(cx, cz, cols, rows, size, colA, colB){
    g.fillStyle = F.soil;
    g.fillRect(M.px(cx - cols*size), M.py(cz - rows*size), Sx(cols*size*2), Sy(rows*size*2));
    const sx = Sx(size), sy = Sy(size);
    for(let i = 0; i < cols*2; i++){
      for(let j = 0; j < rows*2; j++){
        const X = M.px(cx - cols*size + (i+0.5)*size), Y = M.py(cz - rows*size + (j+0.5)*size);
        g.fillStyle = ((i+j)%2) ? colA : colB;
        g.beginPath();
        g.moveTo(X, Y-sy*0.42); g.lineTo(X+sx*0.42, Y); g.lineTo(X, Y+sy*0.42); g.lineTo(X-sx*0.42, Y);
        g.closePath(); g.fill();
      }
    }
  }
  return { circleBed, waveBand, diamondPatch };
}

/* 平台顶单分片内容: 草地/步道/绿带/模纹花坛/树冠投影, 树落点带 y=SITE_LIFT */
function drawPlot(g, P, M, rects, R, treeSpots, spotKeys){
  const { px, py } = M;
  g.fillStyle = P.plot;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);

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
    g.beginPath(); g.ellipse(px(x), py(z), w*M.sx, d*M.sy, 0, 0, Math.PI*2); g.fill();
  });

  const F = P.flower;
  const B = bedTools(g, P, M);
  /* 南侧花坛在本分片之外时自然裁掉; 底层(y=0)另画一份 */
  B.circleBed(10, 118, 13, F.red, F.greenHi, F.white);
  B.circleBed(-48, 118, 8, F.pink, F.green, F.yellow);
  B.circleBed(66, 118, 8, F.orange, F.green, F.red);
  B.waveBand(131, 2.2, F.yellow, F.red, -106, 95);
  B.diamondPatch(-88, 110, 2, 2, 4.5, F.pink, F.white);
  B.diamondPatch(85, 109, 2, 2, 4.5, F.yellow, F.orange);
  /* 北侧: 双波浪花带 + 小圆坛一列 */
  B.waveBand(-127, 2.0, F.pink, F.white, -106, 95);
  B.waveBand(-112, 1.8, F.yellow, F.orange, -106, 95);
  [-80,-52,-24,4,32,60,88].forEach(x=> B.circleBed(x, -119.5, 3.5, F.red, F.green, F.white));

  /* 树冠投影 + 三维树落点(仅在本分片内登记一次) */
  const rnd = mulberry32(20261104 + R.seed*1000);
  function addTree(x, z, s, kind){
    const rr = 2.6 + rnd()*4.4;
    const shade = P.treeLo + Math.floor(rnd()*P.treeSpan);
    softShade(g, px(x), py(z), rr*2.7, rr*2.1, rnd()*3,
      `${shade},${shade+34},${shade+18}`, 0.45);
    const key = x.toFixed(1) + ',' + z.toFixed(1);
    if(x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1 && !spotKeys.has(key)){
      spotKeys.add(key);
      treeSpots.push({ x, z, s, kind, y: SITE_LIFT + 0.10 });
    }
  }
  /* 沿南/北围墙列植行道树 */
  for(let x = -100; x <= 100; x += 12){
    addTree(x + (rnd()-.5)*2, 95 + (rnd()-.5)*2, 0.82 + rnd()*0.35, rnd());
    addTree(x + (rnd()-.5)*2, -135 + (rnd()-.5)*2, 0.82 + rnd()*0.35, rnd());
  }
  /* 沿西侧列植 */
  for(let z = -125; z <= 85; z += 13){
    addTree(-98 + (rnd()-.5)*2, z, 0.8 + rnd()*0.4, rnd());
  }
  for(let i = 0; i < 150; i++){
    const x = -110 + rnd()*220;
    const z = -95 + rnd()*190;
    if(rects.some(r=>Math.abs(x-r.x) < r.w && Math.abs(z-r.z) < r.d)) continue;
    if(x > 97 && x < 123) continue;
    if(x > 48 && x < 86 && z > -10 && z < 40) continue;   // 避让东门楼与入口广场
    addTree(x, z, 0.75 + rnd()*0.75, rnd());
  }
  grainOverlay(g, g.canvas.width, g.canvas.height, 0.85);
}

/* 地面双层: 底层(y=0)外围基底/河道/道路/南侧花坛 + 平台顶(SITE_LIFT)地块分片。
 * 返回底层纹理、平台分片数组与树冠落点(含抬高后的 y)。 */
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
  /* 日照碎光: 短横纹随太阳方向聚集, 让水面有镜面高光 */
  const glint = g.createLinearGradient(0, 0, W, 0);
  glint.addColorStop(0, day ? 'rgba(255,244,214,.01)' : 'rgba(170,205,225,.01)');
  glint.addColorStop(.62, day ? 'rgba(255,248,225,.07)' : 'rgba(170,205,225,.04)');
  glint.addColorStop(1, day ? 'rgba(255,244,214,.015)' : 'rgba(170,205,225,.01)');
  g.fillStyle = glint; g.fillRect(0, 0, W, py(-142));
  const hash = i => { const v = Math.sin(i*127.1)*43758.5453; return v - Math.floor(v); };
  g.strokeStyle = day ? 'rgba(255,250,232,.34)' : 'rgba(170,205,225,.12)';
  g.lineWidth = 1.4;
  for(let i = 0; i < 240; i++){
    const gx = hash(i*3)*W, gy = hash(i*3+1)*py(-142);
    g.globalAlpha = 0.08 + hash(i*3+2)*0.28;
    g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + 6 + hash(i*7)*24, gy); g.stroke();
  }
  g.globalAlpha = 1;
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

  /* ---------- 南侧模纹花坛(在平台以南, 留在底层; 北侧花坛在平台顶分片内) ---------- */
  const F = P.flower;
  const M0 = { px, py, sx: W/SITE_W, sy: H/SITE_D };
  const B0 = bedTools(g, P, M0);
  B0.circleBed(10, 118, 13, F.red, F.greenHi, F.white);
  B0.circleBed(-48, 118, 8, F.pink, F.green, F.yellow);
  B0.circleBed(66, 118, 8, F.orange, F.green, F.red);
  B0.waveBand(131, 2.2, F.yellow, F.red, -106, 95);
  B0.diamondPatch(-88, 110, 2, 2, 4.5, F.pink, F.white);
  B0.diamondPatch(85, 109, 2, 2, 4.5, F.yellow, F.orange);

  /* 东侧退线绿带(x=94)行道树留在底层 y=0 */
  const treeSpots = [];
  const rnd0 = mulberry32(20261104);
  for(let z = -125; z <= 85; z += 13){
    if(z >= -2 && z <= 32) continue;
    const x = 94 + (rnd0-.5)*2, zz = z + (rnd0-.5)*2;
    treeSpots.push({ x, z: zz, s: 0.8 + rnd0()*0.4, kind: rnd0(), y: 0 });
    const rr = 2.6 + rnd0()*4.4;
    const shade = P.treeLo + Math.floor(rnd0()*P.treeSpan);
    softShade(g, px(x), py(zz), rr*2.7, rr*2.1, rnd0()*3,
      `${shade},${shade+34},${shade+18}`, 0.45);
  }

  /* 地形起伏: 低频明暗斑, 消除整片纯色草坪的平面感 */
  const mottle = i => { const v = Math.sin(i*78.233)*43758.5453; return v - Math.floor(v); };
  g.save(); g.globalCompositeOperation = 'soft-light';
  for(let i = 0; i < 52; i++){
    const cx = mottle(i*4)*W, cy = mottle(i*4+1)*H, r = 180 + mottle(i*4+2)*300;
    const dark = mottle(i*4+3) > .5;
    const mg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    mg.addColorStop(0, dark ? 'rgba(40,50,34,.07)' : 'rgba(255,250,225,.06)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mg; g.fillRect(cx-r, cy-r, r*2, r*2);
  }
  g.restore();

  g.textAlign = 'center'; g.fillStyle = P.lblRiver; g.font = '500 30px "PingFang SC",sans-serif';
  g.fillText('电 厂 河', px(0), py(-161));
  g.save(); g.translate(px(110), py(10)); g.rotate(Math.PI/2); g.fillStyle = P.lblRoad; g.fillText('顾 扬 路', 0, 0); g.restore();
  g.textAlign = 'left'; g.fillStyle = P.lblRoad; g.fillText('朱 家 坝 路', px(-60), py(152));
  grainOverlay(g, W, H, 0.85);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;

  /* ---------- 平台顶地块分片(y=SITE_LIFT), 东侧门洞通道留在底层 ---------- */
  const rects = buildings.map(b=>({ x:b.x, z:b.z, w:(b.type==='洋房'?44:38)/2+7, d:(b.type==='洋房'?16:14)/2+7 }));
  const spotKeys = new Set();
  const plots = PLOT_RECTS.map(R=>{
    const cw = Math.round((R.x1-R.x0)*7), ch = Math.round((R.z1-R.z0)*7);
    const pcv = document.createElement('canvas'); pcv.width = cw; pcv.height = ch;
    const M = { px: x => (x-R.x0)*7, py: z => (z-R.z0)*7, sx: 7, sy: 7 };
    drawPlot(pcv.getContext('2d'), P, M, rects, R, treeSpots, spotKeys);
    const ptex = new THREE.CanvasTexture(pcv);
    ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = maxAnisotropy;
    return { tex: ptex, w: R.x1-R.x0, d: R.z1-R.z0, cx: (R.x0+R.x1)/2, cz: (R.z0+R.z1)/2 };
  });

  return { tex, plots, treeSpots };
}

/* 外围草甸贴图（旷野风格，日夜双套） */
export function drawMeadow(day){
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 2048;
  const g = cv.getContext('2d');
  const P = day
    ? { base:['#7e9a63','#6b8855'], patch:['#89a56c','#5f7d4c','#98b377','#6e8c58'], path:'rgba(190,170,125,.5)', dot:['#e6eed8','#eee0a8','#d6e6f0','#ebd3d8'] }
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
  grainOverlay(g, 2048, 2048, 0.7);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
