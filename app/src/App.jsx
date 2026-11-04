import React, { useEffect, useRef, useState, useCallback } from 'react';
import Brand from './components/Brand.jsx';
import TopBar from './components/TopBar.jsx';
import Legend from './components/Legend.jsx';
import Tooltip from './components/Tooltip.jsx';
import Panel from './components/Panel.jsx';
import Loader from './components/Loader.jsx';
import { createModelApp, THEME_KEY } from './three/app.js';

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

  return (
    <>
      <canvas id="scene" ref={canvasRef} />
      <Loader done={loaded} />
      <Brand />
      <TopBar day={day} touring={touring}
        onToggleTheme={toggleTheme} onToggleTour={toggleTour} onReset={resetView} />
      <Legend />
      <Tooltip hover={hover} />
      <Panel b={selected} onClose={closePanel} />
    </>
  );
}
