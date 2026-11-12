import React from 'react';
import VisitStats from './VisitStats.jsx';
import { SEASONS, formatHour, compassLabel, HOUR_MIN, HOUR_MAX } from '../three/sunlight.js';

const SunIcon = (
  <svg className="ic-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
const MoonIcon = (
  <svg className="ic-moon" viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" /></svg>
);
const TourIcon = (
  <svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="5" /></svg>
);
const ResetIcon = (
  <svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 2.3 6.3" /><path d="M4 5v5h5" /></svg>
);
const PlayIcon = (
  <svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" /></svg>
);
const PauseIcon = (
  <svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zM14 5h3v14h-3z" /></svg>
);

/* 日照时间轴：时刻滑块 + 节气 + 自动播放；夜间仅作状态展示 */
function SunBar({ day, hour, season, playing, sun, onHourChange, onSeasonChange, onTogglePlay }){
  return (
    <div className={`ui sunbar${day ? '' : ' off'}`}>
      <div className="sb-head">
        <span className="sb-title">日照模拟</span>
        <span className="sb-time">{formatHour(hour)}</span>
      </div>
      <div className="sb-row">
        <input type="range" min={HOUR_MIN} max={HOUR_MAX} step="0.25"
          value={hour} disabled={!day} aria-label="日照时刻"
          onChange={e => onHourChange(+e.target.value)} />
        <button className={`sb-play${playing ? ' on' : ''}`} disabled={!day}
          onClick={onTogglePlay} aria-label={playing ? '暂停日照播放' : '播放日照变化'}>
          {playing ? PauseIcon : PlayIcon}
        </button>
      </div>
      <div className="sb-foot">
        <div className="sb-seasons">
          {SEASONS.map(s => (
            <button key={s.key} className={season === s.key ? 'on' : ''}
              disabled={!day} onClick={() => onSeasonChange(s.key)}>{s.label}</button>
          ))}
        </div>
        <span className="sb-info">
          {day ? `${sun.elevationDeg.toFixed(0)}° ${compassLabel(sun.azimuthDeg)}` : '夜间'}
        </span>
      </div>
    </div>
  );
}

export default function TopBar({ day, touring, hour, season, playing, sun,
  onHourChange, onSeasonChange, onTogglePlay,
  onToggleTheme, onToggleTour, onReset }){
  return (
    <>
      <div className="ui top-right">
        <button className="btn" id="themeBtn" onClick={onToggleTheme}>
          {SunIcon}{MoonIcon}<span>{day ? '夜间模式' : '日间模式'}</span>
        </button>
        <button className={`btn${touring ? ' on' : ''}`} id="tour" onClick={onToggleTour}>
          {TourIcon}自动巡览
        </button>
        <button className="btn" id="reset" onClick={onReset}>{ResetIcon}重置视角</button>
        <a className="btn" href="report.html">统计报表</a>
        <VisitStats />
      </div>
      <SunBar day={day} hour={hour} season={season} playing={playing} sun={sun}
        onHourChange={onHourChange} onSeasonChange={onSeasonChange} onTogglePlay={onTogglePlay} />
    </>
  );
}
