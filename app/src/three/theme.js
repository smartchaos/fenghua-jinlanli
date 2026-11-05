import * as THREE from 'three';

/* ---------- 日夜主题渐变注册表 ----------
 * colFaders: 颜色三元组随 themeT 在夜/日之间插值
 * numFaders: 数值属性(雾距/曝光/光强)同理 */
export const colFaders = [];
export const numFaders = [];

export function regColor(inst, n, d){ colFaders.push({ c: inst, n: new THREE.Color(n), d: new THREE.Color(d) }); }
export function regNum(o, p, n, d){ numFaders.push({ o, p, n, d }); }

export function applyFaders(themeT){
  colFaders.forEach(f => f.c.copy(f.n).lerp(f.d, themeT));
  numFaders.forEach(f => { f.o[f.p] = f.n + (f.d - f.n) * themeT; });
}

/* 纯色贴图材质: Basic+map 渲染准确（Basic+color 在本管线会提亮）。
 * 日夜双 8×8 canvas 贴图, 随主题整体切换。 */
export const themedMats = [];
export function flatMat(nightHex, dayHex, opts){
  const mk = hex => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 8;
    const g = cv.getContext('2d');
    g.fillStyle = '#' + hex.toString(16).padStart(6, '0'); g.fillRect(0, 0, 8, 8);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const m = new THREE.MeshBasicMaterial(Object.assign({ map: mk(nightHex) }, opts || {}));
  m.userData.nightTex = mk(nightHex); m.userData.dayTex = mk(dayHex);
  themedMats.push(m);
  return m;
}

export function setThemedMaps(day){
  const setC = m => { m.map = day ? m.userData.dayTex : m.userData.nightTex; m.needsUpdate = true; };
  themedMats.forEach(setC);
}
