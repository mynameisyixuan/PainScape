import React, { useState, useRef } from "react";
import Sketch from "react-p5";

// === 配置区 ===
const BRUSHES = {
  twist: { label: "🌪️ 绞/拧", icon: "🌪️" }, 
  pierce: { label: "⚡️ 刺/钻", icon: "⚡️" },
  heavy: { label: "🪨 坠/压", icon: "🪨" },
  wave:  { label: "〰️ 胀/扩", icon: "〰️" }
};

const PALETTES = {
  crimson: { color: [220, 20, 60], label: "🩸" }, 
  dark:    { color: [180, 180, 180], label: "🌑" }, // 调亮一点灰色，否则黑背景看不见
  purple:  { color: [140, 50, 200], label: "🔮" }, 
  blue:    { color: [80, 160, 220], label: "❄️" }, 
};

// === 粒子类 ===
class PainParticle {
  constructor(p5, x, y, type, color) {
    this.p5 = p5;
    this.pos = p5.createVector(x, y);
    this.type = type;
    this.color = color;
    this.life = 255;
    this.size = p5.random(2, 6);
    
    if (type === 'pierce') this.vel = p5.createVector(p5.random(-15, 15), p5.random(-15, 15));
    else if (type === 'heavy') this.vel = p5.createVector(0, p5.random(2, 6));
    else if (type === 'twist') this.vel = p5.createVector(p5.random(-3, 3), p5.random(-3, 3));
    else this.vel = p5.createVector(p5.random(-2, 2), p5.random(-2, 2));
  }

  update() {
    this.life -= 2; // 粒子会死，但画在画布上的痕迹保留
    this.pos.add(this.vel);

    if (this.type === 'twist') {
      this.vel.rotate(0.2); 
      this.vel.mult(0.94); // 快速收缩
    } else if (this.type === 'heavy') {
      this.vel.y += 0.2; 
    } else if (this.type === 'wave') {
      this.size += 0.5; 
      this.life -= 1;
    }
  }

  show() {
    let p = this.p5;
    p.noStroke();
    // 关键：不透明度设低一点，方便堆叠出层次感
    p.fill(this.color[0], this.color[1], this.color[2], 20); 

    if (this.type === 'pierce') {
      // 刺痛：画线，像划痕
      p.stroke(this.color[0], this.color[1], this.color[2], 40);
      p.strokeWeight(2);
      p.line(this.pos.x, this.pos.y, this.pos.x - this.vel.x*2, this.pos.y - this.vel.y*2);
    } else if (this.type === 'heavy') {
      // 坠痛：画垂直的流淌痕迹
      p.ellipse(this.pos.x, this.pos.y, this.size, this.size*2);
    } else {
      p.ellipse(this.pos.x, this.pos.y, this.size, this.size);
    }
  }

  isDead() { return this.life < 0; }
}

function App() {
  const [page, setPage] = useState("onboarding"); 
  const [activeBrush, setActiveBrush] = useState("twist");
  const [activeColor, setActiveColor] = useState("crimson");
  const [identity, setIdentity] = useState("partner");
  const [imgUrl, setImgUrl] = useState(null);
  const [userPref, setUserPref] = useState("company"); 

  const brushCounts = useRef({ twist: 0, pierce: 0, heavy: 0, wave: 0 });
  const particlesRef = useRef([]);
  const p5Ref = useRef(null);
  const bgImageRef = useRef(null);

  // 加载底图
  const preload = (p5) => {
    bgImageRef.current = p5.loadImage("body_outline.png", 
      () => {}, 
      () => console.log("No bg image found")
    );
  };

  const setup = (p5, canvasParentRef) => {
    p5Ref.current = p5;
    p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
    p5.background(0); // 初始全黑

    // 绘制底图 (仅一次)
    if (bgImageRef.current) {
      p5.push();
      p5.imageMode(p5.CENTER);
      p5.tint(255, 30); // 极淡
      let scale = Math.min(p5.width / bgImageRef.current.width, p5.height / bgImageRef.current.height) * 0.8;
      p5.image(bgImageRef.current, p5.width/2, p5.height/2, bgImageRef.current.width * scale, bgImageRef.current.height * scale);
      p5.pop();
    } else {
      // 如果没图，画个简单的圈圈代替
      p5.noFill();
      p5.stroke(30);
      p5.strokeWeight(2);
      p5.ellipse(p5.width/2, p5.height/2 + 50, 200, 200);
    }
  };

  const draw = (p5) => {
    // 关键修改：【不】调用 background()
    // 这样上一帧画的东西会一直保留在画布上，直到我们手动清除
    // 效果就像在纸上画画，越画越密

    if (p5.mouseIsPressed || p5.touches.length > 0) {
      brushCounts.current[activeBrush] += 1;
      for(let i=0; i<4; i++) {
        particlesRef.current.push(new PainParticle(p5, p5.mouseX, p5.mouseY, activeBrush, PALETTES[activeColor].color));
      }
    }

    // 更新并绘制粒子
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      let p = particlesRef.current[i];
      p.update();
      p.show();
      if (p.isDead()) particlesRef.current.splice(i, 1);
    }
  };

  const handleFinish = () => {
    if (p5Ref.current) {
      const canvas = document.querySelector("canvas");
      setImgUrl(canvas.toDataURL("image/png"));
      setPage("result");
    }
  };

  const generateContent = () => {
    const counts = brushCounts.current;
    const maxVal = Math.max(...Object.values(counts));
    // 如果啥都没画，默认给 twist
    const dominant = maxVal > 0 
      ? Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b)
      : 'twist';
    
    const actionMap = {
      alone: "⚠️ 她选择了【独处模式】。\n请把热水袋和止痛药放在床头，然后安静离开，不要频繁询问。",
      company: "❤️ 她选择了【陪伴模式】。\n请放下手机，帮她揉揉后腰，或者只是安静地握着她的手。"
    };

    const TEXTS = {
      twist: {
        analogy: "🌪️ 痛觉通感：\n想象把一条湿毛巾用力拧干，再拧一圈，并持续保持这个紧绷状态。",
        med: "主诉：腹部持续性绞痛（Cramping），呈螺旋状收缩。建议排查子宫痉挛。"
      },
      pierce: {
        analogy: "⚡️ 痛觉通感：\n想象不打麻药进行根管治疗，或者光脚踩在乐高积木上持续跳跃。",
        med: "主诉：锐痛（Sharp Pain），呈放射状，伴随间歇性神经刺痛。位置不固定。"
      },
      heavy: {
        analogy: "🪨 痛觉通感：\n想象在腹部绑了5公斤沙袋跑800米，每一步内脏都在受重力拉扯。",
        med: "主诉：下腹部严重坠胀感（Bearing-down），伴随盆腔充血与腰骶部酸痛。"
      },
      wave: {
        analogy: "🎈 痛觉通感：\n想象肚子里有个气球在不断充气，快要炸了但就是不炸。",
        med: "主诉：弥漫性胀痛，边界不清，伴随腹部及肢体水肿感。"
      }
    };
    
    return { ...TEXTS[dominant], action: actionMap[userPref] };
  };

  // === 0. Onboarding ===
  if (page === "onboarding") {
    return (
      <div className="onboarding-container">
        <h1 style={{marginBottom:'10px', letterSpacing:'4px'}}>PainScape</h1>
        <p style={{marginBottom:'40px', fontSize:'0.9rem', opacity:0.7}}>具身痛觉可视化工具</p>
        
        <div style={{width:'100%', maxWidth:'320px'}}>
          <label style={{color:'#fff', marginBottom:'20px', display:'block', fontSize:'1.1rem'}}>
            当痛经最剧烈时，您更希望...
          </label>
          <div className="pref-group">
            <button className={`pref-btn ${userPref==='alone'?'active':''}`} onClick={()=>setUserPref('alone')}>
              <span className="pref-title">🛑 别理我 (独处)</span>
              <span className="pref-desc">请给我空间，不要打扰</span>
            </button>
            <button className={`pref-btn ${userPref==='company'?'active':''}`} onClick={()=>setUserPref('company')}>
              <span className="pref-title">🤝 陪陪我 (陪伴)</span>
              <span className="pref-desc">我需要有人在身边支持</span>
            </button>
          </div>
        </div>

        <button className="finish-btn" style={{marginTop:'50px', width:'200px', padding:'14px', fontSize:'16px'}} 
          onClick={() => setPage("canvas")}>
          进入画板
        </button>
      </div>
    );
  }

  // === 1. Canvas ===
  if (page === "canvas") {
    return (
      <div className="screen">
        <Sketch setup={setup} draw={draw} preload={preload} />
        
        <div className="top-bar">
          <div>
            <span className="logo">PainScape</span>
            <div className="guide-text">请回忆一次经历，释放你的痛感...</div>
          </div>
          <button className="finish-btn" onClick={handleFinish}>生成</button>
        </div>

        <div className="toolbar">
          <div className="brush-row">
            {Object.keys(BRUSHES).map(k => (
              <button key={k} className={`brush-btn ${activeBrush===k ? 'active' : ''}`} onClick={() => setActiveBrush(k)}>
                <span>{BRUSHES[k].icon}</span>
                <span>{BRUSHES[k].label.split(" ")[1]}</span>
              </button>
            ))}
          </div>
          <div className="color-row">
            {Object.keys(PALETTES).map(k => (
              <div key={k} className={`color-btn ${activeColor===k ? 'active' : ''}`} 
                style={{background: `rgb(${PALETTES[k].color.join(',')})`}}
                onClick={() => setActiveColor(k)} />
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
      <div className="result-screen">
        <div className="art-card">
          <img src={imgUrl} className="art-img" alt="pain" />
          <div style={{marginTop:'10px', display:'flex', justifyContent:'space-between', color:'#666', fontSize:'10px'}}>
             <span>记录时间: {new Date().toLocaleTimeString()}</span>
             <span>PainScape Generated</span>
          </div>
        </div>

        <div className="tab-group">
          <button className={`tab ${identity==='partner'?'active':''}`} onClick={()=>setIdentity('partner')}>给Ta看</button>
          <button className={`tab ${identity==='doctor'?'active':''}`} onClick={()=>setIdentity('doctor')}>给医生</button>
          <button className={`tab ${identity==='self'?'active':''}`} onClick={()=>setIdentity('self')}>对自己</button>
        </div>

        <div className="info-card">
          <div className="card-tag">AI 转译中</div>
          
          {identity === 'partner' && (
            <>
              <h3 className="info-title">痛觉通感卡</h3>
              <p className="info-text">{content.analogy}</p>
              <div className="action-box">
                <strong>💡 行动指南：</strong><br/>
                {content.action}
              </div>
            </>
          )}

          {identity === 'doctor' && (
            <>
              <h3 className="info-title" style={{borderLeftColor:'#2196f3'}}>医疗辅助报告</h3>
              <p className="info-text">{content.med}</p>
              <div className="med-box">
                <strong>📋 建议检查：</strong><br/>
                - 盆腔B超（排除器质性病变）<br/>
                - 激素六项（月经第2-3天）
              </div>
            </>
          )}

          {identity === 'self' && (
            <>
              <h3 className="info-title" style={{borderLeftColor:'#9c27b0'}}>身体日记</h3>
              <p className="info-text">
                你捕捉到了身体里的风暴。不论是痛还是累，都允许它们存在。这张图是你勇敢面对疼痛的证据。
              </p>
              <div style={{marginTop:'15px', display:'flex', gap:'5px'}}>
                <span className="tag">#具身记录</span>
                <span className="tag">#自我关怀</span>
              </div>
            </>
          )}
        </div>

        <button className="retry-btn" 
          onClick={()=>{ brushCounts.current={twist:0,pierce:0,heavy:0,wave:0}; setPage("onboarding"); }}>
          重新记录
        </button>
      </div>
    );
  }
}

export default App;