import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { B, D, roomsByB } from '../data/index.js';
import { regColor, regNum, applyFaders, setThemedMaps } from './theme.js';
import { makeSky, makeSkyDome } from './sky.js';
import { createGround } from './ground.js';
import { createCanal } from './canal.js';
import { createVegetation, createCanalTrees, createWilds, createBoats, createCanalLabel, createWaterPlay, createGate } from './wilds.js';
import { createBuildings } from './buildings.js';
import { createInteraction } from './interaction.js';

/* 保持 r128 时代的色彩解析：Color.setHex 不做 sRGB→线性转换，
 * 让既有配色/贴图校准值在升级后仍然成立。 */
THREE.ColorManagement.enabled = false;

export const THEME_KEY = 'spax-theme-v2';

/* 场景总装: renderer/camera/lights/sky/ground/canal/wilds/buildings/interaction。
 * 返回命令式 API 供 React 调用; 事件经 callbacks 回传 React。 */
export function createModelApp(canvas, { initialDay, onSelect, onHover }){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071019);
  scene.fog = new THREE.Fog(0x071019, 450, 900);

  regColor(scene.background, 0x071019, 0xbcd6ea);
  regColor(scene.fog.color, 0x071019, 0xc2d9ea);
  regNum(scene.fog, 'near', 450, 800);
  regNum(scene.fog, 'far', 900, 1600);
  regNum(renderer, 'toneMappingExposure', 1.08, 1.1);

  const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, 1, 2000);
  const HOME_POS = new THREE.Vector3(-190, 265, 340);
  const HOME_TARGET = new THREE.Vector3(-70, 5, 0);
  camera.position.copy(HOME_POS);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 80;
  controls.maxDistance = 620;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.autoRotateSpeed = 0.55;
  controls.enablePan = false;
  controls.update();

  /* 灯光：r155 起取消 legacy 光强模式，旧的 0.62/1.45 等值需乘 π 才能复现原亮度 */
  const PI = Math.PI;
  const hemi = new THREE.HemisphereLight(0x9db3d6, 0x0a0e15, 0.62*PI);
  regColor(hemi.color, 0x9db3d6, 0xd8e6f5);
  regColor(hemi.groundColor, 0x0a0e15, 0x9aa78c);
  regNum(hemi, 'intensity', 0.62*PI, 0.85*PI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2c0, 1.45*PI);
  regColor(sun.color, 0xffe2c0, 0xfff6e6);
  regNum(sun, 'intensity', 1.45*PI, 1.5*PI);
  sun.position.set(-110, 190, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200; sun.shadow.camera.bottom = -200;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6a8dff, 0.34*PI);
  regColor(rim.color, 0x6a8dff, 0xaac8ee);
  regNum(rim, 'intensity', 0.34*PI, 0.12*PI);
  rim.position.set(160, 90, -180);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffb45c, 0.5*PI, 260, 0);
  regNum(warm, 'intensity', 0.5*PI, 0);
  warm.position.set(0, 40, 30);
  scene.add(warm);

  /* 天空穹顶 */
  const skyNight = makeSkyDome(scene, makeSky(false));
  const skyDay = makeSkyDome(scene, makeSky(true));

  /* 场景内容 */
  const ground = createGround(scene, B, renderer);
  const { canalGrp } = createCanal(scene, renderer);
  createVegetation(scene, ground.treeSpots);
  createCanalTrees(canalGrp);
  createWilds(canalGrp);
  createBoats(canalGrp);
  createCanalLabel(canalGrp);
  createWaterPlay(scene);
  createGate(scene);
  const buildings = createBuildings(scene, B, roomsByB);
  const interaction = createInteraction(canvas, scene, camera, controls, buildings.pickMeshes,
    { onSelect, onHover, onChange: ()=>{ needsRender = true; } });

  /* ---------- day / night 主题 ---------- */
  let themeT = 0, themeTarget = 0;
  let needsRender = true;   // 按需渲染: 仅相机变动/动画/主题过渡时重绘, 闲置时零 GPU 占用
  function applyTheme(day, instant){
    try{ localStorage.setItem(THEME_KEY, day ? 'day' : 'night'); }catch(_){}
    themeTarget = day ? 1 : 0;
    if(instant) themeT = themeTarget;
    ground.setGroundMaps(day);
    setThemedMaps(day);
    buildings.setFacadeMaps(day);
    needsRender = true;
  }
  applyTheme(initialDay, true);

  /* ---------- intro 生长动画 ---------- */
  const INTRO_POS = new THREE.Vector3(-220, 290, 390);
  const t0 = performance.now();
  let introDone = false;
  function updateIntro(now){
    if(introDone) return;
    const t = (now - t0) / 820;
    let done = true;
    buildings.groups.forEach((g, i)=>{
      const local = Math.min(1, Math.max(0, (t - i*0.022) / 0.72));
      const e = 1 - Math.pow(1-local, 3);
      g.scale.y = Math.max(0.001, e);
      const l = Math.min(1, Math.max(0, (local - 0.25) / 0.75));
      buildings.labels[i].material.opacity = l;
      if(local < 1) done = false;
    });
    /* 相机飞入：首帧若被着色器编译阻塞超过 820ms，t 会一次性跨过 1，
     * 必须在该帧直接落到 HOME_POS，否则相机会永久停在入场起点。 */
    const k = easeInOut(Math.min(1, t));
    if(k < 1) camera.position.lerpVectors(INTRO_POS, HOME_POS, k);
    else camera.position.copy(HOME_POS);
    if(done && t > 1.05){ introDone = true; }
  }
  function easeInOut(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

  /* ---------- 主循环（按需渲染） ---------- */
  controls.addEventListener('change', ()=>{ needsRender = true; });
  renderer.shadowMap.autoUpdate = false;   // 场景静态: 阴影贴图只在生长动画期重算
  let raf = 0;
  function animate(){
    raf = requestAnimationFrame(animate);
    const now = performance.now();
    updateIntro(now);
    const animating = interaction.update(now);
    themeT += (themeTarget - themeT) * 0.065;
    if(Math.abs(themeTarget - themeT) < 0.0015) themeT = themeTarget;
    applyFaders(themeT);
    skyNight.material.opacity = 1 - themeT;
    skyDay.material.opacity = themeT;
    skyNight.position.copy(camera.position);
    skyDay.position.copy(camera.position);
    controls.update();
    if(needsRender || animating || !introDone || themeT !== themeTarget){
      if(!introDone) renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      needsRender = false;
    }
  }
  animate();

  const onResize = ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    needsRender = true;
  };
  addEventListener('resize', onResize);

  /* ---------- 对外命令式 API（同步回传 React 状态） ---------- */
  function openPanelById(b){ interaction.openPanel(b); onSelect(b || null); needsRender = true; }
  function resetView(){ interaction.flyHome(HOME_POS, HOME_TARGET); onSelect(null); needsRender = true; }
  function closePanel(){ interaction.closePanel(); onSelect(null); needsRender = true; }
  function setTour(on){ controls.autoRotate = on; }
  function dispose(){
    cancelAnimationFrame(raf);
    removeEventListener('resize', onResize);
    interaction.dispose();
    controls.dispose();
    renderer.dispose();
  }

  const api = {
    D, openPanel: openPanelById, closePanel, resetView, setTour, applyTheme, dispose,
    scene, canalGrp, renderer, camera, controls
  };
  window.__MODEL = api;
  return api;
}
