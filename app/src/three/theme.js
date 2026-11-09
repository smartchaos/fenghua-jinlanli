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

/* 程序化细颗粒：给纯色/渐变贴图叠加高频明度扰动，消除塑料感 */
let grainTile = null;
export function grainOverlay(g, w, h, strength = 1){
  if(!grainTile){
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const cg = c.getContext('2d');
    const img = cg.createImageData(128, 128);
    let s = 0x9e3779b9;
    for(let i = 0; i < img.data.length; i += 4){
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const v = 104 + ((s >>> 24) % 52);
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
      img.data[i+3] = 255;
    }
    cg.putImageData(img, 0, 0);
    grainTile = c;
  }
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.3 * strength;
  g.fillStyle = g.createPattern(grainTile, 'repeat');
  g.fillRect(0, 0, w, h);
  g.restore();
}

/* 水面改用标准材质，低粗糙度接收天空环境反射 */
export function waterMat(nightHex, dayHex){
  const mk = hex => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 8;
    const g = cv.getContext('2d');
    g.fillStyle = '#' + hex.toString(16).padStart(6, '0'); g.fillRect(0, 0, 8, 8);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const m = new THREE.MeshStandardMaterial({
    map: mk(nightHex), roughness: 0.3, metalness: 0.04, envMapIntensity: 0.7,
  });
  /* 夜间避免方向光在水面拉出过亮的镜面带, 日间才恢复反射 */
  regNum(m, 'roughness', 0.92, 0.3);
  regNum(m, 'envMapIntensity', 0.05, 0.7);
  m.userData.nightTex = m.map;
  m.userData.dayTex = mk(dayHex);
  themedMats.push(m);
  return m;
}
