/* 场景共享常量 */
export const SITE_W = 240, SITE_D = 360;
export const RX = 110, RZ = 150;   // 顾扬路中心 x / 朱家坝路中心 z
export const SITE_LIFT = 3.0;      // 小区整体抬高一层; 大门/入口广场与负一层(y=0)对齐
export const CANAL_X = -1000;      // 京杭大运河水面中心（真实约 1km）
export const WORLD_HALF = 2600;    // 地面/城市半幅（真实米制, 1 单位=1m）
/* 天空穹顶半径：须大于「地面半幅对角线 3676 + 相机最远拉出距离 1000」，
 * 否则穹顶比远景更靠近相机，会把 880m 外的城市整片盖成天空色。 */
export const SKY_RADIUS = 6000;
