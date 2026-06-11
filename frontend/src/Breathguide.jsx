import React, { useState, useRef, useEffect } from 'react';

const BreathingGuide = ({ isOpen, onClose, language = 'zh' }) => {
  const [phase, setPhase] = useState('inhale'); // inhale, hold, exhale
  const [timer, setTimer] = useState(0);
  const [circleSize, setCircleSize] = useState(100);
  const audioCtx = useRef(null);
  const intervalRef = useRef(null);
  
  const t = {
    zh: {
      inhale: '吸气',
      hold: '屏息',
      exhale: '呼气',
      start: '开始呼吸引导',
      stop: '停止',
      close: '关闭'
    },
    en: {
      inhale: 'Inhale',
      hold: 'Hold',
      exhale: 'Exhale',
      start: 'Start Breathing',
      stop: 'Stop',
      close: 'Close'
    }
  }[language];
  
  const startBreathing = () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // 创建柔和的环境音
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.type = 'sine';
    osc.frequency.value = 120;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.start();
    
    // 呼吸循环
    let step = 0;
    const phases = [
      { name: 'inhale', duration: 4000, targetSize: 180 },
      { name: 'hold', duration: 4000, targetSize: 180 },
      { name: 'exhale', duration: 6000, targetSize: 60 }
    ];
    
    intervalRef.current = setInterval(() => {
      const currentPhase = phases[step % 3];
      setPhase(currentPhase.name);
      
      // 动画效果
      const startSize = circleSize;
      const endSize = currentPhase.targetSize;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / currentPhase.duration);
        const newSize = startSize + (endSize - startSize) * progress;
        setCircleSize(newSize);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
      step++;
    }, 4000);
  };
  
  const stopBreathing = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioCtx.current) {
      audioCtx.current.close();
      audioCtx.current = null;
    }
    setPhase('inhale');
    setCircleSize(100);
  };
  
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioCtx.current) audioCtx.current.close();
    };
  }, []);
  
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: 'fixed',
      zIndex: 1000,
      top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a1a',
        borderRadius: '30px',
        padding: '30px',
        textAlign: 'center',
        maxWidth: '350px',
        width: '90%'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          width: `${circleSize}px`,
          height: `${circleSize}px`,
          margin: '0 auto 30px auto',
          borderRadius: '50%',
          background: 'rgba(76, 175, 80, 0.2)',
          border: '2px solid #4caf50',
          transition: 'width 0.05s linear, height 0.05s linear'
        }} />
        
        <div style={{ color: '#4caf50', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
          {t[phase]}
        </div>
        
        <button
          onClick={intervalRef.current ? stopBreathing : startBreathing}
          style={{
            width: '100%',
            padding: '14px',
            background: '#4caf50',
            border: 'none',
            borderRadius: '30px',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer',
            marginBottom: '12px'
          }}
        >
          {intervalRef.current ? t.stop : t.start}
        </button>
        
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            background: 'transparent',
            border: '1px solid #444',
            borderRadius: '30px',
            color: '#888',
            cursor: 'pointer'
          }}
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};

export default BreathingGuide;