import * as THREE from 'three';
import { SITE_W, SITE_D } from './constants.js';
import { createSite, drawMeadow } from './siteTexture.js';
import { flatMat } from './theme.js';

/* 地面三层: 小区平面纹理 / 外围旷野草甸 / 电厂河水面(桥位留洞) */
export function createGround(scene, buildings, renderer){
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const siteNight = createSite(false, buildings, maxAniso);
  const siteDay = createSite(true, buildings, maxAniso);
  const siteMat = new THREE.MeshStandardMaterial({ map: siteNight.tex, roughness: 0.96, metalness: 0.02 });
  const site = new THREE.Mesh(new THREE.PlaneGeometry(SITE_W, SITE_D), siteMat);
  site.rotation.x = -Math.PI/2;
  site.receiveShadow = true;
  scene.add(site);

  const outerNightTex = drawMeadow(false);
  const outerDayTex = drawMeadow(true);
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshBasicMaterial({ map: outerNightTex })
  );
  outer.rotation.x = -Math.PI/2;
  outer.position.y = -0.35;
  scene.add(outer);

  const riverMat = flatMat(0x0a2e44, 0x6aa3c8);
  /* 电厂河在东路跨河桥处留洞(x 100..120): 水面 y0.06 高于桥面顶 y0.03, 不拆会被水盖住 */
  const riverGrp = new THREE.Group();
  [[-135, 470], [360, 480]].forEach(([cx, w])=>{
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(w, 40), riverMat);
    seg.rotation.x = -Math.PI/2;
    seg.position.set(cx, 0.06, -161);
    riverGrp.add(seg);
  });
  scene.add(riverGrp);

  function setGroundMaps(day){
    siteMat.map = day ? siteDay.tex : siteNight.tex; siteMat.needsUpdate = true;
    outer.material.map = day ? outerDayTex : outerNightTex; outer.material.needsUpdate = true;
  }

  return { treeSpots: siteNight.treeSpots, setGroundMaps };
}
