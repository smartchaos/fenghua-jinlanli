import * as THREE from 'three';

/* ---------- 日间日照模型 ----------
 * 项目位于杭州一带（纬度 30.3°N）。由「时刻 + 节气」按太阳赤纬/时角
 * 求地平坐标，得到真实太阳方向；光照强度、色温、霞光都随高度角变化。
 * 世界坐标约定：+x 东、+z 南、+y 上（与既有 sun.position(-160,108,135) 一致）。
 */
const RAD = Math.PI / 180;
const LAT = 30.3 * RAD;

export const SEASONS = [
  { key: 'summer',   label: '夏至', decl: 23.44 },
  { key: 'equinox',  label: '春秋分', decl: 0 },
  { key: 'winter',   label: '冬至', decl: -23.44 },
];

export const DEFAULT_HOUR = 15.5;      /* 春分 15:30 → 高度角约 32°，延续原有低角度日光 */
export const DEFAULT_SEASON = 'equinox';
export const HOUR_MIN = 6, HOUR_MAX = 18;

const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* 由太阳方向反推地平坐标下的单位向量（未归一化前即为方向余弦） */
export function sunState(hour, seasonKey = DEFAULT_SEASON){
  const decl = (SEASONS.find(s => s.key === seasonKey)?.decl ?? 0) * RAD;
  const H = (hour - 12) * 15 * RAD;             // 时角：正午 0°，每小时 15°
  const sp = Math.sin(LAT), cp = Math.cos(LAT);
  const sd = Math.sin(decl), cd = Math.cos(decl);

  const x = -cd * Math.sin(H);                   // 东向分量（下午为负=偏西）
  const y = sp * sd + cp * cd * Math.cos(H);    // 高度正弦
  const z = sp * cd * Math.cos(H) - cp * sd;    // 南向分量

  const elevation = Math.asin(clamp(y, -1, 1));
  const elevationDeg = elevation / RAD;
  /* 从正南起算、向西为正的方位角 */
  const azimuthDeg = Math.atan2(-x, z) / RAD;

  /* 太阳落到地平线下时，钳到略高于地平线：避免方向光从地面下方照射 */
  const dir = new THREE.Vector3(x, Math.max(y, 0.02), z).normalize();
  const sinAlt = Math.max(y, 0.02);

  /* 低角度 → 暖光、长影、厚霞；正午 → 中性白光 */
  const warm = 1 - smooth(9, 40, elevationDeg);
  /* 强度以默认机位(春分 15:30, 约 32°)为 1.0，随高度角平滑变化 */
  const strength = clamp(Math.pow(sinAlt / Math.sin(32 * RAD), 0.7), 0.16, 1.2);
  /* 地平线暖化、大气浑浊度 */
  const haze = 0.25 + 0.75 * warm;

  return {
    hour, season: seasonKey, dir,
    elevationDeg, azimuthDeg, sinAlt, warm, strength, haze,
    /* 方向光色：日间基色 → 低角度琥珀 */
    lightTint: new THREE.Color(0xffd9a8).lerp(new THREE.Color(0xff9a52), warm * 0.85),
    /* 天空霞光色 */
    skyTint: new THREE.Color(0xffedd0).lerp(new THREE.Color(0xff9c58), warm * 0.9),
  };
}

export function formatHour(h){
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/* 方位八向，给界面做直观标注 */
export function compassLabel(az){
  const dirs = ['南', '西南', '西', '西北', '北', '东北', '东', '东南'];
  const i = Math.round(((az % 360) + 360) % 360 / 45) % 8;
  return dirs[i];
}
