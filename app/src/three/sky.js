import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { SKY_RADIUS } from './constants.js';

/* ---------- 夜空贴图 ---------- */
export function makeNightSky(){
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 1024);
  grd.addColorStop(0, '#01030a'); grd.addColorStop(.5, '#06101e'); grd.addColorStop(.78, '#0d1d33');
  grd.addColorStop(1, '#1a2a3f');
  g.fillStyle = grd; g.fillRect(0, 0, 2048, 1024);

  const rnd = mulberry32(20261104);
  /* 地平线城市辉光：远处灯火把低空染成暖灰蓝 */
  const city = g.createLinearGradient(0, 400, 0, 560);
  city.addColorStop(0, 'rgba(255,178,110,0)');
  city.addColorStop(.7, 'rgba(255,166,96,.07)');
  city.addColorStop(1, 'rgba(255,166,96,0)');
  g.fillStyle = city; g.fillRect(0, 400, 2048, 160);
  /* 淡银河：沿斜带聚集的细密星点 */
  for(let i = 0; i < 620; i++){
    const t = rnd();
    const x = t * 2100 - 40;
    const y = 120 + t * 330 + (rnd() - .5) * 150;
    const a = .06 + rnd() * .18;
    g.fillStyle = `rgba(206,222,255,${a})`;
    g.beginPath(); g.arc(x, y, .4 + rnd() * .7, 0, 7); g.fill();
  }
  for(let i = 0; i < 850; i++){
    const x = rnd() * 2048, y = rnd() * 880;
    const r = rnd() * 1.3 + .3, a = .2 + rnd() * .75;
    g.fillStyle = `rgba(${220 + Math.floor(rnd() * 35)},${228 + Math.floor(rnd() * 27)},255,${a})`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  /* 月亮与月晕 */
  const mx = 400, my = 190;
  const mg = g.createRadialGradient(mx, my, 8, mx, my, 165);
  mg.addColorStop(0, 'rgba(228,238,252,.55)'); mg.addColorStop(.45, 'rgba(198,220,250,.12)');
  mg.addColorStop(1, 'rgba(228,238,252,0)');
  g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 165, 0, 7); g.fill();
  g.fillStyle = '#eef3fc'; g.beginPath(); g.arc(mx, my, 26, 0, 7); g.fill();
  g.fillStyle = 'rgba(185,202,226,.45)';
  g.beginPath(); g.arc(mx - 8, my - 6, 5, 0, 7); g.fill();
  g.beginPath(); g.arc(mx + 9, my + 8, 4, 0, 7); g.fill();

  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- 日间云层（等距柱状透明贴图） ----------
 * canvas 上半 = 天顶方向、中线 = 地平线。积云用「冷灰底座 + 亮白顶部」
 * 两遍柔边 puff 叠出体积，另有高空卷云与地平线薄雾带。
 * 只生成一次；太阳位置、霞光、云被照亮的方向都由 shader 按 uniform 实时算。 */
function makeCloudTexture(){
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const rnd = mulberry32(20261112);

  /* 地平线薄雾 */
  const haze = g.createLinearGradient(0, 420, 0, 570);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(.52, 'rgba(255,250,240,.13)');
  haze.addColorStop(1, 'rgba(255,250,240,0)');
  g.fillStyle = haze; g.fillRect(0, 420, W, 150);

  /* 高空卷云：压扁的柔边椭圆，方向略倾斜 */
  for(let i = 0; i < 30; i++){
    const cx = rnd() * W, cy = 175 + rnd() * 265;
    const w = 200 + rnd() * 460, h = 9 + rnd() * 26;
    const a = .06 + rnd() * .10;
    g.save();
    g.translate(cx, cy); g.rotate((rnd() - .5) * .32); g.scale(1, h / (w / 2));
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(.55, `rgba(255,255,255,${a * .6})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, w / 2, 0, 7); g.fill();
    g.restore();
  }

  /* 云团先生成 puff 几何，再按同一组数据在经度两侧复制，
   * 保证 u=0/1 接缝处左右形状完全一致（否则会出现一条竖直硬边）。 */
  const makePuffs = (cx, cy, s) => {
    const n = 9 + Math.floor(rnd() * 5);
    const puffs = [];
    for(let j = 0; j < n; j++){
      const t = j / (n - 1);
      puffs.push({
        x: cx + (t - .5) * s * 2.25 + (rnd() - .5) * s * .28,
        y: cy - Math.sin(t * Math.PI) * s * .46 + (rnd() - .5) * s * .2,
        r: s * (.34 + rnd() * .4),
      });
    }
    return puffs;
  };
  const paintCloud = (puffs, s, alpha) => {
    /* 底部冷灰：给出厚度与自阴影 */
    for(const p of puffs){
      const py = p.y + s * .2, r = p.r * 1.15;
      const rg = g.createRadialGradient(p.x, py, r * .1, p.x, py, r);
      rg.addColorStop(0, `rgba(140,162,184,${alpha * .62})`);
      rg.addColorStop(1, 'rgba(140,162,184,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(p.x, py, r, 0, 7); g.fill();
    }
    /* 顶部亮白：略上移，形成被照亮的上缘 */
    for(const p of puffs){
      const py = p.y - p.r * .3, r = p.r;
      const rg = g.createRadialGradient(p.x, py, 0, p.x, py, r);
      rg.addColorStop(0, `rgba(255,255,255,${alpha})`);
      rg.addColorStop(.55, `rgba(255,255,255,${alpha * .8})`);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(p.x, py, r, 0, 7); g.fill();
    }
  };

  /* 主积云带：越靠地平线越小越扁（球面透视压缩） */
  for(let i = 0; i < 34; i++){
    const cy = 265 + Math.pow(rnd(), .82) * 225;
    const near = (cy - 265) / 225;
    const s = (20 + rnd() * 26) * (1 - near * .35);
    const cx = rnd() * W;
    const a = .26 + rnd() * .18;
    const puffs = makePuffs(cx, cy, s);
    paintCloud(puffs, s, a);
    if(cx < s * 1.8) paintCloud(puffs.map(p => ({ ...p, x: p.x + W })), s, a);
    if(cx > W - s * 1.8) paintCloud(puffs.map(p => ({ ...p, x: p.x - W })), s, a);
  }
  /* 贴地平线的一排远层积云，压得很扁，做出空气透视 */
  for(let i = 0; i < 26; i++){
    const cx = rnd() * W, cy = 468 + rnd() * 46;
    const s = 26 + rnd() * 42;
    paintCloud(makePuffs(cx, cy, s * .48), s * .48, .16 + rnd() * .10);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/* ---------- 日间天空穹顶（着色器） ----------
 * 大气分层 / 地平线暖化 / 太阳方位霞光 / 日晕 / 太阳盘 / 云被照亮的方向，
 * 全部按视线方向与 uSunDir 实时计算，时间变化时只更新 uniform，无需重画贴图。 */
const VERT = /* glsl */`
  varying vec3 vDir;
  varying vec2 vUv;
  void main(){
    vDir = normalize(position);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* 颜色常量写在线性域；材质 toneMapped=false，仅由 colorspace_fragment
 * 做一次线性→sRGB 编码，蓝天与云的明暗不会被 ACES 压成一片灰白。 */
const FRAG = /* glsl */`
  uniform vec3 uSunDir;
  uniform vec3 uSkyTint;
  uniform sampler2D uClouds;
  uniform float uWarm;
  uniform float uHaze;
  uniform float uOpacity;
  varying vec3 vDir;
  varying vec2 vUv;

  void main(){
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 sun = normalize(uSunDir);
    float sd = max(dot(d, sun), 0.0);
    float ang = acos(clamp(dot(d, sun), -1.0, 1.0));

    /* 大气：天顶深蓝 → 晴蓝 → 地平线暖白 */
    vec3 zenith  = vec3(0.013, 0.098, 0.320);
    vec3 high    = vec3(0.045, 0.220, 0.530);
    vec3 mid     = vec3(0.185, 0.420, 0.720);
    vec3 horizon = vec3(0.690, 0.790, 0.870);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, y));
    col = mix(col, high, smoothstep(0.13, 0.52, y));
    col = mix(col, zenith, smoothstep(0.48, 1.0, y));

    /* 天空的暖化比光照更宽容：午后也留一点暖意，正午仍保持中性 */
    float warm = pow(uWarm, 0.65);
    col = mix(col, uSkyTint * 0.82, warm * 0.18 * smoothstep(-0.05, 0.35, y));
    float sunZone = pow(sd, 3.0);
    col = mix(col, uSkyTint, sunZone * (0.14 + 0.46 * warm) * smoothstep(-0.06, 0.28, y));
    float hz = exp(-max(y, 0.0) * 7.0);
    col = mix(col, uSkyTint, hz * (0.10 + 0.30 * warm) * (0.55 + 0.45 * uHaze));

    /* 云：用顶点 UV 采样，避免 atan2 经度接缝造成的竖条伪影 */
    vec4 cl = texture2D(uClouds, vUv);
    float lit = 0.42 + 0.58 * pow(sd, 1.4);
    vec3 cloudCol = mix(vec3(0.20, 0.26, 0.34), vec3(0.97, 0.95, 0.91), lit);
    cloudCol = mix(cloudCol, uSkyTint * 1.15, sunZone * warm * 0.45);
    float cloudFade = smoothstep(-0.10, 0.03, y);
    /* 日面附近让云变薄，太阳才不会淹没在白云里 */
    float sunHole = 1.0 - 0.78 * exp(-ang * ang * 260.0);
    col = mix(col, cloudCol, min(cl.a * 1.35, 1.0) * cloudFade * sunHole);

    /* 暖金光冠（用 mix，白云上也能显色）+ 大范围柔和光晕 + 太阳盘 */
    float corona = exp(-ang * ang * 700.0) * 0.9 + exp(-ang * ang * 90.0) * 0.35;
    col = mix(col, mix(uSkyTint, vec3(1.0, 0.78, 0.42), 0.55), clamp(corona, 0.0, 1.0) * 0.5);
    float halo = exp(-ang * ang * 14.0) * 0.16 + exp(-ang * ang * 2.5) * 0.065;
    col += uSkyTint * halo * (0.55 + 0.75 * warm);
    float disc = 1.0 - smoothstep(0.009, 0.013, ang);
    col = mix(col, vec3(1.0, 0.99, 0.93), disc);

    /* 地平线以下与远景雾衔接 */
    col = mix(col, vec3(0.52, 0.60, 0.62), (1.0 - smoothstep(-0.14, 0.0, y)) * 0.55);

    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function makeDaySkyDome(scene){
  const uniforms = {
    uSunDir:  { value: new THREE.Vector3(-0.7, 0.5, 0.3).normalize() },
    uSkyTint: { value: new THREE.Color(0xffedd0).convertSRGBToLinear() },
    uClouds:  { value: makeCloudTexture() },
    uWarm:    { value: 0.15 },
    uHaze:    { value: 0.35 },
    uOpacity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), mat);
  m.name = 'sky-day';
  m.renderOrder = -1;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}

/* 夜空仍用贴图穹顶 */
export function makeSkyDome(scene, tex){
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 48, 24),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, transparent: true, depthWrite: false })
  );
  m.name = 'sky-night';
  m.renderOrder = -1;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
