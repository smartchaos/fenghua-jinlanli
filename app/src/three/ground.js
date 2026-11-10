import * as THREE from 'three';
import { SITE_W, SITE_D, SITE_LIFT, CANAL_X, WORLD_HALF } from './constants.js';
import { createSite, drawMeadow } from './siteTexture.js';
import { waterMat } from './theme.js';

/* 地面三层: 底层外围纹理(y=0) / 抬高平台顶的地块分片(y=SITE_LIFT) / 外围旷野草甸 + 电厂河水面 */
export function createGround(scene, buildings, renderer){
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const siteNight = createSite(false, buildings, maxAniso);
  const siteDay = createSite(true, buildings, maxAniso);
  const siteMat = new THREE.MeshStandardMaterial({ map: siteNight.tex, roughness: 0.96, metalness: 0.02 });
  const site = new THREE.Mesh(new THREE.PlaneGeometry(SITE_W, SITE_D), siteMat);
  site.rotation.x = -Math.PI/2;
  site.receiveShadow = true;
  scene.add(site);

  /* 平台顶地块分片(东侧门洞通道留在底层) */
  const plotMeshes = siteNight.plots.map((p, i)=>{
    const mat = new THREE.MeshStandardMaterial({ map: p.tex, roughness: 0.96, metalness: 0.02 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), mat);
    m.rotation.x = -Math.PI/2;
    m.position.set(p.cx, SITE_LIFT + 0.10, p.cz);
    m.receiveShadow = true;
    scene.add(m);
    return { mat, night: p.tex, day: siteDay.plots[i].tex };
  });

  const outerNightTex = drawMeadow(false);
  const outerDayTex = drawMeadow(true);
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2),
    new THREE.MeshBasicMaterial({ map: outerNightTex })
  );
  outer.name = 'meadow';
  outer.rotation.x = -Math.PI/2;
  outer.position.y = -0.35;
  scene.add(outer);

  const riverMat = waterMat(0x0a2e44, 0x4e8099);
  /* 电厂河在东路跨河桥处留洞(x 100..120): 水面 y0.06 与桥面顶齐平, 靠留洞避免叠层。
   * 西端接运河东岸, 东端到场景边界 */
  const riverGrp = new THREE.Group();
  const eastBank = CANAL_X + 85;
  [[(eastBank + 100) / 2, 100 - eastBank], [(120 + WORLD_HALF) / 2, WORLD_HALF - 120]].forEach(([cx, w])=>{
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(w, 40), riverMat);
    seg.rotation.x = -Math.PI/2;
    seg.position.set(cx, 0.06, -161);
    riverGrp.add(seg);
  });
  /* 电厂河东折段: 沿顾扬路东侧向南（小区东界沿电厂河） */
  const bend = new THREE.Mesh(new THREE.PlaneGeometry(30, 460), riverMat);
  bend.rotation.x = -Math.PI/2;
  bend.position.set(132, 0.06, 70);
  riverGrp.add(bend);
  scene.add(riverGrp);

  function setGroundMaps(day){
    siteMat.map = day ? siteDay.tex : siteNight.tex; siteMat.needsUpdate = true;
    plotMeshes.forEach(p=>{ p.mat.map = day ? p.day : p.night; p.mat.needsUpdate = true; });
    outer.material.map = day ? outerDayTex : outerNightTex; outer.material.needsUpdate = true;
  }

  return { treeSpots: siteNight.treeSpots, setGroundMaps };
}
