import React, { useState, useRef } from "react";
import Sketch from "react-p5";

// === 配置区 ===
const BRUSHES = {
  twist: { label: "🌪️ 绞/拧", icon: "🌪️" }, 
  pierce: { label: "⚡️ 刺/钻", icon: "⚡️" },
  heavy: { label: "🪨 坠/压", icon: "🪨" },
  wave:  { label: "〰️ 胀/扩", icon: "〰️" },
  scrape: { label: "🔪 刮/撕", icon: "🔪" }, // 新增：代表刀片刮肉、剥皮感
  move: { label: "🖐️ 拖拽画布", icon: "🖐️" }
};

const PALETTES = {
  crimson: { color: [220, 20, 60], label: "🩸" }, 
  dark:    { color: [180, 180, 180], label: "🌑" }, // 调亮一点灰色，否则黑背景看不见
  purple:  { color: [140, 50, 200], label: "🔮" }, 
  blue:    { color: [80, 160, 220], label: "❄️" }, 
};

// === 粒子类 ===
class PainParticle {
  constructor(p5, x, y, type, color, speed) {
    this.p5 = p5;
    this.pos = p5.createVector(x, y);
    this.type = type;
    this.color = color;
    this.life = 255;
    this.speed = speed || 1; 
    
    // 1. 刺/钻 (Pierce): 极速收缩范围，不再像爆炸
    if (type === 'pierce') {
      this.vel = p5.createVector(p5.random(-1, 1), p5.random(-1, 1));
      // 缩小初速度，让刺痛感集中在笔触附近
      this.vel.setMag(p5.random(1, 4) + speed * 0.05); 
      this.size = p5.random(0.5, 2); // 极细的针尖感
    } 
    // 2. 坠/压 (Heavy): 保持沉重
    else if (type === 'heavy') {
      this.vel = p5.createVector(p5.random(-0.2, 0.2), p5.random(0.5, 2));
      this.size = p5.random(5, 12); // 缩小单次坠落的墨滴大小，避免太糊
    } 
    // 3. 绞/拧 (Twist): 紧密缠绕
    else if (type === 'twist') {
      let angle = p5.random(p5.TWO_PI);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      this.vel.mult(p5.random(1, 3)); // 降低乱飞的速度
    } 
    // 4. 胀/扩 (Wave): 限制最大膨胀体积，避免晕染全屏
     else if (type === 'wave') {
      this.vel = p5.createVector(p5.random(-0.2, 0.2), p5.random(-0.2, 0.2));
      this.size = p5.random(2, 5); // 【修改点】初始极小！轻轻一点只是一个小点
      this.maxSize = p5.random(80, 120); // 但极限很大，体现“胀”
      this.life = 200; // 存活极长，慢慢弥散
    }
    // 5. 刮/撕 (Scrape): 紧贴笔触的刀锋感
    else if (type === 'scrape') {
      // 顺着鼠标方向有一点微小的切割位移
      this.vel = p5.createVector(p5.random(-1, 1), p5.random(-1, 1));
    }
  }

  update() {
    this.pos.add(this.vel);

    if (this.type === 'twist') {
      this.life -= 6; // 缩短生命，快速枯萎，不留太多残影糊成一团
      this.vel.rotate(0.4); 
      this.vel.mult(0.85); // 极速向中心收紧
    } 
    else if (this.type === 'heavy') {
      this.life -= 2; 
      this.vel.y += 0.2; 
      this.vel.x *= 0.8; 
    } 
    else if (this.type === 'wave') {
      this.life -= 2;
      if (this.size < this.maxSize) {
        this.size += 0.8; // 像气球一样缓慢膨胀
      }
      this.vel.mult(0.9); // 几乎停滞在原地
    }

    else if (this.type === 'scrape') {
      this.life -= 10; // 刀锋划过转瞬即逝，保持线条清晰！
      this.vel.mult(0.9); 
    }
    else { // pierce
      this.life -= 12; // 针刺感也是瞬间的，避免拖泥带水
    }
  }

  show(pg) {
    let p = pg || this.p5; 
    
    if (this.type === 'pierce') {
      // 【刺痛】：提高不透明度到 240，让线条变得极其锐利、明亮扎眼！
      p.stroke(this.color[0], this.color[1], this.color[2], 240);
      p.strokeWeight(this.size + 0.5); // 稍微加粗一点点
      p.line(this.pos.x, this.pos.y, this.pos.x + this.vel.x * 2, this.pos.y + this.vel.y * 2);
    } 
    else if (this.type === 'heavy') {
      // 【坠痛】：之前乘 0.5 太暗了（融入了黑背景），改为 0.8，并把透明度提升到 100
      p.noStroke();
      p.fill(this.color[0] * 0.8, this.color[1] * 0.8, this.color[2] * 0.8, 100); 
      p.ellipse(this.pos.x, this.pos.y, this.size, this.size * p.random(1.2, 2.0)); 
    } 
    else if (this.type === 'twist') {
      // 【绞痛】：透明度拉高到 220，线宽调到 1.5，让打结的钢丝感更凸显
      p.stroke(this.color[0], this.color[1], this.color[2], 220);
      p.strokeWeight(1.5);
      p.noFill();
      p.bezier(
        this.pos.x, this.pos.y, 
        this.pos.x + this.vel.x * 2, this.pos.y + this.vel.y * 2, 
        this.pos.x - this.vel.x * 2, this.pos.y - this.vel.y * 2, 
        this.pos.x + p.random(-3, 3), this.pos.y + p.random(-3, 3)
      );
    }
     else if (this.type === 'wave') {
      p.noStroke();
      // 【修改点】透明度降到极限的 3 或 4！靠随着时间的推移和膨胀慢慢叠加出“水肿/气团”的感觉
      p.fill(this.color[0], this.color[1], this.color[2], 3); 
      
      // 画一个大圈和一个稍小的内圈，制造边缘极其模糊的晕影感
      p.ellipse(this.pos.x, this.pos.y, this.size, this.size);
      p.ellipse(this.pos.x, this.pos.y, this.size * 0.6, this.size * 0.6); 
    }
    else if (this.type === 'scrape') {
      // 【刮/撕】：保持深色，但透明度拉满到 255，制造真实的血肉切割感
      p.stroke(this.color[0] * 0.8, this.color[1] * 0.5, this.color[2] * 0.5, 255); 
      p.strokeWeight(p.random(1.5, 3)); // 稍微加粗切割的纤维
      
      let angle = this.vel.heading();
      let len = p.random(5, 12); 
      p.line(this.pos.x, this.pos.y, this.pos.x + p.cos(angle)*len, this.pos.y + p.sin(angle)*len);
      
      // 掉落的果肉/血块：纯色无透明度，极其鲜艳抢眼
      if (p.random(1) < 0.3) {
        p.noStroke();
        p.fill(this.color[0], this.color[1] * 0.2, this.color[2] * 0.2, 255); 
        p.ellipse(this.pos.x + p.random(-4, 4), this.pos.y + p.random(-4, 4), p.random(1.5, 3.5));
      }
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
   const pgRef = useRef(null); // 绘画图层缓冲区
  const camRef = useRef({ x: 0, y: 0, zoom: 1.5 }); // 镜头参数：默认放大 1.5 倍
  const isDragging = useRef(false);
  const preload = (p5) => {
    bgImageRef.current = p5.loadImage("body_outline.png", 
      () => {}, 
      () => console.log("No bg image found")
    );
  };
  const setup = (p5, canvasParentRef) => {
    p5Ref.current = p5;
    p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
    
    // 【核心黑科技】：创建一个两倍屏幕大小的透明缓冲区，专门用来画痛觉
    pgRef.current = p5.createGraphics(window.innerWidth * 2, window.innerHeight * 2);
    
    // 调整初始相机位置，使其聚焦在人体腹部
    camRef.current.x = -window.innerWidth /4;
    camRef.current.y = -window.innerHeight /4;
  };

  const draw = (p5) => {
    // 1. 必须每帧清空主画布
    p5.background(0); 

    let { x, y, zoom } = camRef.current;

    // 2. 如果当前选择了 "move" 且按下了鼠标，执行拖拽
    if (activeBrush === 'move') {
      if (p5.mouseIsPressed) {
        // 更新相机位置
        camRef.current.x += p5.mouseX - p5.pmouseX;
        camRef.current.y += p5.mouseY - p5.pmouseY;
      }
    } else {
      // 3. 如果是绘画模式，计算真实的世界坐标 (抵消相机的位移和缩放)
      let realX = (p5.mouseX - x) / zoom;
      let realY = (p5.mouseY - y) / zoom;
      let realPx = (p5.pmouseX - x) / zoom;
      let realPy = (p5.pmouseY - y) / zoom;
      
      let speed = p5.dist(realX, realY, realPx, realPy);

      if (p5.mouseIsPressed || p5.touches.length > 0) {
        brushCounts.current[activeBrush] += 1;
        let numParticles = p5.constrain(p5.floor(speed / 10) + 1, 1, 4); 
        for(let i=0; i<numParticles; i++) {
          // 注意：现在粒子生成在 realX, realY
          particlesRef.current.push(new PainParticle(p5, realX, realY, activeBrush, PALETTES[activeColor].color, speed));
        }
      }
    }

    // 4. 更新粒子，并把它们画在【离屏缓冲区 pg】上，而不是直接画在主画布上！
    let pg = pgRef.current;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      let p = particlesRef.current[i];
      p.update();
      // 这里需要把 PainParticle 里的 p.line 改为 pg.line (如果你把粒子逻辑写在外部，需要传 pg 进去，为了简单，你可以把粒子类的 this.p5 指向 pg，或者在 show(pg) 时传入 pg)
      p.show(pg); 
      if (p.isDead()) particlesRef.current.splice(i, 1);
    }

     p5.push();
    p5.translate(x, y);
    p5.scale(zoom);

    // 画底图
    if (bgImageRef.current) {
      p5.imageMode(p5.CENTER);
      p5.tint(255, 40); // 这个 tint 会让底图变暗
      let imgScale = (p5.height * 0.9) / bgImageRef.current.height; 
      p5.image(bgImageRef.current, p5.width/2, p5.height/2, bgImageRef.current.width * imgScale, bgImageRef.current.height * imgScale);
    }

    // 画累积的痛觉笔触图层
    p5.noTint(); // 【关键修复！】关掉 tint 滤镜，让痛觉色彩 100%
    p5.imageMode(p5.CORNER);
    p5.image(pg, 0, 0);
    p5.pop();
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
      },
      scrape: {
        analogy: "🔪 痛觉通感：\n像一颗未完全成熟的果实被强行剥皮，皮上还带着丝丝缕缕真实的血肉被不断撕扯。",
        med: "主诉：强烈的撕裂样锐痛，伴随组织剥离感。考虑子宫内膜大块脱落引起的剧烈宫缩。"
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
           <button className={`tab ${identity==='work'?'active':''}`} onClick={()=>setIdentity('work')}>请假/社交</button>
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
          {identity === 'work' && (
            <>
              <h3 className="info-title" style={{borderLeftColor:'#ff9800'}}>不可见痛苦声明</h3>
              <p className="info-text">
                ⚠️ 我正在经历上述强度的生理剧痛，当前疼痛指数导致我的认知和体力暂时无法支撑日常工作与社交。
              </p>
              <div className="action-box" style={{background: 'rgba(255, 152, 0, 0.15)', color: '#ffcc80', borderLeftColor: '#ff9800'}}>
                <strong>💼 诉求建议：</strong><br/>
                我需要申请休息/独处空间，请谅解我可能无法及时回复消息。这不是普通的“肚子疼”，感谢您的共情与支持。
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