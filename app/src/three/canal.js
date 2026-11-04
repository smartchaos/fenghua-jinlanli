import * as THREE from 'three';
import { RX, RZ } from './constants.js';
import { flatMat, themedMats } from './theme.js';

/* ---------- 京杭大运河（西侧中远景）+ 电厂河 + 路网 + 双桥 + 红绿灯 ---------- */
export function createCanal(scene){
  const canalGrp = new THREE.Group(); scene.add(canalGrp);

  const canalMat = flatMat(0x0a2e44, 0x6aa3c8);
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(170, 1600), canalMat);
  canal.rotation.x = -Math.PI/2; canal.position.set(-350, 0.03, 0);
  canalGrp.add(canal);

  /* 驳岸: 东岸在电厂河口留缺口 (-184..-138), 西岸贯通 */
  const revetMat = flatMat(0x232a33, 0x8f8d84);
  [[-492, 616], [331, 938]].forEach(([cz, len])=>{
    const b = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, len), revetMat);
    b.position.set(-264.5, 0.7, cz);
    canalGrp.add(b);
  });
  const revetW = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 1600), revetMat);
  revetW.position.set(-435.5, 0.7, 0);
  canalGrp.add(revetW);

  /* 滨河绿带: 河口与南路交叉处留缺口 */
  const beltMat = flatMat(0x11231a, 0x7fae72);
  [[-492, 616], [0, 276], [481, 638]].forEach(([cz, len])=>{
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(30, len), beltMat);
    belt.rotation.x = -Math.PI/2; belt.position.set(-246, 0.02, cz);
    canalGrp.add(belt);
  });

  /* ---------- 沥青路网: 东路南北贯通, 南路西接斜拉桥, 交叉口红绿灯 ---------- */
  function roadTexMat(len){
    const draw = day=>{
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 512;
      const g = cv.getContext('2d');
      g.fillStyle = day ? '#3d4248' : '#101317'; g.fillRect(0, 0, 64, 512);
      g.fillStyle = day ? 'rgba(255,255,255,.92)' : 'rgba(228,235,242,.6)';
      g.fillRect(3, 0, 3, 512); g.fillRect(58, 0, 3, 512);       // 边线
      for(let y = 12; y < 512; y += 64) g.fillRect(30, y, 3, 32); // 中央虚线
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
      t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, len/80);
      return t;
    };
    const m = new THREE.MeshBasicMaterial({ map: draw(false) });
    m.userData.nightTex = draw(false); m.userData.dayTex = draw(true);
    return m;
  }
  function roadTexMatX(len){   // 纹理长轴沿 u(盒体顶面用): 边线在 v 两侧, 虚线沿 u
    const draw = day=>{
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
      const g = cv.getContext('2d');
      g.fillStyle = day ? '#3d4248' : '#101317'; g.fillRect(0, 0, 512, 64);
      g.fillStyle = day ? 'rgba(255,255,255,.92)' : 'rgba(228,235,242,.6)';
      g.fillRect(0, 3, 512, 3); g.fillRect(0, 58, 512, 3);       // 边线
      for(let x = 12; x < 512; x += 64) g.fillRect(x, 30, 32, 3); // 中央虚线
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
      t.wrapS = THREE.RepeatWrapping; t.repeat.set(len/80, 1);
      return t;
    };
    const m = new THREE.MeshBasicMaterial({ map: draw(false) });
    m.userData.nightTex = draw(false); m.userData.dayTex = draw(true);
    return m;
  }
  // 道路纹理材质与 flatMat 同构(日夜双贴图), 直接进 themedMats 随主题切换
  function regRoadTex(m){ themedMats.push(m); return m; }
  function roadGeo(len){
    const geo = new THREE.PlaneGeometry(20, len);
    geo.rotateX(-Math.PI/2);
    return geo;
  }
  function roadGeoEW(len){
    const geo = new THREE.PlaneGeometry(20, len);
    geo.rotateX(-Math.PI/2); geo.rotateY(Math.PI/2);
    return geo;
  }

  /* 东路: 南北延伸至远方, 止于跨河桥两端(桥面承接), 避免与桥面叠层 */
  [[-495, 610], [334, 932]].forEach(([cz, len])=>{
    const r = new THREE.Mesh(roadGeo(len), regRoadTex(roadTexMat(len)));
    r.position.set(RX, 0.015, cz);
    canalGrp.add(r);
  });
  { // 东路跨河桥: 平直桥面与路面齐平延续, 两侧白色护栏
    const bridgeW = flatMat(0x101317, 0x3d4248);
    const railWhite = flatMat(0x8f959d, 0xf2f2ee);
    const CZR = -161, SPAN = 58;
    /* 道路纹理直接作盒体顶面材质(+y 面), 消除独立贴图平面与桥面的 z-fighting */
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.9, SPAN),
      [bridgeW, bridgeW, regRoadTex(roadTexMat(SPAN)), bridgeW, bridgeW, bridgeW]
    );
    deck.position.set(RX, -0.42, CZR);          // 顶面 y0.03, 与路面齐平
    canalGrp.add(deck);
    [-9.7, 9.7].forEach(xoff=>{
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.15, SPAN), railWhite);
      rail.position.set(RX + xoff, 0.6, CZR);
      canalGrp.add(rail);
    });
  }
  { // 南路: 斜拉桥东端 → 穿过东路, 交叉口由无缝补丁收口
    const len = 372;
    const r = new THREE.Mesh(roadGeoEW(len), regRoadTex(roadTexMat(len)));
    r.position.set(-66, 0.025, RZ);
    canalGrp.add(r);
  }
  { // 交叉口无缝补丁: 同色系纯沥青薄盒, 顶面即补丁面, 无叠层间隙
    const patch = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.12, 20.4), flatMat(0x101317, 0x3d4248));
    patch.position.set(RX, 0.035 - 0.06, RZ);
    canalGrp.add(patch);
    // 直行优先: 东路(主路)中线实线贯穿交叉口, 南路(支路)中线止于路口西缘
    const through = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 20.4), flatMat(0x8f98a4, 0xffffff));
    through.rotation.x = -Math.PI/2;
    through.position.set(RX, 0.036, RZ);
    canalGrp.add(through);
  }
  /* 红绿灯（南路×东路交叉口, 对角两台） */
  const tlPoleMat = flatMat(0x17191d, 0x3a3f45);
  const tlRed = flatMat(0xff4530, 0xff4530);
  const tlYellow = flatMat(0x8a6d1c, 0xffb340);
  const tlGreen = flatMat(0x1f7a30, 0x32d74b);
  function makeTrafficLight(lit){
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 7, 6), tlPoleMat);
    pole.position.y = 3.5; g.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 4.6, 5), tlPoleMat);
    arm.rotation.z = Math.PI/2; arm.position.set(2.3, 6.9, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.5), tlPoleMat);
    head.position.set(4.4, 6.1, 0); g.add(head);
    [['red', tlRed], ['yellow', tlYellow], ['green', tlGreen]].forEach(([k, mat], i)=>{
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.21, 10), k === lit ? mat : tlPoleMat);
      lamp.rotation.y = -Math.PI/2;
      lamp.position.set(4.05, 6.75 - i*0.62, 0);
      g.add(lamp);
    });
    return g;
  }
  const tl1 = makeTrafficLight('red'); tl1.position.set(RX-14, 0, RZ-13); canalGrp.add(tl1);
  const tl2 = makeTrafficLight('green'); tl2.position.set(RX+14, 0, RZ+13); tl2.rotation.y = Math.PI; canalGrp.add(tl2);

  /* 斜拉桥: 门式桥塔 + 扇形拉索; 桥面与南路同款沥青(白边线+中央虚线) */
  const bridgeTowerMat = flatMat(0x272c33, 0xc9ced4);
  const bridgeCableMat = flatMat(0x39424c, 0xdde3e8);
  const bridgeAsphalt = flatMat(0x101317, 0x3d4248);   // 与南路同色系沥青
  /* 桥面压低接近路面(底 0.2 / 顶 1.8); 道路纹理直接作盒体顶面材质, 无叠层间隙 */
  const deckBase = new THREE.Mesh(
    new THREE.BoxGeometry(210, 1.6, 17),
    [bridgeAsphalt, bridgeAsphalt, regRoadTex(roadTexMatX(210)), bridgeAsphalt, bridgeAsphalt, bridgeAsphalt]
  );
  deckBase.position.set(-350, 1.0, RZ);
  canalGrp.add(deckBase);
  [-8.2, 8.2].forEach(zoff=>{
    const rail = new THREE.Mesh(new THREE.BoxGeometry(210, 0.9, 0.6), bridgeTowerMat);
    rail.position.set(-350, 2.3, RZ + zoff);
    canalGrp.add(rail);
  });
  [[-245, -205, -0.0375], [-455, -495, 0.0375]].forEach(([x1, x2, rot])=>{
    const rampBase = new THREE.Mesh(
      new THREE.BoxGeometry(44, 0.8, 17),
      [bridgeAsphalt, bridgeAsphalt, regRoadTex(roadTexMatX(44)), bridgeAsphalt, bridgeAsphalt, bridgeAsphalt]
    );
    rampBase.position.set((x1 + x2)/2, 1.02, RZ);
    rampBase.rotation.z = rot;
    canalGrp.add(rampBase);
  });
  [-7, 7].forEach(zoff=>{
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 36, 1.5), bridgeTowerMat);
    tower.position.set(-350, 18, RZ + zoff);
    canalGrp.add(tower);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 17.5), bridgeTowerMat);
  beam.position.set(-350, 35.5, RZ);
  canalGrp.add(beam);
  const beamLow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 15.5), bridgeTowerMat);
  beamLow.position.set(-350, 9.5, RZ);
  canalGrp.add(beamLow);
  const cableGeo = new THREE.CylinderGeometry(0.13, 0.13, 1, 4);
  function cable(x1, y1, z1, x2, y2, z2){
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(cableGeo, bridgeCableMat);
    m.scale.set(1, len, 1);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  [-7, 7].forEach(zoff=>{
    [24, 48, 72, 96].forEach(dx=>{
      canalGrp.add(cable(-350, 34.5, RZ + zoff, -350 - dx, 2.0, RZ + zoff));
      canalGrp.add(cable(-350, 34.5, RZ + zoff, -350 + dx, 2.0, RZ + zoff));
    });
  });

  return { canalGrp };
}
