import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { RX, SITE_LIFT } from './constants.js';
import { regColor, flatMat } from './theme.js';

/* 小区乔木（与平面纹理的树冠投影共用同一批落点） */
export function createVegetation(scene, treeSpots){
  function makeTree(x, z, s, kind, y = SITE_LIFT){
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(s);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x4b3321, roughness: 0.95 })
    );
    regColor(trunk.material.color, 0x4b3321, 0x7a5636);
    trunk.position.y = 1.2;
    trunk.castShadow = true;
    group.add(trunk);
    const ki = kind > .66 ? 0 : kind > .33 ? 1 : 2;
    const colors = [[0x143b24, 0x1d4a2c], [0x163f25, 0x235a30], [0x12321f, 0x1b4627]][ki];
    const days = [[0x2f7a44, 0x3c9152], [0x35834a, 0x46a05c], [0x2b6e3d, 0x3b8a4e]][ki];
    /* 阔叶树冠(香樟/榉树): 2~3 团低多边形球体, 取代针叶锥形 */
    const blob = (rr, sx, sy, sz, px, py, pz, ci)=>{
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(rr, 1),
        new THREE.MeshStandardMaterial({ color: colors[ci], roughness: 0.92, flatShading: true })
      );
      regColor(m.material.color, colors[ci], days[ci]);
      m.scale.set(sx, sy, sz); m.position.set(px, py, pz);
      m.castShadow = true; group.add(m);
    };
    blob(2.7, 1.15, 0.92, 1.05, 0, 4.3, 0, 0);
    blob(1.9, 1.0, 0.9, 1.0, 1.5, 5.2, 0.6, 1);
    blob(1.6, 1.0, 0.9, 1.0, -1.4, 4.9, -0.9, 1);
    return group;
  }
  treeSpots.forEach(p=>scene.add(makeTree(p.x, p.z, p.s, p.kind, p.y)));
}

/* ---------- 京杭大运河（西侧中远景）+ 驳岸 + 滨河绿带 ---------- */

/* 运河护坡树 */
export function createCanalTrees(canalGrp){
  const cwTrunk = new THREE.MeshStandardMaterial({ color: 0x4b3321, roughness: 0.95 });
  regColor(cwTrunk.color, 0x4b3321, 0x7a5636);
  const cwLeafA = new THREE.MeshStandardMaterial({ color: 0x143b24, roughness: 0.92 });
  regColor(cwLeafA.color, 0x143b24, 0x2f7a44);
  const cwLeafB = new THREE.MeshStandardMaterial({ color: 0x163f25, roughness: 0.92 });
  regColor(cwLeafB.color, 0x163f25, 0x35834a);
  function cwTree(x, z, s){
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.2, 5), cwTrunk); tr.position.y = 1.1; g.add(tr);
    const lf = cwRnd() < 0.5 ? cwLeafA : cwLeafB;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 4.2, 6), lf); c1.position.y = 3.8; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.0, 6), lf); c2.position.y = 5.4; g.add(c2);
    return g;
  }
  const cwRnd = mulberry32(20261106);
  for(let i = 0; i < 32; i++){
    const z = -790 + i*50 + cwRnd()*16;
    if(z > -186 && z < -136) continue;  // 河口缺口
    if(z > 132 && z < 168) continue;    // 南路交叉口
    canalGrp.add(cwTree(-258 + cwRnd()*14, z, 0.9 + cwRnd()*0.7));
  }
}

/* ---------- 旷野之息式外围: 丘陵 / 远山 / 树丛 / 岩石 (低饱和, 不抢焦点) ---------- */
export function createWilds(canalGrp){
  const hillDefs = [
    [330,-350,120,26],[450,150,140,30],[300,470,130,24],
    [-95,590,150,30],[-660,-640,170,36],[560,480,130,26]
  ];
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x1b2f22, roughness: 1, flatShading: true });
  regColor(hillMat.color, 0x1b2f22, 0x77b058);
  const hillGeo = new THREE.SphereGeometry(1, 20, 12);
  hillDefs.forEach(([x, z, r, h])=>{
    const m = new THREE.Mesh(hillGeo, hillMat);
    m.position.set(x, 0, z); m.scale.set(r, h, r);
    canalGrp.add(m);
  });

  const mtnMat = new THREE.MeshStandardMaterial({ color: 0x080d18, roughness: 1, flatShading: true });
  regColor(mtnMat.color, 0x080d18, 0x5f7396);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1c2739, roughness: 1, flatShading: true });
  regColor(capMat.color, 0x1c2739, 0xdde8f2);
  const mtnGeo = new THREE.ConeGeometry(1, 1, 5);
  [[-805,-575,260,135],[288,-874,300,150],[805,-483,240,125],[897,230,260,135],[575,782,280,145],[-518,874,300,150],[-909,345,260,130]].forEach(([x, z, r, h])=>{
    const m = new THREE.Mesh(mtnGeo, mtnMat);
    m.position.set(x, h/2 - 4, z); m.scale.set(r, h, r);
    canalGrp.add(m);
    const cap = new THREE.Mesh(mtnGeo, capMat);
    cap.position.set(x, h - h*0.16 - 4, z); cap.scale.set(r*0.38, h*0.34, r*0.38);
    canalGrp.add(cap);
  });

  const bwTrunk = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 1, flatShading: true });
  regColor(bwTrunk.color, 0x2a2118, 0x8a6b48);
  const bwLeaf1 = new THREE.MeshStandardMaterial({ color: 0x14301e, roughness: 1, flatShading: true });
  regColor(bwLeaf1.color, 0x14301e, 0x5faf52);
  const bwLeaf2 = new THREE.MeshStandardMaterial({ color: 0x17351f, roughness: 1, flatShading: true });
  regColor(bwLeaf2.color, 0x17351f, 0x6cbf5c);
  const bwLeaf3 = new THREE.MeshStandardMaterial({ color: 0x112a19, roughness: 1, flatShading: true });
  regColor(bwLeaf3.color, 0x112a19, 0x4f9e4a);
  const bwTrunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.2, 5);
  const bwBlobGeo = new THREE.SphereGeometry(2.4, 7, 5);
  const bwRnd = mulberry32(20261107);
  function bwTree(x, z, s){
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    const t = new THREE.Mesh(bwTrunkGeo, bwTrunk); t.position.y = 1.6; g.add(t);
    const lf = bwRnd() < .33 ? bwLeaf1 : (bwRnd() < .5 ? bwLeaf2 : bwLeaf3);
    const b1 = new THREE.Mesh(bwBlobGeo, lf); b1.position.y = 4.4; b1.scale.set(1.15, .95, 1.15); g.add(b1);
    const b2 = new THREE.Mesh(bwBlobGeo, lf); b2.position.set(.9, 5.6, .4); b2.scale.setScalar(.72); g.add(b2);
    const b3 = new THREE.Mesh(bwBlobGeo, lf); b3.position.set(-.9, 5.3, -.5); b3.scale.setScalar(.6); g.add(b3);
    return g;
  }
  [[260,-260],[420,-60],[300,260],[60,330],[-180,300],[-60,-280],
   [180,-420],[-260,-320],[520,60],[420,360],[-320,180],[-520,420],
   [620,-260],[240,560],[-140,-480],[640,300]].forEach(([cx, cz])=>{
    const n = 4 + Math.floor(bwRnd()*5);
    for(let i = 0; i < n; i++){
      const a = bwRnd()*6.283, r = 6 + bwRnd()*40;
      const x = cx + Math.cos(a)*r, z = cz + Math.sin(a)*r;
      if(x > -140 && x < 140 && z > -210 && z < 210) continue;                    // 避让小区
      if(x > -460 && x < -240 && z > -560 && z < 560) continue;                    // 避让运河
      if(Math.abs(x - RX) < 13) continue;                                          // 避让东路走廊
      if(Math.abs(z - 150) < 13 && x > -260 && x < 130) continue;                  // 避让南路走廊
      if(hillDefs.some(([hx, hz, hr]) => (x-hx)*(x-hx) + (z-hz)*(z-hz) < (hr+24)*(hr+24))) continue; // 避让丘陵
      canalGrp.add(bwTree(x, z, 0.9 + bwRnd()*0.8));
    }
  });

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x272e38, roughness: 1, flatShading: true });
  regColor(rockMat.color, 0x272e38, 0x98a0ac);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for(let i = 0; i < 12; i++){
    const a = bwRnd()*6.283, r = 220 + bwRnd()*380;
    const x = Math.cos(a)*r, z = Math.sin(a)*r;
    if(x > -460 && x < -240 && z > -560 && z < 560) continue;
    if(Math.abs(x - RX) < 13) continue;
    if(Math.abs(z - 150) < 13 && x > -260 && x < 130) continue;
    const m = new THREE.Mesh(rockGeo, rockMat);
    const s = 1.6 + bwRnd()*3.4;
    m.position.set(x, s*0.4, z); m.scale.set(s, s*0.7, s); m.rotation.y = bwRnd()*3;
    canalGrp.add(m);
  }
}

/* ---------- 白帆与竹排 ---------- */
export function createBoats(canalGrp){
  const hullMat = flatMat(0x241b14, 0x6b4f33);
  const mastMat = flatMat(0x1e1712, 0x54402c);
  const sailMat = flatMat(0x9fadbe, 0xffffff, { side: THREE.DoubleSide });
  const raftMat = flatMat(0x4a3d28, 0xb89b62);
  const raftPoleMat = flatMat(0x554730, 0xc9a86b);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0); sailShape.lineTo(0, 3.9); sailShape.lineTo(2.7, 0.25); sailShape.closePath();
  const sailGeo = new THREE.ShapeGeometry(sailShape);
  function makeSailBoat(){
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.9, 1.7), hullMat);
    hull.position.y = 0.45; g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 4), hullMat);
    bow.rotation.set(0, Math.PI/4, -Math.PI/2);
    bow.position.set(3.05, 0.45, 0); bow.scale.set(1, 1, 0.55); g.add(bow);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.4, 5), mastMat);
    mast.position.y = 3.0; g.add(mast);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.rotation.y = Math.PI/2; sail.position.set(0.12, 1.1, 0); g.add(sail);
    return g;
  }
  function makeRaft(){
    const g = new THREE.Group();
    for(let i = 0; i < 5; i++){
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 6.4, 5), i%2 ? raftMat : raftPoleMat);
      pole.rotation.z = Math.PI/2;
      pole.position.set(0, 0.18, -0.88 + i*0.44);
      g.add(pole);
    }
    const punting = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 4), mastMat);
    punting.position.set(2.4, 1.1, 0.6); punting.rotation.z = 0.5; g.add(punting);
    return g;
  }
  [[-338, 55, 0.35, 'sail'],[-372, -132, -0.2, 'sail'],[-330, 262, 0.15, 'sail'],
   [-358, 168, 0.5, 'raft'],[-344, -258, -0.4, 'raft'],[-186, -161, 0.9, 'sail'],[-252, -161, -0.7, 'raft']
  ].forEach(([x, z, rot, kind])=>{
    const b = kind === 'sail' ? makeSailBoat() : makeRaft();
    b.position.set(x, 0.32, z); b.rotation.y = rot;
    canalGrp.add(b);
  });
}

/* 运河标注 */
export function createCanalLabel(canalGrp){
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
  const g = cv.getContext('2d');
  g.font = '500 72px "PingFang SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.fillText('京 杭 大 运 河', 512, 64);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false });
  regColor(mat.color, 0x93a9be, 0x3d5a74);
  const sp = new THREE.Sprite(mat);
  sp.scale.set(150, 19, 1); sp.position.set(-350, 26, -60);
  canalGrp.add(sp);
}

/* ---------- 小区水景乐园 ---------- */
export function createWaterPlay(scene){
  const group = new THREE.Group();
  group.position.set(0, SITE_LIFT, 16);
  group.scale.set(0.68, 1, 1.32);
  const outline = new THREE.Shape();
  outline.moveTo(-14, 18);
  outline.bezierCurveTo(-22, 5, -18, -12, -12, -25);
  outline.bezierCurveTo(-4, -40, 8, -42, 18, -30);
  outline.bezierCurveTo(24, -15, 20, 2, 14, 18);
  outline.bezierCurveTo(4, 28, -8, 26, -14, 18);

  const shore = new THREE.Mesh(
    new THREE.ShapeGeometry(outline),
    new THREE.MeshStandardMaterial({ color: 0x7d6a4a, roughness: .95, side: THREE.DoubleSide })
  );
  shore.rotation.x = Math.PI/2;
  shore.scale.set(1.08, 0.62, 1);
  shore.position.y = 0.05;
  group.add(shore);

  /* 水面用纯色贴图材质，避免强日光下被压成白色 */
  const water = new THREE.Mesh(
    new THREE.ShapeGeometry(outline),
    flatMat(0x0a3d47, 0x2f8f9f, { transparent: true, opacity: .96, side: THREE.DoubleSide })
  );
  water.rotation.x = Math.PI/2;
  water.scale.set(1, 0.574, 1);
  water.position.y = 0.12;
  group.add(water);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb8a57d, roughness: .9 });
  [[-8,-14],[3,-4],[11,-16]].forEach(([x, z])=>{
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.55, 10), stoneMat);
    stone.position.set(x, 0.38, z);
    stone.castShadow = true;
    group.add(stone);
  });

  const jetMat = new THREE.MeshBasicMaterial({ color: 0xaee8ff, transparent: true, opacity: .45, side: THREE.DoubleSide });
  [[-5,-12],[8,-8]].forEach(([x, z])=>{
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(.18, .32, 3.4, 8), jetMat);
    jet.position.set(x, 1.8, z);
    group.add(jet);
  });
  scene.add(group);

  /* 中央景观圆亭(实景水池北端) */
  const pav = new THREE.Group();
  pav.position.set(0, 0, 44);
  const pvBase = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.4, 0.5, 24),
    new THREE.MeshStandardMaterial({ color: 0xd9d3c6, roughness: .85 })
  );
  pvBase.position.y = SITE_LIFT + 0.25; pvBase.castShadow = true; pvBase.receiveShadow = true;
  pav.add(pvBase);
  const pvColMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: .8 });
  for(let i = 0; i < 6; i++){
    const a = i/6*Math.PI*2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.0, 8), pvColMat);
    col.position.set(Math.cos(a)*3.6, SITE_LIFT + 1.9, Math.sin(a)*3.6);
    col.castShadow = true; pav.add(col);
  }
  const pvRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(4.9, 4.4, 0.7, 24),
    new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: .78 })
  );
  pvRoof.position.y = SITE_LIFT + 3.75; pvRoof.castShadow = true; pav.add(pvRoof);
  scene.add(pav);
}

/* ---------- 东侧主入口门楼(4#/6# 之间, 以效果图为准: 白色水平体量 + 拱顶暖光壁龛 + 中央发光门厅 + 入口水景) ---------- */
export function createGate(scene){
  const grp = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd7d1c5, roughness: .88, metalness: .02 });
  regColor(stoneMat.color, 0x8f8a80, 0xd7d1c5);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xeee9df, roughness: .74, metalness: .04 });
  regColor(wallMat.color, 0x9a958b, 0xeee9df);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a343c, roughness: .22, metalness: .35 });
  regColor(glassMat.color, 0x10171e, 0x2a343c);
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xd9dee3, roughness: .3, metalness: .75 });
  regColor(metalMat.color, 0x9aa2aa, 0xd9dee3);
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x7d6748, roughness: .5, metalness: .45 });
  regColor(bronzeMat.color, 0x403422, 0x7d6748);

  /* 入口广场(负一层 y=0): 门楼与围墙(x=83)之间的前场, 车行道穿过墙洞 */
  const paveMat = new THREE.MeshStandardMaterial({ color: 0xb3aca0, roughness: .95, metalness: .02 });
  regColor(paveMat.color, 0x3d4145, 0xb3aca0);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(21, 0.3, 40), paveMat);
  fore.position.set(73.5, 0.15, 15); fore.receiveShadow = true; grp.add(fore);

  /* 抬高一层(SITE_LIFT)的平台: 东侧 x59.6..83 / z0.5..29.5 留门洞通道(负一层) */
  const deckSide = new THREE.MeshStandardMaterial({ color: 0xb9b3a7, roughness: .92 });
  regColor(deckSide.color, 0x4a4d50, 0xb9b3a7);
  const deckTop = new THREE.MeshStandardMaterial({ color: 0x8fb96f, roughness: .96 });
  regColor(deckTop.color, 0x122019, 0x8fb96f);
  const deckMats = [deckSide, deckSide, deckTop, deckSide, deckSide, deckSide];
  [[-21, -20.5, 162, 235], [71.3, -68.75, 23.4, 138.5], [71.3, 63.25, 23.4, 67.5]].forEach(([cx, cz, ww, dd])=>{
    const b = new THREE.Mesh(new THREE.BoxGeometry(ww, SITE_LIFT, dd), deckMats);
    b.position.set(cx, SITE_LIFT/2, cz);
    b.castShadow = true; b.receiveShadow = true;
    grp.add(b);
  });

  /* 小区围墙: 立于平台顶, 东墙退线留绿带, z 0..30 开门洞对门楼 */
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: .9 });
  regColor(fenceMat.color, 0x8a867e, 0xd8d4cb);
  [[-9.5, -138, 185, 1.5], [-9.5, 97, 185, 1.5], [-102, -20, 1.5, 236],
   [83, -69, 1.5, 138], [83, 64, 1.5, 68]].forEach(([cx, cz, ww, dd])=>{
    const fw = new THREE.Mesh(new THREE.BoxGeometry(ww, 2.2, dd), fenceMat);
    fw.position.set(cx, SITE_LIFT + 1.1, cz); fw.castShadow = true; fw.receiveShadow = true;
    grp.add(fw);
  });

  /* ===== 门楼本体: 立面 x=65.8 与 4#/6# 东立面平齐, 总高约 7.2m(塔楼 2F 层高) ===== */
  const GX = 62.8;                 // 门楼体量中心 x (厚 5.8m: x59.8..65.8)
  const FACE = 65.8;               // 立面 = 塔楼东立面

  /* 两翼: 深色基座 + 米白墙体 */
  [[6.5], [23.5]].forEach(([cz])=>{
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.0, 12.4), glassMat);
    base.position.set(GX, 0.5, cz); base.receiveShadow = true; grp.add(base);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5.8, 6.2, 12), wallMat);
    wing.position.set(GX, 4.1, cz); wing.castShadow = true; wing.receiveShadow = true; grp.add(wing);
  });

  /* 中央门厅: 门柱 + 顶梁 + 背板, 正面为发光格栅屏(效果图) */
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.0, 5.4), wallMat);
  topBeam.position.set(GX, 6.7, 15); topBeam.castShadow = true; grp.add(topBeam);
  [[12.9], [17.1]].forEach(([cz])=>{
    const post = new THREE.Mesh(new THREE.BoxGeometry(5.8, 6.2, 0.9), wallMat);
    post.position.set(GX, 4.1, cz); post.castShadow = true; post.receiveShadow = true; grp.add(post);
  });
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.2, 5.0), bronzeMat);
  backPanel.position.set(60.2, 4.1, 15); grp.add(backPanel);

  /* 发光格栅屏: 暖底 + 竖棂 + 中央环纹 + 门扇暗缝 */
  const scr = document.createElement('canvas'); scr.width = 256; scr.height = 256;
  const sg2 = scr.getContext('2d');
  const sgr = sg2.createLinearGradient(0, 0, 0, 256);
  sgr.addColorStop(0, '#e8c07a'); sgr.addColorStop(.55, '#d9a558'); sgr.addColorStop(1, '#b9853f');
  sg2.fillStyle = sgr; sg2.fillRect(0, 0, 256, 256);
  sg2.fillStyle = 'rgba(80,52,22,.75)';
  for(let x = 12; x < 256; x += 22) sg2.fillRect(x, 0, 6, 256);
  sg2.strokeStyle = 'rgba(88,58,24,.95)'; sg2.lineWidth = 9;
  sg2.beginPath(); sg2.arc(128, 118, 46, 0, Math.PI*2); sg2.stroke();
  sg2.lineWidth = 6;
  sg2.beginPath(); sg2.arc(128, 118, 26, 0, Math.PI*2); sg2.stroke();
  sg2.fillStyle = 'rgba(40,28,14,.9)';
  sg2.fillRect(108, 150, 18, 106); sg2.fillRect(136, 150, 18, 106);
  const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.9),
    new THREE.MeshBasicMaterial({ map: scrTex }));
  screen.rotation.y = Math.PI/2;
  screen.position.set(FACE + 0.05, 3.55, 15); grp.add(screen);

  /* 两翼立面: 圆拱暖光壁龛(效果图) */
  const lat = document.createElement('canvas'); lat.width = 256; lat.height = 384;
  const lg = lat.getContext('2d');
  const archPath = ctx=>{
    ctx.beginPath();
    ctx.moveTo(28, 384); ctx.lineTo(28, 108);
    ctx.arc(128, 108, 100, Math.PI, 0, false);
    ctx.lineTo(228, 384); ctx.closePath();
  };
  archPath(lg);
  const latGrd = lg.createLinearGradient(0, 0, 0, 384);
  latGrd.addColorStop(0, '#ffd98a'); latGrd.addColorStop(.5, '#f7b24a'); latGrd.addColorStop(1, '#e89b3a');
  lg.fillStyle = latGrd; lg.fill();
  lg.save(); archPath(lg); lg.clip();
  lg.fillStyle = 'rgba(96,60,24,.8)';
  for(let x = 40; x < 256; x += 24) lg.fillRect(x, 0, 7, 384);
  lg.restore();
  archPath(lg); lg.strokeStyle = 'rgba(255,244,220,.9)'; lg.lineWidth = 5; lg.stroke();
  const latTex = new THREE.CanvasTexture(lat); latTex.colorSpace = THREE.SRGBColorSpace;
  const latMat = new THREE.MeshBasicMaterial({ map: latTex, transparent: true, side: THREE.DoubleSide });
  [6.5, 23.5].forEach(cz=>{
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 6.0), latMat);
    p.rotation.y = Math.PI/2;
    p.position.set(FACE + 0.06, 4.0, cz); grp.add(p);
  });

  /* 屋顶: 长条板两端半圆外挑 (stadium 平面挤出) */
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-3.9, -14.2);
  roofShape.lineTo(-3.9, 14.2);
  roofShape.absarc(0, 14.2, 3.9, Math.PI, 0, true);
  roofShape.lineTo(3.9, -14.2);
  roofShape.absarc(0, -14.2, 3.9, 0, Math.PI, true);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 0.55, bevelEnabled: false });
  roofGeo.rotateX(-Math.PI/2);
  const roof = new THREE.Mesh(roofGeo, wallMat);
  roof.position.set(GX, 7.2, 15); roof.castShadow = true; grp.add(roof);

  /* 入口名称(檐口下) */
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 128;
  const sg = sc.getContext('2d');
  sg.textAlign = 'center'; sg.textBaseline = 'middle';
  sg.font = '600 78px "PingFang SC","Noto Sans SC",sans-serif';
  sg.shadowColor = 'rgba(255,255,255,.45)'; sg.shadowBlur = 8;
  sg.fillStyle = '#332c22'; sg.fillText('风 华 锦 澜 里', 512, 68);
  const scTex = new THREE.CanvasTexture(sc); scTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 2.0),
    new THREE.MeshBasicMaterial({ map: scTex, transparent: true, depthWrite: false })
  );
  sign.rotation.y = Math.PI/2;
  sign.position.set(FACE + 0.08, 6.75, 15); grp.add(sign);

  /* 入口前圆形水景 + 雕塑 */
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.1, 0.55, 28), stoneMat);
  basin.position.set(68.6, 0.28, 15); basin.castShadow = true; basin.receiveShadow = true; grp.add(basin);
  const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.12, 28),
    flatMat(0x0a3d47, 0x2f8f9f));
  basinWater.position.set(68.6, 0.5, 15); grp.add(basinWater);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.1, 8),
    new THREE.MeshBasicMaterial({ color: 0xaee8ff, transparent: true, opacity: .5 }));
  jet.position.set(68.6, 1.1, 15); grp.add(jet);
  const drop = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.2, 10, 30, Math.PI*1.5), metalMat);
  drop.position.set(68.6, 1.85, 15);
  drop.rotation.set(0.15, Math.PI/2, -0.3);
  drop.castShadow = true; grp.add(drop);

  /* 广场标志性雕塑(大门外广场, 避开入口中轴) */
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.0, 0.6, 28), stoneMat);
  plinth.position.set(77, 0.45, 24); plinth.castShadow = true; plinth.receiveShadow = true; grp.add(plinth);
  const sculpt = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.34, 12, 40, Math.PI*1.45), metalMat);
  sculpt.position.set(77, 3.1, 24);
  sculpt.rotation.set(0.35, Math.PI/2, 0.35);
  sculpt.castShadow = true; grp.add(sculpt);

  /* 造型松(拱龛前) + 棕榈(两端) + 绿篱柱 */
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x275c33, roughness: .92, flatShading: true });
  regColor(pineMat.color, 0x14381f, 0x2f6b3f);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4028, roughness: .95 });
  regColor(trunkMat.color, 0x3a2a18, 0x7a5a36);
  function pine(x, z){
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 1.9, 6), trunkMat);
    tr.position.set(x, 0.95, z); tr.castShadow = true; grp.add(tr);
    const b1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), pineMat);
    b1.position.set(x - 0.35, 2.4, z); b1.scale.set(1.6, 0.55, 0.95); b1.castShadow = true; grp.add(b1);
    const b2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), pineMat);
    b2.position.set(x + 0.4, 3.15, z + 0.15); b2.scale.set(1.2, 0.5, 0.78); b2.castShadow = true; grp.add(b2);
  }
  pine(67.2, 10.4); pine(67.2, 19.6);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2c6b3f, roughness: .9, flatShading: true });
  regColor(leafMat.color, 0x173d24, 0x35834a);
  function palm(x, z){
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 5.6, 7), trunkMat);
    tr.position.set(x, 2.8, z); tr.castShadow = true; grp.add(tr);
    const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 1), leafMat);
    c1.position.set(x, 5.75, z); c1.scale.set(1.5, 0.62, 1.5); c1.castShadow = true; grp.add(c1);
    const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), leafMat);
    c2.position.set(x + 0.3, 6.35, z + 0.2); c2.scale.set(1.25, 0.55, 1.25); c2.castShadow = true; grp.add(c2);
  }
  palm(66.4, -1.4); palm(66.4, 31.4);

  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x24512e, roughness: .92, flatShading: true });
  regColor(hedgeMat.color, 0x13301c, 0x2f6b3f);
  [[66.3, 3.2], [66.3, 26.8]].forEach(([x, z])=>{
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.85, 3.2, 9), hedgeMat);
    h.position.set(x, 1.6, z); h.castShadow = true; grp.add(h);
  });

  scene.add(grp);
}
