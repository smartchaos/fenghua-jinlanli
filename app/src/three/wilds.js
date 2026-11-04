import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { RX } from './constants.js';
import { regColor, flatMat } from './theme.js';

/* 小区乔木（与平面纹理的树冠投影共用同一批落点） */
export function createVegetation(scene, treeSpots){
  function makeTree(x, z, s, kind){
    const group = new THREE.Group();
    group.position.set(x, 0, z);
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
    const c1 = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 4.6, 7),
      new THREE.MeshStandardMaterial({ color: colors[0], roughness: 0.92 })
    );
    regColor(c1.material.color, colors[0], days[0]);
    c1.position.y = 4.0; c1.castShadow = true; group.add(c1);
    const c2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 3.4, 7),
      new THREE.MeshStandardMaterial({ color: colors[1], roughness: 0.9 })
    );
    regColor(c2.material.color, colors[1], days[1]);
    c2.position.y = 5.8; c2.castShadow = true; group.add(c2);
    return group;
  }
  treeSpots.forEach(p=>scene.add(makeTree(p.x, p.z, p.s, p.kind)));
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
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false });
  regColor(mat.color, 0x93a9be, 0x3d5a74);
  const sp = new THREE.Sprite(mat);
  sp.scale.set(150, 19, 1); sp.position.set(-350, 26, -60);
  canalGrp.add(sp);
}

/* ---------- 小区水景乐园 ---------- */
export function createWaterPlay(scene){
  const group = new THREE.Group();
  group.position.set(0, 0, 16);
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

  const water = new THREE.Mesh(
    new THREE.ShapeGeometry(outline),
    new THREE.MeshStandardMaterial({ color: 0x65d0f0, roughness: .18, metalness: .04, transparent: true, opacity: .92, side: THREE.DoubleSide })
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
}
