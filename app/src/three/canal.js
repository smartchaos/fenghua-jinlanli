import * as THREE from 'three';
import { RX, RZ, CANAL_X, WORLD_HALF } from './constants.js';
import { flatMat, waterMat } from './theme.js';
import { roadSurfaceMaterial, junctionMaterial, asphaltMaterial } from './roads.js';

/* ---------- 京杭大运河（西侧真实 1km）+ 电厂河 + 路网 + 双桥 + 红绿灯 ---------- */
export function createCanal(scene, renderer){
  const canalGrp = new THREE.Group(); scene.add(canalGrp);
  const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;

  const canalMat = waterMat(0x0a2e44, 0x4e8099);
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(170, WORLD_HALF * 2), canalMat);
  canal.name = 'canal-water';
  canal.rotation.x = -Math.PI/2; canal.position.set(CANAL_X, -0.08, 0);
  canalGrp.add(canal);

  /* 驳岸: 东岸在电厂河口 (-184..-138) 与南路桥位 (138..162) 留缺口, 西岸只留桥位缺口。
   * 不留缺口时驳岸顶 y1.8 与桥面顶 y1.8 共面, 在桥位处 z-fighting 闪烁 */
  const revetMat = flatMat(0x232a33, 0x8f8d84);
  [[-1392, 2416], [0, 276], [1381, 2438]].forEach(([cz, len])=>{
    const b = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, len), revetMat);
    b.position.set(CANAL_X + 85.5, 0.7, cz);
    canalGrp.add(b);
  });
  [[-1231, 2738], [1381, 2438]].forEach(([cz, len])=>{
    const b = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, len), revetMat);
    b.position.set(CANAL_X - 85.5, 0.7, cz);
    canalGrp.add(b);
  });

  /* 滨河绿带: 河口与南路交叉处留缺口 */
  const beltMat = flatMat(0x11231a, 0x7fae72);
  [[-1392, 2416], [0, 276], [1381, 2438]].forEach(([cz, len])=>{
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(30, len), beltMat);
    belt.rotation.x = -Math.PI/2; belt.position.set(CANAL_X + 104, 0.02, cz);
    canalGrp.add(belt);
  });

  /* ---------- 沥青路网: 双向四车道(边线+车道虚线+中央双黄), 东路南北贯通, 南路西接斜拉桥 ---------- */
  const roadTexMat = len => roadSurfaceMaterial(len, false, maxAniso);   // 平面/南北盒体: 长轴沿 v
  const roadTexMatX = len => roadSurfaceMaterial(len, true, maxAniso);   // 东西向盒体顶面: 长轴沿 u
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
  [[-1395, 2410], [1234, 2732]].forEach(([cz, len])=>{
    const r = new THREE.Mesh(roadGeo(len), roadTexMat(len));
    r.position.set(RX, 0.06, cz);
    canalGrp.add(r);
  });
  { // 东路跨河桥: 平直桥面与路面齐平延续, 两侧白色护栏
    const bridgeW = flatMat(0x101317, 0x3d4248);
    const railWhite = flatMat(0x8f959d, 0xf2f2ee);
    const CZR = -161, SPAN = 58;
    /* 道路纹理直接作盒体顶面材质(+y 面), 消除独立贴图平面与桥面的 z-fighting */
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.9, SPAN),
      [bridgeW, bridgeW, roadTexMat(SPAN), bridgeW, bridgeW, bridgeW]
    );
    deck.position.set(RX, -0.39, CZR);          // 顶面 y0.06, 与路面齐平
    canalGrp.add(deck);
    [-9.7, 9.7].forEach(xoff=>{
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.15, SPAN), railWhite);
      rail.position.set(RX + xoff, 0.6, CZR);
      canalGrp.add(rail);
    });
  }
  { // 南路: 斜拉桥东端 → 穿过东路, 至顾扬路路口为止（朱家坝路不东延穿电厂）
    const len = 975;
    const r = new THREE.Mesh(roadGeoEW(len), roadTexMat(len));
    r.position.set(-367.5, 0.12, RZ);
    canalGrp.add(r);
  }
  { // 交叉口补丁: 顶面画四向斑马线 + 停止线(信号灯路口)
    const asphalt = asphaltMaterial();
    const patch = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.24, 20.4),
      [asphalt, asphalt, junctionMaterial(maxAniso), asphalt, asphalt, asphalt]);
    patch.position.set(RX, 0.06, RZ);
    canalGrp.add(patch);
  }

  /* 斜拉桥: 门式桥塔 + 扇形拉索; 桥面与南路同款沥青(双向四车道), 两侧白色护栏 */
  const bridgeTowerMat = flatMat(0x272c33, 0xc9ced4);
  const bridgeCableMat = flatMat(0x39424c, 0xdde3e8);
  const bridgeAsphalt = flatMat(0x101317, 0x3d4248);   // 与南路同色系沥青
  const railWhite = flatMat(0x8f959d, 0xf2f2ee);       // 白色护栏
  /* 桥面压低接近路面(底 0.2 / 顶 1.8); 道路纹理直接作盒体顶面材质, 无叠层间隙 */
  const deckBase = new THREE.Mesh(
    new THREE.BoxGeometry(210, 1.6, 17),
    [bridgeAsphalt, bridgeAsphalt, roadTexMatX(210), bridgeAsphalt, bridgeAsphalt, bridgeAsphalt]
  );
  deckBase.position.set(CANAL_X, 1.0, RZ);
  canalGrp.add(deckBase);
  [-8.2, 8.2].forEach(zoff=>{
    const rail = new THREE.Mesh(new THREE.BoxGeometry(210, 0.9, 0.6), railWhite);
    rail.position.set(CANAL_X, 2.3, RZ + zoff);
    canalGrp.add(rail);
  });
  [[CANAL_X + 105, CANAL_X + 145, -0.0375], [CANAL_X - 105, CANAL_X - 145, 0.0375]].forEach(([x1, x2, rot])=>{
    const rampBase = new THREE.Mesh(
      new THREE.BoxGeometry(44, 0.8, 17),
      [bridgeAsphalt, bridgeAsphalt, roadTexMatX(44), bridgeAsphalt, bridgeAsphalt, bridgeAsphalt]
    );
    rampBase.position.set((x1 + x2)/2, 1.02, RZ);
    rampBase.rotation.z = rot;
    canalGrp.add(rampBase);
  });
  [-7, 7].forEach(zoff=>{
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 36, 1.5), bridgeTowerMat);
    tower.position.set(CANAL_X, 18, RZ + zoff);
    canalGrp.add(tower);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 17.5), bridgeTowerMat);
  beam.position.set(CANAL_X, 35.5, RZ);
  canalGrp.add(beam);
  const beamLow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 15.5), bridgeTowerMat);
  beamLow.position.set(CANAL_X, 9.5, RZ);
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
      canalGrp.add(cable(CANAL_X, 34.5, RZ + zoff, CANAL_X - dx, 2.0, RZ + zoff));
      canalGrp.add(cable(CANAL_X, 34.5, RZ + zoff, CANAL_X + dx, 2.0, RZ + zoff));
    });
  });

  return { canalGrp };
}
