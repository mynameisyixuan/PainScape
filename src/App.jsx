import React, { useState, useRef } from "react";
import Sketch from "react-p5";

// === 配置区 ===
const BRUSHES = {
  twist: { label: "🌪️ 绞/拧", icon: "🌪️" }, 
  pierce: { label: "⚡️ 刺/钻", icon: "⚡️" },
  heavy: { label: "🪨 坠/压", icon: "🪨" },
  wave:  { label: "〰️ 胀/扩", icon: "〰️" },
  scrape: { label: "🔪 刮/撕", icon: "🔪" },
  eraser: { label: "🧽 橡皮", icon: "🧽" }, 
  move: { label: "🖐️ 拖拽", icon: "🖐️" }
};

const PALETTES = {
  crimson: { color: [220, 20, 60], label: "🩸" }, 
  dark:    { color: [180, 180, 180], label: "🌑" }, 
  purple:  { color: [140, 50, 200], label: "🔮" }, 
  blue:    { color: [80, 160, 220], label: "❄️" }, 
};

// === 粒子类 (极致痛觉重构版) ===
class PainParticle {
  constructor(p5, x, y, type, color, speed) {
    this.p5 = p5;
    this.pos = p5.createVector(x, y);
    this.type = type;
    this.color = color;
    this.life = 255;
    
    if (type === 'pierce') {
      this.vel = p5.createVector(p5.random(-1, 1), p5.random(-1, 1));
      this.vel.setMag(p5.random(3, 8) + speed * 0.1); // 刺得更长、更深
    } 
    else if (type === 'heavy') {
      this.vel = p5.createVector(p5.random(-0.5, 0.5), p5.random(1, 3));
      this.size = p5.random(3, 8); 
    } 
    else if (type === 'twist') {
      let angle = p5.random(p5.TWO_PI);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      this.vel.mult(p5.random(1, 4)); 
    } 
    else if (type === 'wave') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(2, 5); 
      this.maxSize = p5.random(40, 80); 
    }
    else if (type === 'scrape') {
      this.vel = p5.createVector(p5.random(-1, 1), p5.random(-1, 1));
    }
  }

  update() {
     this.pos.add(this.vel);

    if (this.type === 'twist') {
      this.life -= 8; 
      // 【关键修复】：加上 this.
      this.vel.rotate(this.p5.random(0.2, 0.8)); 
      this.vel.mult(0.8); 
    } 
    else if (this.type === 'heavy') {
      this.life -= 3; 
      this.vel.y += 0.4; // 强烈的重力拖拽
      this.vel.x *= 0.9; 
    } 
    else if (this.type === 'wave') {
      this.life -= 3;
      if (this.size < this.maxSize) this.size += 0.5; // 缓慢膨胀
    }
    else if (this.type === 'scrape') {
      this.life -= 15; 
      this.vel.mult(0.9); 
    }
    else { 
      this.life -= 15; 
    }
  }

  show(pg) {
    let p = pg || this.p5; 
    
    if (this.type === 'pierce') {
      // 刺：像玻璃碎裂或闪电一样的折线
      p.stroke(this.color[0], this.color[1], this.color[2], 255);
      p.strokeWeight(p.random(1, 3)); 
      let x2 = this.pos.x + this.vel.x * p.random(1, 2);
      let y2 = this.pos.y + this.vel.y * p.random(1, 2);
      p.line(this.pos.x, this.pos.y, x2, y2);
      // 极小概率在刺的末尾产生一个尖锐的爆裂点
      if(p.random(1) < 0.2) {
        p.noStroke(); p.fill(this.color[0], this.color[1], this.color[2], 200);
        p.triangle(x2, y2, x2+p.random(-3,3), y2+p.random(-3,3), x2+p.random(-3,3), y2+p.random(-3,3));
      }
    } 
    else if (this.type === 'heavy') {
      // 坠：像沉重的泥块或血液拉出的锐利下坠感 (抛弃圆形)
      p.noStroke();
      p.fill(this.color[0] * 0.6, this.color[1] * 0.6, this.color[2] * 0.6, 120); 
      p.beginShape();
      p.vertex(this.pos.x - this.size/2, this.pos.y);
      p.vertex(this.pos.x + this.size/2, this.pos.y);
      p.vertex(this.pos.x + p.random(-2,2), this.pos.y + this.size * p.random(2, 4)); // 尖锐的底部
      p.endShape(p.CLOSE);
    } 
    else if (this.type === 'twist') {
      // 绞：像生锈的铁丝网绞在一起，抛弃平滑曲线，改用锐利折线
      p.stroke(this.color[0] * 0.8, this.color[1] * 0.8, this.color[2] * 0.8, 200);
      p.strokeWeight(p.random(1, 2.5));
      p.line(this.pos.x, this.pos.y, this.pos.x + p.random(-15, 15), this.pos.y + p.random(-15, 15));
    }
    else if (this.type === 'wave') {
      // 胀：不规则的、颤抖的肿胀多边形
      p.noStroke();
      p.fill(this.color[0], this.color[1], this.color[2], 6); 
      p.beginShape();
      for(let i=0; i < p.TWO_PI; i += p.PI/4) {
        let r = this.size + p.random(-this.size * 0.15, this.size * 0.15); // 边缘参差不齐
        p.vertex(this.pos.x + p.cos(i) * r, this.pos.y + p.sin(i) * r);
      }
      p.endShape(p.CLOSE);
    }
    else if (this.type === 'scrape') {
      // 刮撕：粗糙、参差不齐的刀割感
      p.stroke(this.color[0] * 0.6, 0, 0, 255); 
      p.strokeWeight(p.random(2, 6)); 
      let angle = this.vel.heading();
      let len = p.random(10, 25); 
      let endX = this.pos.x + p.cos(angle)*len;
      let endY = this.pos.y + p.sin(angle)*len;
      p.line(this.pos.x, this.pos.y, endX, endY);
      
      // 剥落的血肉渣滓 (尖锐的三角形碎屑)
      if (p.random(1) < 0.4) {
        p.noStroke();
        p.fill(this.color[0], 0, 0, 255); 
        p.triangle(endX, endY, endX+p.random(-5,5), endY+p.random(-5,5), endX+p.random(-5,5), endY+p.random(-5,5));
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

  const brushCounts = useRef({ twist: 0, pierce: 0, heavy: 0, wave: 0, scrape: 0 });
  const particlesRef = useRef([]);
  const p5Ref = useRef(null);
  const bgImageRef = useRef(null);
  const pgRef = useRef(null); 
  const camRef = useRef({ x: 0, y: 0, zoom: 1.2 }); 

  // === 撤销功能栈 ===
  const undoStackRef = useRef([]);
  const hasSavedInitial = useRef(false);

  const preload = (p5) => {
    bgImageRef.current = p5.loadImage("body_outline.png", () => {}, () => {});
  };

  const setup = (p5, canvasParentRef) => {
    p5Ref.current = p5;
    p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
    pgRef.current = p5.createGraphics(window.innerWidth * 2, window.innerHeight * 2);
    
    camRef.current.x = -window.innerWidth / 2;
    camRef.current.y = -window.innerHeight / 4;
    
    // 初始化时保存一张全透明的底图到撤销栈
    if(!hasSavedInitial.current) {
      undoStackRef.current.push(pgRef.current.get());
      hasSavedInitial.current = true;
    }
  };

  // 【核心修复】：更严谨的安全区判定，把右侧按钮区也屏蔽掉！
  const isSafeToDraw = (p5) => {
    let currentY = p5.touches.length > 0 ? p5.touches[0].y : p5.mouseY;
    let currentX = p5.touches.length > 0 ? p5.touches[0].x : p5.mouseX;
    if (currentY < 80) return false; // 顶部栏
    if (currentY > window.innerHeight - 150) return false; // 底部工具栏
    if (currentX > window.innerWidth - 80) return false; // 右侧侧边栏按钮区 (放大缩小撤销)
    return true;
  };

  // 【核心修复】：手指或鼠标离开时保存快照，100%触发撤销记录！
  const mouseReleased = (p5) => {
    if (!isSafeToDraw(p5)) return; 
    if (activeBrush === 'move') return; 
    
    if (pgRef.current) {
      if (undoStackRef.current.length > 15) undoStackRef.current.shift();
      undoStackRef.current.push(pgRef.current.get());
    }
  };

  const handleUndo = () => {
    // 只有栈里大于1张图（意味着除了初始白板还有画过的）才允许撤销
    if (undoStackRef.current.length > 1) {
      undoStackRef.current.pop(); // 丢弃当前错误状态
      let prevImg = undoStackRef.current[undoStackRef.current.length - 1]; // 获取上一步
      pgRef.current.clear(); 
      pgRef.current.image(prevImg, 0, 0); 
      particlesRef.current = []; // 清空残留粒子
    } else if (undoStackRef.current.length === 1) {
      // 如果只剩最初的白板了，就直接清空
      pgRef.current.clear();
      particlesRef.current = [];
    }
  };

  const handleZoom = (delta) => {
    let newZoom = camRef.current.zoom + delta;
    camRef.current.zoom = Math.max(0.8, Math.min(newZoom, 3.0));
  };

  const draw = (p5) => {
    p5.background(0); 

    let { x, y, zoom } = camRef.current;
    let isInteracting = (p5.mouseIsPressed || p5.touches.length > 0) && isSafeToDraw(p5);

    if (activeBrush === 'move') {
      if (isInteracting) {
        camRef.current.x += p5.mouseX - p5.pmouseX;
        camRef.current.y += p5.mouseY - p5.pmouseY;
      }
    } else {
      let realX = (p5.mouseX - x) / zoom;
      let realY = (p5.mouseY - y) / zoom;
      let realPx = (p5.pmouseX - x) / zoom;
      let realPy = (p5.pmouseY - y) / zoom;
      let speed = p5.dist(realX, realY, realPx, realPy);

      if (isInteracting) {
        if (activeBrush === 'eraser') {
          pgRef.current.erase();
          pgRef.current.noStroke();
          pgRef.current.fill(255); 
          pgRef.current.ellipse(realX, realY, 60 / zoom, 60 / zoom); 
          pgRef.current.noErase();
        } else {
          brushCounts.current[activeBrush] += 1;
          let numParticles = p5.constrain(p5.floor(speed / 10) + 1, 1, 4); 
          for(let i=0; i<numParticles; i++) {
            particlesRef.current.push(new PainParticle(p5, realX, realY, activeBrush, PALETTES[activeColor].color, speed));
          }
        }
      }
    }

    let pg = pgRef.current;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      let p = particlesRef.current[i];
      p.update();
      p.show(pg); 
      if (p.isDead()) particlesRef.current.splice(i, 1);
    }

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
    const dominant = maxVal > 0 ? Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) : 'twist';
    
    const actionMap = {
      alone: "⚠️ 她选择了【独处模式】。\n请把热水袋和止痛药放在床头，然后安静离开，不要频繁询问。",
      company: "❤️ 她选择了【陪伴模式】。\n请放下手机，帮她揉揉后腰，或者只是安静地握着她的手。"
    };

    const TEXTS = {
      twist: { analogy: "🌪️ 痛觉通感：\n想象把一条湿毛巾用力拧干，再拧一圈，并持续保持这个紧绷状态。", med: "主诉：腹部持续性绞痛（Cramping），呈螺旋状收缩。建议排查子宫痉挛。" },
      pierce: { analogy: "⚡️ 痛觉通感：\n想象不打麻药进行根管治疗，或者光脚踩在乐高积木上持续跳跃。", med: "主诉：锐痛（Sharp Pain），呈放射状，伴随间歇性神经刺痛。位置不固定。" },
      heavy: { analogy: "🪨 痛觉通感：\n想象在腹部绑了5公斤沙袋跑800米，每一步内脏都在受重力拉扯。", med: "主诉：下腹部严重坠胀感（Bearing-down），伴随盆腔充血与腰骶部酸痛。" },
      wave: { analogy: "🎈 痛觉通感：\n想象肚子里有个气球在不断充气，快要炸了但就是不炸。", med: "主诉：弥漫性胀痛，边界不清，伴随腹部及肢体水肿感。" },
      scrape: { analogy: "🔪 痛觉通感：\n像一颗未完全成熟的果实被强行剥皮，皮上还带着丝丝缕缕真实的血肉被不断撕扯。", med: "主诉：强烈的撕裂样锐痛，伴随组织剥离感。考虑子宫内膜大块脱落引起的剧烈宫缩。" },
      eraser: { analogy: "疼痛稍微平息了一些。", med: "主诉：疼痛间歇期。" },
      move: { analogy: "疼痛蔓延。", med: "主诉：疼痛部位转移。" }
    };
    return { ...TEXTS[dominant], action: actionMap[userPref] };
  };

  if (page === "onboarding") {
    return (
      <div className="onboarding-container">
        <h1 style={{marginBottom:'10px', letterSpacing:'4px'}}>PainScape</h1>
        <p style={{marginBottom:'40px', fontSize:'0.9rem', opacity:0.7}}>具身痛觉可视化工具</p>
        <div style={{width:'100%', maxWidth:'320px'}}>
          <label style={{color:'#fff', marginBottom:'20px', display:'block', fontSize:'1.1rem'}}>当痛经最剧烈时，您更希望...</label>
          <div className="pref-group">
            <button className={`pref-btn ${userPref==='alone'?'active':''}`} onClick={()=>setUserPref('alone')}><span className="pref-title">🛑 别理我 (独处)</span><span className="pref-desc">请给我空间，不要打扰</span></button>
            <button className={`pref-btn ${userPref==='company'?'active':''}`} onClick={()=>setUserPref('company')}><span className="pref-title">🤝 陪陪我 (陪伴)</span><span className="pref-desc">我需要有人在身边支持</span></button>
          </div>
        </div>
        <button className="finish-btn" style={{marginTop:'50px', width:'200px', padding:'14px', fontSize:'16px'}} onClick={() => setPage("canvas")}>进入画板</button>
      </div>
    );
  }

  if (page === "canvas") {
    return (
      <div className="screen">
        {/* 注意：绑定了 mouseReleased 和 touchEnded */}
        <Sketch setup={setup} draw={draw} preload={preload} mouseReleased={mouseReleased} touchEnded={mouseReleased} />
        
        <div className="top-bar">
          <div><span className="logo">PainScape</span><div className="guide-text">释放你的痛感...</div></div>
          <button className="finish-btn" onClick={handleFinish}>生成</button>
        </div>

        <div className="side-tools">
          <button className="side-btn" onClick={(e) => { e.stopPropagation(); handleZoom(0.2); }}>➕</button>
          <button className="side-btn" onClick={(e) => { e.stopPropagation(); handleZoom(-0.2); }}>➖</button>
          <button className="side-btn" onClick={(e) => { e.stopPropagation(); handleUndo(); }}>↩️</button>
        </div>

        <div className="toolbar">
          <div className="brush-row">
            {Object.keys(BRUSHES).map(k => (
              <button key={k} className={`brush-btn ${activeBrush===k ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveBrush(k); }}>
                <span>{BRUSHES[k].icon}</span><span>{BRUSHES[k].label.split(" ")[1]}</span>
              </button>
            ))}
          </div>
          <div className="color-row">
            {Object.keys(PALETTES).map(k => (
              <div key={k} className={`color-btn ${activeColor===k ? 'active' : ''}`} style={{background: `rgb(${PALETTES[k].color.join(',')})`}} onClick={(e) => { e.stopPropagation(); setActiveColor(k); }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (page === "result") {
    const content = generateContent();
    return (
      <div className="result-screen">
        <div className="art-card">
          <img src={imgUrl} className="art-img" alt="pain" />
          <div style={{marginTop:'10px', display:'flex', justifyContent:'space-between', color:'#666', fontSize:'10px'}}>
             <span>记录时间: {new Date().toLocaleTimeString()}</span><span>PainScape Generated</span>
          </div>
        </div>

        <div className="tab-group">
          <button className={`tab ${identity==='partner'?'active':''}`} onClick={()=>setIdentity('partner')}>给伴侣</button>
          <button className={`tab ${identity==='work'?'active':''}`} onClick={()=>setIdentity('work')}>请假</button>
          <button className={`tab ${identity==='doctor'?'active':''}`} onClick={()=>setIdentity('doctor')}>给医生</button>
          <button className={`tab ${identity==='self'?'active':''}`} onClick={()=>setIdentity('self')}>对自己</button>
        </div>

        <div className="info-card">
          <div className="card-tag">AI 转译中</div>
          {identity === 'partner' && (
            <><h3 className="info-title">痛觉通感卡</h3><p className="info-text">{content.analogy}</p><div className="action-box"><strong>💡 行动指南：</strong><br/>{content.action}</div></>
          )}
          {identity === 'work' && (
            <><h3 className="info-title" style={{borderLeftColor:'#ff9800'}}>不可见痛苦声明</h3><p className="info-text">⚠️ 我正在经历上述强度的生理剧痛，当前疼痛指数导致我的认知和体力暂时无法支撑日常工作与社交。</p><div className="action-box" style={{background: 'rgba(255, 152, 0, 0.15)', color: '#ffcc80', borderLeftColor: '#ff9800'}}><strong>💼 诉求建议：</strong><br/>我需要申请休息/独处空间，请谅解我可能无法及时回复消息。这不是普通的“肚子疼”，感谢您的共情与支持。</div></>
          )}
          {identity === 'doctor' && (
            <><h3 className="info-title" style={{borderLeftColor:'#2196f3'}}>医疗辅助报告</h3><p className="info-text">{content.med}</p><div className="med-box"><strong>📋 建议检查：</strong><br/>- 盆腔B超（排除器质性病变）<br/>- 激素六项（月经第2-3天）</div></>
          )}
          {identity === 'self' && (
            <><h3 className="info-title" style={{borderLeftColor:'#9c27b0'}}>身体日记</h3><p className="info-text">你捕捉到了身体里的风暴。不论是痛还是累，都允许它们存在。这张图是你勇敢面对疼痛的证据。</p><div style={{marginTop:'15px', display:'flex', gap:'5px'}}><span className="tag">#具身记录</span><span className="tag">#自我关怀</span></div></>
          )}
        </div>

        <button className="retry-btn" onClick={()=>{ brushCounts.current={twist:0,pierce:0,heavy:0,wave:0,scrape:0}; setPage("onboarding"); }}>重新记录</button>
      </div>
    );
  }
}

export default App;