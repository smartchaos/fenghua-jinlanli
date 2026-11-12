import React, { useEffect, useRef, useState, useCallback } from 'react';
import Brand from './components/Brand.jsx';
import TopBar from './components/TopBar.jsx';
import Legend from './components/Legend.jsx';
import Tooltip from './components/Tooltip.jsx';
import Panel from './components/Panel.jsx';
import Loader from './components/Loader.jsx';
import { createModelApp, THEME_KEY } from './three/app.js';
import { sunState, DEFAULT_HOUR, DEFAULT_SEASON, HOUR_MAX, HOUR_MIN } from './three/sunlight.js';

function initialDay(){
  try{ return localStorage.getItem(THEME_KEY) !== 'night'; }catch(_){ return true; }
}

export default function App(){
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const [day, setDay] = useState(initialDay);
  const [touring, setTouring] = useState(false);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [hour, setHour] = useState(DEFAULT_HOUR);
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [playing, setPlaying] = useState(false);

  useEffect(()=>{
    const api = createModelApp(canvasRef.current, {
      initialDay: initialDay(),
      onSelect: setSelected,
      onHover: setHover
    });
    apiRef.current = api;
    const t = setTimeout(()=>setLoaded(true), 420);
    return ()=>{ clearTimeout(t); api.dispose(); apiRef.current = null; };
    // 场景只随挂载创建一次; 主题/选中走命令式 API
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(()=>{ document.body.classList.toggle('day', day); }, [day]);

  /* 时刻/节气变化 → 命令式更新 3D 太阳与阴影 */
  useEffect(()=>{ apiRef.current?.setSunTime(hour, season); }, [hour, season]);

  /* 自动播放：约每 90ms 推进 6 分钟，循环于 06:00–18:00 */
  useEffect(()=>{
    if(!playing || !day) return;
    const id = setInterval(()=>{
      setHour(h => (h + 0.1 > HOUR_MAX ? HOUR_MIN : +(h + 0.1).toFixed(2)));
    }, 90);
    return ()=>clearInterval(id);
  }, [playing, day]);
  useEffect(()=>{ if(!day) setPlaying(false); }, [day]);

  const toggleTheme = useCallback(()=>{
    setDay(d=>{
      apiRef.current?.applyTheme(!d);
      return !d;
    });
  }, []);
  const toggleTour = useCallback(()=>{
    setTouring(t=>{
      apiRef.current?.setTour(!t);
      return !t;
    });
  }, []);
  const resetView = useCallback(()=>{
    setSelected(null);
    apiRef.current?.resetView();
  }, []);
  const closePanel = useCallback(()=>{
    setSelected(null);
    apiRef.current?.closePanel();
  }, []);

  const sun = sunState(hour, season);

  return (
    <>
      <canvas id="scene" ref={canvasRef} />
      <Loader done={loaded} />
      <Brand />
      <TopBar day={day} touring={touring}
        hour={hour} season={season} playing={playing} sun={sun}
        onHourChange={setHour} onSeasonChange={setSeason}
        onTogglePlay={()=>setPlaying(p=>!p)}
        onToggleTheme={toggleTheme} onToggleTour={toggleTour} onReset={resetView} />
      <Legend />
      <Tooltip hover={hover} />
      <Panel b={selected} onClose={closePanel} />
    </>
  );
}
