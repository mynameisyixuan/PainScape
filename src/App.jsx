import React, { useState, useRef, useEffect } from "react";
import Sketch from "react-p5";

// === 配置区 ===
const BRUSHES = {
  twist: { label: "🌪️ 绞/拧", icon: "🌪️" },
  pierce: { label: "⚡️ 刺/钻", icon: "⚡️" },
  heavy: { label: "🪨 坠/压", icon: "🪨" },
  wave:  { label: "〰️ 胀/扩", icon: "〰️" },
  scrape: { label: "🔪 刮/撕", icon: "🔪" },
  eraser: { label: "🧽 橡皮", icon: "🧽" }
};

const PALETTES = {
  crimson: { color: [220, 20, 60], label: "🩸" },
  dark:    { color: [180, 180, 180], label: "🌑" },
  purple:  { color: [140, 50, 200], label: "🔮" },
  blue:    { color: [80, 160, 220], label: "❄️" },
};

// === 粒子类 (支持发光与动态呼吸重构版) ===
class PainParticle {
  constructor(p5, x, y, type, color, speed) {
    this.p5 = p5;
    this.pos = p5.createVector(x, y);
    this.type = type;
    this.color = color;
    this.life = 255;
    this.seed = p5.random(1000); // 用于动态呼吸的随机种子

    // 【核心改造】：区分动态画笔和静态画笔
    this.isDynamic = (type === 'wave' || type === 'twist');

    if (type === 'pierce') {
      this.vel = p5.createVector(p5.random(-1, 1), p5.random(-1, 1));
      this.vel.setMag(p5.random(3, 8) + speed * 0.05);
    }
    else if (type === 'heavy') {
      this.vel = p5.createVector(p5.random(-0.2, 0.2), p5.random(0.5, 1.5));
      this.size = p5.random(2, 4); // 缩小体积
    }
    else if (type === 'twist') {
      this.vel = p5.createVector(0, 0); // 原地转动
      this.size = p5.random(10, 25); // 齿轮大小
      this.angle = p5.random(p5.TWO_PI);
    }
    else if (type === 'wave') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(5, 15);
      this.maxSize = p5.random(30, 60);
    }
    else if (type === 'scrape') {
      this.vel = p5.createVector(p5.random(-1, 1), p5.random(-1, 1));
    }
  }

  update(p5) {
    this.pos.add(this.vel);

    if (this.type === 'twist') {
      this.angle += 0.05; // 【动态】：永远在缓慢旋转
      this.size *= 0.99;  // 慢慢变紧
      if(this.size < 2) this.life = 0; // 收缩到极限就死亡
    }
    else if (this.type === 'heavy') {
      this.life -= 4;
      this.vel.y += 0.3;
    }
    else if (this.type === 'wave') {
      // 【动态】：不需要减 life，让它基于 frameCount 永远呼吸
      this.pulseSize = this.size + p5.sin(p5.frameCount * 0.05 + this.seed) * (this.maxSize - this.size);
    }
    else if (this.type === 'scrape') {
      this.life -= 15;
      this.vel.mult(0.9);
    }
    else { this.life -= 15; }
  }

  show(pg) {
    let p = pg || this.p5;

    // 【发光引擎】：利用底层 Shadow Blur 实现真实发光感
    p.drawingContext.shadowBlur = 15;
    p.drawingContext.shadowColor = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;

    if (this.type === 'pierce') {
      p.stroke(255, 255, 255, 200); // 针刺中心发白
      p.strokeWeight(1.5);
      p.line(this.pos.x, this.pos.y, this.pos.x + this.vel.x, this.pos.y + this.vel.y);
    }
    else if (this.type === 'heavy') {
      p.noStroke();
      p.fill(this.color[0]*0.5, this.color[1]*0.5, this.color[2]*0.5, 150);
      p.ellipse(this.pos.x, this.pos.y, this.size, this.size * 2);
    }
    else if (this.type === 'twist') {
      // 【回归齿轮/烟花感】：动态旋转的芒刺
      p.push();
      p.translate(this.pos.x, this.pos.y);
      p.rotate(this.angle);
      p.stroke(this.color[0], this.color[1], this.color[2], 180);
      p.strokeWeight(1.5);
      for(let i=0; i<6; i++) {
        p.line(0, 0, this.size * p.cos(i * p.PI/3), this.size * p.sin(i * p.PI/3));
      }
      p.noStroke(); p.fill(this.color[0], this.color[1], this.color[2], 200);
      p.ellipse(0, 0, this.size * 0.3); // 核心
      p.pop();
    }
    else if (this.type === 'wave') {
      // 【呼吸感水肿】
      p.noStroke();
      p.fill(this.color[0], this.color[1], this.color[2], 12);
      p.ellipse(this.pos.x, this.pos.y, this.pulseSize, this.pulseSize);
      p.fill(this.color[0], this.color[1], this.color[2], 30);
      p.ellipse(this.pos.x, this.pos.y, this.pulseSize * 0.5, this.pulseSize * 0.5);
    }
    else if (this.type === 'scrape') {
      p.stroke(this.color[0], this.color[1], this.color[2], 255);
      p.strokeWeight(p.random(1.5, 3));
      let angle = this.vel.heading();
      let len = p.random(10, 20);
      p.line(this.pos.x, this.pos.y, this.pos.x + p.cos(angle)*len, this.pos.y + p.sin(angle)*len);
    }

    // 重置阴影防止污染全局
    p.drawingContext.shadowBlur = 0;
  }
  isDead() { return this.life < 0; }
}

function App() {
  const [page, setPage] = useState("onboarding");
  // 【交互升级】：默认值为 null，代表一进画布就是“拖拽模式”
  const [activeBrush, setActiveBrush] = useState(null);
  const [activeColor, setActiveColor] = useState("crimson");
  const [identity, setIdentity] = useState("partner");
  const [imgUrl, setImgUrl] = useState(null);

  // 【务实的偏好状态】
  const [userPref, setUserPref] = useState("care");

  const brushCounts = useRef({ twist: 0, pierce: 0, heavy: 0, wave: 0, scrape: 0 });
  const staticParticles = useRef([]); // 画完就死的粒子（存到Buffer）
  const dynamicParticles = useRef([]); // 永远呼吸/转动的粒子（实时渲染）

  const p5Ref = useRef(null);
  const bgImageRef = useRef(null);
  const pgRef = useRef(null);
  const camRef = useRef({ x: 0, y: 0, zoom: 1.2 });

  // 长按判定变量
  const pressTimer = useRef(0);
  const isLongPressing = useRef(false);

  // 禁用浏览器默认右键和滚动，以防手势冲突
  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener("contextmenu", preventDefault);
    return () => document.removeEventListener("contextmenu", preventDefault);
  }, []);

  const preload = (p5) => {
    bgImageRef.current = p5.loadImage("body_outline.png", () => {}, () => {});
  };

  const setup = (p5, canvasParentRef) => {
    p5Ref.current = p5;
    p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
    pgRef.current = p5.createGraphics(window.innerWidth * 2, window.innerHeight * 2);
    camRef.current.x = -window.innerWidth / 2;
    camRef.current.y = -window.innerHeight / 4;
  };

  const isSafeToDraw = (p5) => {
    let currentY = p5.touches.length > 0 ? p5.touches[0].y : p5.mouseY;
    if (currentY < 80) return false;
    if (currentY > window.innerHeight - 150) return false;
    return true;
  };

  const mouseWheel = (p5, event) => {
    let zoomAmount = event.delta > 0 ? -0.1 : 0.1;
    camRef.current.zoom = Math.max(0.5, Math.min(camRef.current.zoom + zoomAmount, 3.0));
    return false;
  };

  const draw = (p5) => {
    p5.background(0);
    let { x, y, zoom } = camRef.current;

    let isInteracting = (p5.mouseIsPressed || p5.touches.length > 0) && isSafeToDraw(p5);

    // 计算移动速度
    let realX = (p5.mouseX - x) / zoom;
    let realY = (p5.mouseY - y) / zoom;
    let realPx = (p5.pmouseX - x) / zoom;
    let realPy = (p5.pmouseY - y) / zoom;
    let speed = p5.dist(realX, realY, realPx, realPy);

    // 【核心黑科技：长按判定】
    if (!isInteracting) {
      pressTimer.current = 0;
      isLongPressing.current = false;
    } else {
      if (speed < 1) pressTimer.current++; // 停留在原地，计时器增加
      else pressTimer.current = 0; // 一旦移动，计时器重置

      if (pressTimer.current > 20) isLongPressing.current = true; // 约停留 300ms 触发长按
    }

    // 拖拽条件：没选画笔 OR 正在长按 OR 右键 OR 双指
    let isPanning = (activeBrush === null) || isLongPressing.current || p5.mouseButton === p5.RIGHT || p5.touches.length >= 2;

    if (isInteracting) {
      if (isPanning) {
        camRef.current.x += p5.mouseX - p5.pmouseX;
        camRef.current.y += p5.mouseY - p5.pmouseY;
      } else if (activeBrush === 'eraser') {
        pgRef.current.erase();
        pgRef.current.ellipse(realX, realY, 40 / zoom, 40 / zoom);
        pgRef.current.noErase();
        // 橡皮擦也要把周围的动态粒子删掉
        dynamicParticles.current = dynamicParticles.current.filter(p => p5.dist(p.pos.x, p.pos.y, realX, realY) > 20);
      } else {
        brushCounts.current[activeBrush] += 1;
        // 降低生成频率，避免太满
        if (p5.frameCount % 2 === 0 || speed > 10) {
          let pObj = new PainParticle(p5, realX, realY, activeBrush, PALETTES[activeColor].color, speed);
          if (pObj.isDynamic) {
            dynamicParticles.current.push(pObj);
            // 限制动态粒子数量，防止手机卡死
            if (dynamicParticles.current.length > 150) dynamicParticles.current.shift();
          } else {
            staticParticles.current.push(pObj);
          }
        }
      }
    }

    // 更新静态粒子，写入 Buffer
    let pg = pgRef.current;
    for (let i = staticParticles.current.length - 1; i >= 0; i--) {
      let p = staticParticles.current[i];
      p.update(p5); p.show(pg);
      if (p.isDead()) staticParticles.current.splice(i, 1);
    }

    // 渲染主画面
    p5.push();
    p5.translate(x, y);
    p5.scale(zoom);

    if (bgImageRef.current) {
      p5.imageMode(p5.CENTER);
      p5.tint(255, 40);
      let imgScale = (p5.height * 0.9) / bgImageRef.current.height;
      p5.image(bgImageRef.current, p5.width/2, p5.height/2, bgImageRef.current.width * imgScale, bgImageRef.current.height * imgScale);
    }

    p5.noTint();
    p5.imageMode(p5.CORNER);
    p5.image(pg, 0, 0); // 画出已经死去的静态痕迹

    // 【动态呼吸粒子】：永远悬浮在画面最顶层实时渲染
    for (let i = dynamicParticles.current.length - 1; i >= 0; i--) {
      let dp = dynamicParticles.current[i];
      dp.update(p5);
      dp.show(p5); // 直接传主画布 p5，不进 Buffer
      if (dp.isDead()) dynamicParticles.current.splice(i, 1);
    }

    p5.pop();
  };

  const handleFinish = () => {
    if (p5Ref.current) {
      const canvas = document.querySelector("canvas");
      setImgUrl(canvas.toDataURL("image/png"));
      setPage("result");
    }
  };

  const handleShare = async () => {
    try {
      const blob = await (await fetch(imgUrl)).blob();
      const file = new File([blob], 'painscape.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: '不可见痛苦声明', files: [file] });
      } else {
        const link = document.createElement('a');
        link.href = imgUrl; link.download = 'painscape.png'; link.click();
        alert("已保存图片，请手动发送。");
      }
    } catch(e) { console.log(e); }
  };

  const generateContent = () => {
    const counts = brushCounts.current;
    const maxVal = Math.max(...Object.values(counts));
    const dominant = maxVal > 0 ? Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) : 'twist';

    // 【务实干货指令卡】：解决“只给鸡汤”的痛点
    const actionMap = {
      alone: "🛑 偏好指令：【需要绝对独处】\n1. 帮她倒一杯热水，备好布洛芬放在床头。\n2. 调暗房间光源，关门出去，给她绝对的个人空间。\n3. 不要每隔十分钟进房问“好点没”，这会让她烦躁。",
      care: "🥣 偏好指令：【需要物理照顾】\n1. 她现在体力透支，请主动去冲红糖姜水或准备热水袋。\n2. 帮她揉搓后腰（骶骨位置），或者用热手掌捂在她小腹上。\n3. 请主动承担今天的家务和外卖，让她安心平躺。",
      comfort: "🫂 偏好指令：【需要情绪安抚】\n1. 请放下手机，在床边安静地陪着她。\n2. 握着她的手，或者抱抱她，提供心理安全感。\n3. 如果她愿意，可以找些轻松的话题转移她的注意力。"
    };

    const painName = {
      twist: "绞痛", pierce: "刺痛", heavy: "严重坠胀", wave: "弥漫性胀痛", scrape: "撕裂样锐痛"
    };

    const TEXTS = {
      twist: { analogy: "🌪️ 痛觉通感：\n想象把一条湿毛巾用力拧干，再拧一圈，并持续保持这个紧绷状态。", med: "主诉：腹部持续性绞痛（Cramping），呈螺旋状收缩。建议排查子宫痉挛。" },
      pierce: { analogy: "⚡️ 痛觉通感：\n想象不打麻药进行根管治疗，或者光脚踩在乐高积木上持续跳跃。", med: "主诉：锐痛（Sharp Pain），呈放射状，伴随间歇性神经刺痛。" },
      heavy: { analogy: "🪨 痛觉通感：\n想象在腹部绑了5公斤沙袋跑800米，每一步内脏都在受重力拉扯。", med: "主诉：下腹部严重坠胀感（Bearing-down），伴随盆腔充血与腰骶部酸痛。" },
      wave: { analogy: "🎈 痛觉通感：\n想象肚子里有个气球在不断充气，快要炸了但就是不炸。", med: "主诉：弥漫性胀痛，边界不清，伴随水肿感。" },
      scrape: { analogy: "🔪 痛觉通感：\n像一颗未完全成熟的果实被强行剥皮，皮上还带着丝丝缕缕真实的血肉被不断撕扯。", med: "主诉：强烈的撕裂样锐痛，伴随组织剥离感。" }
    };

    return { ...TEXTS[dominant], action: actionMap[userPref], pain: painName[dominant] };
  };

  // === 0. Onboarding (实用偏好调查) ===
  if (page === "onboarding") {
    return (
      <div className="onboarding-container" style={{padding: '30px', textAlign: 'center'}}>
        <h1 style={{marginBottom:'10px', letterSpacing:'4px'}}>PainScape</h1>
        <p style={{marginBottom:'30px', fontSize:'0.9rem', color:'#aaa'}}>拒绝鸡汤，定制你的真实诉求</p>

        <div style={{width:'100%', maxWidth:'320px', textAlign:'left'}}>
          <label style={{color:'#fff', marginBottom:'15px', display:'block', fontSize:'1.1rem', fontWeight:'bold'}}>
            当痛经发作时，你最需要伴侣/家人怎么做？
          </label>
          <div className="pref-group" style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <button className={`pref-btn ${userPref==='alone'?'active':''}`} onClick={()=>setUserPref('alone')} style={{padding:'15px', borderRadius:'12px', textAlign:'left', background:'#222', border: userPref==='alone'?'2px solid #d32f2f':'1px solid #444', color:'#fff'}}>
              <div style={{fontSize:'16px', fontWeight:'bold'}}>🛑 别管我，让我一个人待着</div>
              <div style={{fontSize:'12px', color:'#888', marginTop:'5px'}}>只需要备好药和水，禁止频繁打扰</div>
            </button>
            <button className={`pref-btn ${userPref==='care'?'active':''}`} onClick={()=>setUserPref('care')} style={{padding:'15px', borderRadius:'12px', textAlign:'left', background:'#222', border: userPref==='care'?'2px solid #d32f2f':'1px solid #444', color:'#fff'}}>
              <div style={{fontSize:'16px', fontWeight:'bold'}}>🥣 我没力气，需要实际照顾</div>
              <div style={{fontSize:'12px', color:'#888', marginTop:'5px'}}>冲红糖水、揉腰、包揽家务</div>
            </button>
            <button className={`pref-btn ${userPref==='comfort'?'active':''}`} onClick={()=>setUserPref('comfort')} style={{padding:'15px', borderRadius:'12px', textAlign:'left', background:'#222', border: userPref==='comfort'?'2px solid #d32f2f':'1px solid #444', color:'#fff'}}>
              <div style={{fontSize:'16px', fontWeight:'bold'}}>🫂 我很脆弱，需要情绪陪伴</div>
              <div style={{fontSize:'12px', color:'#888', marginTop:'5px'}}>安静陪着我，握着手转移注意力</div>
            </button>
          </div>
        </div>

        <button style={{marginTop:'40px', width:'100%', maxWidth:'320px', padding:'16px', background:'#d32f2f', color:'#fff', border:'none', borderRadius:'25px', fontSize:'16px', fontWeight:'bold', cursor:'pointer'}}
          onClick={() => setPage("canvas")}>
          进入痛觉画板
        </button>
      </div>
    );
  }

  // === 1. Canvas ===
  if (page === "canvas") {
    return (
      <div className="screen" style={{touchAction: 'none'}}>
        <Sketch setup={setup} draw={draw} preload={preload} mouseWheel={mouseWheel} />

        <div className="top-bar" style={{position:'absolute', top:0, width:'100%', padding:'20px', pointerEvents:'none', display:'flex', justifyContent:'space-between', zIndex:10}}>
          <div><span style={{color:'#fff', fontWeight:'bold', fontSize:'20px'}}>PainScape</span></div>
          <button style={{pointerEvents:'auto', background:'#d32f2f', color:'#fff', border:'none', padding:'8px 20px', borderRadius:'20px', cursor:'pointer'}} onClick={handleFinish}>生成</button>
        </div>

        <div className="toolbar" style={{position:'absolute', bottom:'30px', left:'50%', transform:'translateX(-50%)', width:'90%', maxWidth:'380px', background:'rgba(20,20,20,0.85)', backdropFilter:'blur(10px)', padding:'15px', borderRadius:'20px'}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
            {Object.keys(BRUSHES).map(k => (
              <button key={k} style={{flex:1, background:activeBrush===k?'#444':'transparent', border:'none', color:activeBrush===k?'#fff':'#888', padding:'8px 0', borderRadius:'10px', fontSize:'12px', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer'}} onClick={(e) => { e.stopPropagation(); setActiveBrush(activeBrush === k ? null : k); }}>
                <span style={{fontSize:'20px', marginBottom:'4px'}}>{BRUSHES[k].icon}</span>
                <span>{BRUSHES[k].label.split(" ")[1]}</span>
              </button>
            ))}
          </div>
          <div style={{display:'flex', justifyContent:'center', gap:'20px'}}>
            {Object.keys(PALETTES).map(k => (
              <div key={k} style={{width:'30px', height:'30px', borderRadius:'50%', border:activeColor===k?'2px solid #fff':'2px solid #444', background:`rgb(${PALETTES[k].color.join(',')})`, cursor:'pointer', transform:activeColor===k?'scale(1.2)':'none'}} onClick={(e) => { e.stopPropagation(); setActiveColor(k); }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // === 2. Result ===
  if (page === "result") {
    const content = generateContent();
    return (
      <div className="result-screen" style={{padding:'20px', height:'100vh', background:'#111', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center'}}>
        <div className="art-card" style={{width:'100%', maxWidth:'350px', background:'#000', borderRadius:'12px', padding:'5px', border:'1px solid #333', marginTop:'10px'}}>
          <img src={imgUrl} style={{width:'100%', height:'auto', display:'block', borderRadius:'8px'}} alt="pain" />
          <div style={{marginTop:'8px', display:'flex', justifyContent:'space-between', color:'#666', fontSize:'10px', padding:'0 5px'}}>
             <span>Date: {new Date().toLocaleDateString()}</span><span>PainScape Generated</span>
          </div>
        </div>

        <div style={{display:'flex', gap:'10px', margin:'20px 0', width:'100%', maxWidth:'350px'}}>
          {['partner','work','doctor','self'].map(tab => (
            <button key={tab} style={{flex:1, padding:'10px 0', background:identity===tab?'#444':'#222', color:identity===tab?'#fff':'#888', border:'none', borderRadius:'8px', fontSize:'13px'}} onClick={()=>setIdentity(tab)}>
              {{partner:'给伴侣', work:'请假', doctor:'给医生', self:'日记'}[tab]}
            </button>
          ))}
        </div>

        <div className="info-card" style={{background:'#1c1c1c', padding:'20px', borderRadius:'12px', width:'100%', maxWidth:'350px', border:'1px solid #333'}}>
          {identity === 'partner' && (
            <><h3 style={{color:'#fff', margin:'0 0 10px 0'}}>通感说明书</h3><p style={{color:'#ccc', fontSize:'14px', lineHeight:'1.5'}}>{content.analogy}</p><div style={{marginTop:'15px', padding:'15px', background:'rgba(211,47,47,0.1)', borderLeft:'3px solid #d32f2f', color:'#ffcdd2', fontSize:'13px', whiteSpace:'pre-wrap'}}><strong>💡 伴侣实操指南：</strong><br/>{content.action}</div></>
          )}
          {/* 【真实落地的请假文案】 */}
          {identity === 'work' && (
            <><h3 style={{color:'#ff9800', margin:'0 0 10px 0'}}>不可见痛苦声明 (请假单)</h3><p style={{color:'#ccc', fontSize:'14px', lineHeight:'1.5'}}>您好：<br/>我今日突发严重原发性痛经（目前呈现强烈的<strong>{content.pain}</strong>），伴随冷汗与体力透支，现已无法维持正常坐姿与专注度。</p><div style={{marginTop:'15px', padding:'15px', background:'rgba(255,152,0,0.1)', borderLeft:'3px solid #ff9800', color:'#ffcc80', fontSize:'13px'}}><strong>💼 诉求：</strong><br/>特申请今日居家休息/请假。非紧急工作烦请留言，身体平复后我将第一时间处理。感谢理解与批准。</div></>
          )}
          {identity === 'doctor' && (
            <><h3 style={{color:'#2196f3', margin:'0 0 10px 0'}}>医疗辅助报告</h3><p style={{color:'#ccc', fontSize:'14px', lineHeight:'1.5'}}>{content.med}</p><div style={{marginTop:'15px', padding:'15px', background:'rgba(33,150,243,0.1)', borderLeft:'3px solid #2196f3', color:'#90caf9', fontSize:'13px'}}><strong>📋 建议检查：</strong><br/>- 盆腔超声（排查子宫内膜异位）<br/>- 激素检查（月经第2-3天）</div></>
          )}
          {identity === 'self' && (
            <><h3 style={{color:'#9c27b0', margin:'0 0 10px 0'}}>身体日记</h3><p style={{color:'#ccc', fontSize:'14px', lineHeight:'1.5'}}>你捕捉到了身体里的风暴。不论是痛还是累，都允许它们存在。这张图是你勇敢面对疼痛的证据。</p></>
          )}
        </div>

        <div style={{display:'flex', gap:'15px', width:'100%', maxWidth:'350px', marginTop:'30px', marginBottom:'40px'}}>
          <button style={{flex:1, padding:'14px', borderRadius:'20px', background:'#4caf50', color:'#fff', border:'none', fontWeight:'bold', cursor:'pointer'}} onClick={handleShare}>发送</button>
          <button style={{flex:1, padding:'14px', borderRadius:'20px', background:'transparent', border:'1px solid #555', color:'#aaa', cursor:'pointer'}} onClick={()=>{ brushCounts.current={twist:0,pierce:0,heavy:0,wave:0,scrape:0}; setPage("onboarding"); }}>重画</button>
        </div>
      </div>
    );
  }
}

export default App;