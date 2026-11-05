import React from 'react';
import VisitStats from './VisitStats.jsx';
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

export default function TopBar({ day, touring, onToggleTheme, onToggleTour, onReset }){
  return (
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
  );
}
