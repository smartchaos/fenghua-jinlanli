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

/* ---------- 日夜贴图 cross-fade ----------
 * 旧实现在 applyTheme() 里立刻把 map 换成目标贴图，而颜色/曝光/光强要随
 * themeT 渐变约 60 帧；切回白天时「白天贴图 + 夜间曝光」会过曝一帧。
 * 现在所有日/夜贴图材质共用 uDayMix (0=夜, 1=日)，在片元里同时采样
 * 夜(=map) / 日(=uFadeMap) 两张贴图线性混合，进度与 applyFaders 完全一致。
 * 零额外 draw call，也不需要每帧重传贴图；闲置时仍不渲染。
 * 约定：map / emissiveMap 恒为夜版本，uFadeMap / uFadeGlow 恒为日版本，
 * 因此切换方向无关，不会在来回切换时把当前画面瞬间拉回起点。 */
export const dayMix = { value: 0 };
export const themedMats = [];

const FADE_MAP = /* glsl */`
#ifdef USE_MAP
  vec4 sampledDiffuseColor = mix(
    texture2D(map, vMapUv),
    texture2D(uFadeMap, vMapUv),
    uDayMix);
  diffuseColor *= sampledDiffuseColor;
#endif
`;
const FADE_GLOW = /* glsl */`
#ifdef USE_EMISSIVEMAP
  totalEmissiveRadiance *= mix(
    texture2D(emissiveMap, vEmissiveMapUv),
    texture2D(uFadeGlow, vEmissiveMapUv),
    uDayMix).rgb;
#endif
`;

/* 注册交叉淡化材质。日贴图可先用夜贴图占位，之后改写
 * mat.userData.fadeDay.value / fadeGlow.value 即可延迟绑定（主楼立面懒生成用）。 */
export function regFade(mat, nightTex, dayTex, glowNight, glowDay){
  const hasGlow = !!glowNight;
  mat.userData.crossFade = true;
  mat.userData.nightTex = nightTex;
  mat.userData.dayTex = dayTex;
  mat.userData.fadeDay = { value: dayTex };
  mat.userData.fadeGlow = { value: glowDay || null };
  mat.map = nightTex;
  if(hasGlow) mat.emissiveMap = glowNight;
  mat.onBeforeCompile = shader => {
    shader.uniforms.uFadeMap = mat.userData.fadeDay;
    shader.uniforms.uDayMix = dayMix;      /* 共享 uniform 对象，改 value 即全场景生效 */
    let head = 'uniform sampler2D uFadeMap;\nuniform float uDayMix;\n';
    if(hasGlow){
      shader.uniforms.uFadeGlow = mat.userData.fadeGlow;
      head += 'uniform sampler2D uFadeGlow;\n';
    }
    shader.fragmentShader = head + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', FADE_MAP);
    if(hasGlow)
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', FADE_GLOW);
  };
  /* 有/无发光通道是两份不同的着色器源码，必须分开缓存 */
  mat.customProgramCacheKey = () => hasGlow ? 'crossfade-glow' : 'crossfade-map';
  themedMats.push(mat);
  return mat;
}

/* 纯色贴图材质: Basic+map 渲染准确（Basic+color 在本管线会提亮）。 */
export function flatMat(nightHex, dayHex, opts){
  const mk = hex => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 8;
    const g = cv.getContext('2d');
    g.fillStyle = '#' + hex.toString(16).padStart(6, '0'); g.fillRect(0, 0, 8, 8);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const night = mk(nightHex);
  const m = new THREE.MeshBasicMaterial(Object.assign({ map: night }, opts || {}));
  return regFade(m, night, mk(dayHex));
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
  const night = mk(nightHex);
  const m = new THREE.MeshStandardMaterial({
    map: night, roughness: 0.3, metalness: 0.04, envMapIntensity: 0.7,
  });
  /* 夜间避免方向光在水面拉出过亮的镜面带, 日间才恢复反射 */
  regNum(m, 'roughness', 0.92, 0.3);
  regNum(m, 'envMapIntensity', 0.05, 0.7);
  return regFade(m, night, mk(dayHex));
}
