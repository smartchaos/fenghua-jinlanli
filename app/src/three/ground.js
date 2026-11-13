import * as THREE from 'three';
import { SITE_W, SITE_D, SITE_LIFT, WORLD_HALF } from './constants.js';
import SURROUNDINGS from './surroundings.json';
import { createSite, drawMeadow } from './siteTexture.js';
import { waterMat, regFade } from './theme.js';

/* 地面三层: 底层外围纹理(y=0) / 抬高平台顶的地块分片(y=SITE_LIFT) / 外围旷野草甸 + 电厂河水面 */
export function createGround(scene, buildings, renderer){
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const siteNight = createSite(false, buildings, maxAniso);
  const siteDay = createSite(true, buildings, maxAniso);
  const siteMat = regFade(
    new THREE.MeshStandardMaterial({ map: siteNight.tex, roughness: 0.96, metalness: 0.02 }),
    siteNight.tex, siteDay.tex);
  const site = new THREE.Mesh(new THREE.PlaneGeometry(SITE_W, SITE_D), siteMat);
  site.rotation.x = -Math.PI/2;
  site.position.y = -0.04;          // 压低底图, 与东路路面(0.06)/南路(0.16)拉开 ≥10cm
  site.receiveShadow = true;
  scene.add(site);

  /* 平台顶地块分片(东侧门洞通道留在底层) */
  const plotMeshes = siteNight.plots.map((p, i)=>{
    const mat = regFade(
      new THREE.MeshStandardMaterial({ map: p.tex, roughness: 0.96, metalness: 0.02 }),
      p.tex, siteDay.plots[i].tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), mat);
    m.rotation.x = -Math.PI/2;
    m.position.set(p.cx, SITE_LIFT + 0.10, p.cz);
    m.receiveShadow = true;
    scene.add(m);
    return { mat };
  });

  const outerNightTex = drawMeadow(false);
  const outerDayTex = drawMeadow(true);
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2),
    regFade(new THREE.MeshBasicMaterial({ map: outerNightTex }), outerNightTex, outerDayTex)
  );
  outer.name = 'meadow';
  outer.rotation.x = -Math.PI/2;
  outer.position.y = -0.35;
  scene.add(outer);

  const riverMat = waterMat(0x0a2e44, 0x4e8099);
  /* 电厂河按卫星折线: 西段沿小区北侧, 出顾扬路后向东南弯; 桥位(x 100..120)留洞避免叠层。
   * 相邻段在接缝处本有重叠, 交错抬高 16cm 避免同高共面闪烁 */
  const riverGrp = new THREE.Group();
  SURROUNDINGS.waters.forEach((w, i)=>{
    const dx = w.x1 - w.x0, dz = w.z1 - w.z0, len = Math.hypot(dx, dz);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(w.w, len), riverMat);
    seg.rotation.x = -Math.PI/2;
    seg.rotation.z = Math.atan2(-dx, -dz);
    seg.position.set((w.x0 + w.x1)/2, i % 2 === 0 ? 0.06 : -0.10, (w.z0 + w.z1)/2);
    riverGrp.add(seg);
  });
  scene.add(riverGrp);

  /* 日/夜贴图由 theme.js 的共享 dayMix 在着色器里交叉淡化，这里不再硬切 */
  return { treeSpots: siteNight.treeSpots };
}
