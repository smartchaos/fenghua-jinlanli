import * as THREE from 'three';
import { heightOf } from '../data/index.js';

const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;

/* 选中环 + 射线拾取 + 相机聚焦动画。
 * 事件回调给 React: onSelect(building|null), onHover({b,x,y}|null) */
export function createInteraction(canvas, scene, camera, controls, pickMeshes, callbacks){
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null, selected = null;
  let camAnim = null;
  let down = null;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.15, 96),
    new THREE.MeshBasicMaterial({ color: 0xf6b26b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI/2; ring.visible = false; scene.add(ring);
  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.5, 96),
    new THREE.MeshBasicMaterial({ color: 0xf6b26b, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
  );
  ring2.rotation.x = -Math.PI/2; ring2.visible = false; scene.add(ring2);

  function toNDC(e){
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  }
  function pick(e){
    toNDC(e);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(pickMeshes, false);
    return hits.length ? hits[0].object.userData.b : null;
  }

  function focus(b){
    const h = heightOf(b);
    const dir = camera.position.clone().sub(controls.target);
    dir.y = 0; dir.normalize();
    const dist = b.type === '洋房' ? 88 : 116;
    const pos = new THREE.Vector3(b.x, Math.max(58, h*1.35), b.z).addScaledVector(dir, dist);
    const target = new THREE.Vector3(b.x, b.type === '洋房' ? 8 : 14, b.z);
    camAnim = { t: 0, fromPos: camera.position.clone(), toPos: pos, fromT: controls.target.clone(), toT: target, dur: 0.45 };
  }

  function openPanel(b){
    if(!b || !b.total) return;
    selected = b;
    const r = (b.type === '洋房' ? 30 : 27);
    ring.scale.set(r, r, 1);
    ring2.scale.set(r*1.5, r*1.5, 1);
    ring.position.set(b.x, 0.85, b.z);
    ring2.position.set(b.x, 0.84, b.z);
    ring.visible = true; ring2.visible = true;
    focus(b);
  }
  function closePanel(){
    ring.visible = false; ring2.visible = false;
    selected = null;
  }
  function resetCamAnim(){ camAnim = null; }
  function flyHome(homePos, homeTarget){
    closePanel();
    camAnim = { t: 0, fromPos: camera.position.clone(), toPos: homePos.clone(), fromT: controls.target.clone(), toT: homeTarget.clone(), dur: 0.45 };
  }

  const onPointerDown = e=>{ down = { x: e.clientX, y: e.clientY }; camAnim = null; };
  const onPointerUp = e=>{
    if(!down) return;
    const moved = Math.hypot(e.clientX-down.x, e.clientY-down.y);
    down = null;
    if(moved > 5) return;
    const b = pick(e);
    if(b){ openPanel(b); callbacks.onSelect(b); }
    else { closePanel(); callbacks.onSelect(null); }
  };
  const onPointerMove = e=>{
    const b = pick(e);
    if(b !== hovered){
      hovered = b;
      canvas.style.cursor = b ? 'pointer' : 'grab';
    }
    if(b) callbacks.onHover({ b, x: e.clientX, y: e.clientY });
    else callbacks.onHover(null);
  };
  const onPointerLeave = ()=>{ hovered = null; callbacks.onHover(null); };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  /* 每帧: 聚焦插值 + 选中环呼吸 */
  function update(now){
    if(camAnim){
      camAnim.t += 0.016;
      const k = ease(Math.min(1, camAnim.t / camAnim.dur));
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
      controls.target.lerpVectors(camAnim.fromT, camAnim.toT, k);
      if(camAnim.t >= camAnim.dur) camAnim = null;
    }
    if(selected){
      const t = now * 0.0016;
      ring.material.opacity = 0.38 + Math.sin(t)*0.16;
      ring2.material.opacity = 0.08 + Math.sin(t+1)*0.04;
    }
  }

  function dispose(){
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
  }

  return { openPanel, closePanel, resetCamAnim, flyHome, update, dispose };
}
