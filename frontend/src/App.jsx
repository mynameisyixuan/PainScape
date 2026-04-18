import React, { useState, useRef, useEffect } from "react";
import Sketch from "react-p5";

// === 配置区 ===
const QUOTES = [
  "慢性疼痛相当于长期的“unmaking”——把人困在身体牢笼里。\n—— Elaine Scarry",
  "疼痛不仅是神经的电冲动，它是对自我边界的侵犯。",
  "语言在痛苦面前总是匮乏的，而视觉是一道划破沉默的闪电。",
  "不被看见的痛楚，往往需要承受双倍的煎熬。",
  "拒绝隐忍，让不可言说之痛成为公共的视觉证据。",
  "你的身体是一座战场，允许它留下风暴的痕迹。",
  "这不是矫情，这是一场真切的生理型灾难。"
];

const BRUSHES = {
  twist: { label: "🌪️ 绞/拧", icon: "🌪️" },
  pierce: { label: "⚡️ 荆/刺", icon: "⚡️" },
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

// === 粒子引擎 (重构重力悬停、动态呼吸) ===
class PainParticle {
  constructor(p5, x, y, type, color, speed, heading, bodyMode) {
    this.p5 = p5;
    this.pos = p5.createVector(x, y);
    this.baseY = y; // 记录初始位置，用于重压的向下脉动
    this.type = type;
    this.color = color;
    this.life = 255;
    this.seed = p5.random(1000);
    this.bodyMode = bodyMode; // 记录画在哪一面

    // 【修改】：坠痛现在是动态粒子，永远呼吸
    this.isDynamic = (type === 'wave' || type === 'twist' || type === 'heavy');

   if (type === 'pierce') {
      // ⚡️ 【恢复】刺钻：极长主干 + 预生成倒刺
      let angle = heading + p5.random(-0.1, 0.1);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      this.vel.mult(p5.random(25, 45)); 
      this.size = p5.random(2, 5);
      
      this.thorns = [];
      let numThorns = p5.floor(p5.random(2, 5));
      for(let i=0; i<numThorns; i++) {
        this.thorns.push({
          distRatio: p5.random(0.3, 0.8),
          angleOffset: p5.random([p5.random(0.4, 0.8), p5.random(-0.8, -0.4)]),
          len: p5.random(8, 18) 
        });
      }
    }
    else if (type === 'heavy') {
      this.vel = p5.createVector(0, 0); // 速度为0，不掉落
      this.size = p5.random(8, 15);
    }
     else if (type === 'twist') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(15, 30); this.angle = p5.random(p5.TWO_PI);
    }
    else if (type === 'wave') {
      this.vel = p5.createVector(0,0); this.size = p5.random(5, 15); this.maxSize = p5.random(30, 60);
    }
    else if (type === 'scrape') {
      // 🔪 【恢复】刮撕：保持斜切，长线条
      let angle = p5.PI / 4 + p5.random(-0.15, 0.15);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      this.vel.mult(p5.random(15, 30));
      this.size = p5.random(2, 6);
    }
  }

  update(p5) {
    if (!this.isDynamic) this.pos.add(this.vel);

    if (this.type === 'heavy') {
      // 🪨 【核心重构】：利用正弦函数模拟“不断向下用力却掉不下去”的钝痛感
      // y 坐标在 baseY 和 baseY + size 之间来回抖动向下扯
      this.pos.y = this.baseY + p5.abs(p5.sin(p5.frameCount * 0.1 + this.seed) * this.size * 0.8);
    }
     if (this.type === 'twist') {
      this.angle += 0.08; this.size *= 0.98; if(this.size < 3) this.life = 0;
    }
    else if (this.type === 'wave') {
      this.pulseSize = this.size + p5.sin(p5.frameCount * 0.05 + this.seed) * (this.maxSize - this.size);
    }
    else if (this.type === 'scrape') {
      this.life -= 20; this.vel.mult(0); // 画完瞬间定住
    }
    else if (this.type === 'pierce') {
      this.life -= 25; this.vel.mult(0); // 瞬间扎入
    }
  }

  show(pg) {
    let p = pg || this.p5;

    if (this.isDynamic) {
      p.drawingContext.shadowBlur = 10;
      p.drawingContext.shadowColor = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
    } else { p.drawingContext.shadowBlur = 0; }

     if (this.type === 'pierce') {
      // ⚡️ 【恢复】主刺干 + 荆棘倒刺
      let endX = this.pos.x + this.vel.x; let endY = this.pos.y + this.vel.y;
      p.noStroke(); p.fill(255, 255, 255, 220); 
      p.beginShape();
      let perpAngle = this.vel.heading() + p.PI/2;
      let halfW = this.size / 2;
      p.vertex(this.pos.x + p.cos(perpAngle)*halfW, this.pos.y + p.sin(perpAngle)*halfW);
      p.vertex(this.pos.x - p.cos(perpAngle)*halfW, this.pos.y - p.sin(perpAngle)*halfW);
      p.vertex(endX, endY); 
      p.endShape(p.CLOSE);

      p.fill(this.color[0], 0, 0, 255); 
      this.thorns.forEach(thorn => {
        let rootX = this.pos.x + this.vel.x * thorn.distRatio;
        let rootY = this.pos.y + this.vel.y * thorn.distRatio;
        let thornEndX = rootX + p.cos(this.vel.heading() + thorn.angleOffset) * thorn.len;
        let thornEndY = rootY + p.sin(this.vel.heading() + thorn.angleOffset) * thorn.len;
        p.beginShape();
        p.vertex(rootX + p.cos(perpAngle)*1, rootY + p.sin(perpAngle)*1);
        p.vertex(rootX - p.cos(perpAngle)*1, rootY - p.sin(perpAngle)*1);
        p.vertex(thornEndX, thornEndY); 
        p.endShape(p.CLOSE);
      });
    }
    else if (this.type === 'heavy') {
      // 绘制沉重的、上尖下宽的动态水滴
      p.noStroke(); p.fill(this.color[0]*0.5, this.color[1]*0.5, this.color[2]*0.5, 200);
      p.beginShape();
      p.vertex(this.pos.x, this.pos.y - this.size * 0.8);
      p.bezierVertex(this.pos.x + this.size, this.pos.y, this.pos.x + this.size, this.pos.y + this.size * 1.5, this.pos.x, this.pos.y + this.size * 1.5);
      p.bezierVertex(this.pos.x - this.size, this.pos.y + this.size * 1.5, this.pos.x - this.size, this.pos.y, this.pos.x, this.pos.y - this.size * 0.8);
      p.endShape(p.CLOSE);
    }
    else if (this.type === 'scrape') {
      // 🔪 【恢复】狂暴刮撕：主线条 + 乱序纤维 + 三角血块
      let endX = this.pos.x + this.vel.x; let endY = this.pos.y + this.vel.y;
      p.stroke(this.color[0]*0.5, 0, 0, 255); p.strokeWeight(this.size); p.line(this.pos.x, this.pos.y, endX, endY);
      p.stroke(this.color[0], this.color[1]*0.3, this.color[2]*0.3, 180); p.strokeWeight(1);
      p.line(this.pos.x + p.random(-8,8), this.pos.y + p.random(-8,8), endX + p.random(-8,8), endY + p.random(-8,8));
      if (p.random(1) < 0.6) {
        p.noStroke(); p.fill(this.color[0], 0, 0, 220);
        let spX = endX + p.random(-6,6); let spY = endY + p.random(-6,6);
        p.triangle(spX, spY, spX+p.random(-4,4), spY+p.random(-4,4), spX+p.random(-4,4), spY+p.random(-4,4));
      }
    }
    else if (this.type === 'twist') {
      p.push(); p.translate(this.pos.x, this.pos.y); p.rotate(this.angle);
      p.noFill(); p.stroke(this.color[0], this.color[1], this.color[2], 100); p.strokeWeight(1.5);
      p.arc(0, 0, this.size * 2, this.size * 2, 0, p.PI * 1.5);
      p.stroke(this.color[0], this.color[1], this.color[2], 200); p.strokeWeight(1.5);
      for(let i=0; i<5; i++) p.line(0, 0, this.size * p.cos(i * p.TWO_PI/5), this.size * p.sin(i * p.TWO_PI/5));
      p.noStroke(); p.fill(this.color[0]*0.8, 0, 0, 220); p.ellipse(0, 0, this.size * 0.4); p.pop();
    }
    else if (this.type === 'wave') {
      p.noStroke(); p.fill(this.color[0], this.color[1], this.color[2], 10); p.ellipse(this.pos.x, this.pos.y, this.pulseSize, this.pulseSize);
    }
    p.drawingContext.shadowBlur = 0;
  }
  isDead() { return this.life < 0; }
}

function App() {
  const [page, setPage] = useState("splash");
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [splashOpacity, setSplashOpacity] = useState(1);

  const [activeBrush, setActiveBrush] = useState(null);
  const [activeColor, setActiveColor] = useState("crimson");
  const [identity, setIdentity] = useState("partner");
  const [userPrefs, setUserPrefs] = useState(["care"]);
  const [imgUrl, setImgUrl] = useState(null);
  const [bodyMode, setBodyMode] = useState('front');

  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('painscape_history') || '[]'));
  const [posts, setPosts] = useState([
    { id: 1, text: "痛得下不了床...", img: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200", tags: "#绞痛", likes: 128, group: "family" },
    { id: 2, text: "腰快断了，一直坠坠的。", img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200", tags: "#坠痛", likes: 85, group: "friend" }
  ]);

  const [postText, setPostText] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [viewingDiary, setViewingDiary] = useState(null);
  const [viewingPost, setViewingPost] = useState(null);
  const [communityFilter, setCommunityFilter] = useState("all");
  const [communityGroups, setCommunityGroups] = useState([{ id: 'family', name: '👩‍👧 家庭群' }, { id: 'friend', name: '👯‍♀️ 闺蜜群' }]);

  const brushCounts = useRef({ twist: 0, pierce: 0, heavy: 0, wave: 0, scrape: 0 });
  const staticParticles = useRef([]); const dynamicParticles = useRef([]);

  const p5Ref = useRef(null); const bgFrontRef = useRef(null); const bgBackRef = useRef(null);
  const pgFrontRef = useRef(null); const pgBackRef = useRef(null);

  const camRef = useRef({ x: 0, y: 0, zoom: 1.0 });
  const pressTimer = useRef(0); const isLongPressing = useRef(false);
  const undoStackRef = useRef([]); const redoStackRef = useRef([]); const hasSavedInitial = useRef(false);

  useEffect(() => {
    if (page === 'splash') {
      const timer1 = setTimeout(() => setSplashOpacity(0), 2500);
      const timer2 = setTimeout(() => setPage('onboarding'), 3500);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [page]);

  useEffect(() => {
    const pd = (e) => e.preventDefault(); document.addEventListener("contextmenu", pd);
    return () => document.removeEventListener("contextmenu", pd);
  }, []);

  const preload = (p5) => {
    bgFrontRef.current = p5.loadImage("body_front.png");
    bgBackRef.current = p5.loadImage("body_back.png");
  };

  const captureState = () => {
    if (!pgFrontRef.current || !pgBackRef.current) return null;
    return {
      imgFront: pgFrontRef.current.get(),
      imgBack: pgBackRef.current.get(),
      dynamic: [...dynamicParticles.current]
    };
  };

  const setup = (p5, canvasParentRef) => {
    p5Ref.current = p5;
    p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
    pgFrontRef.current = p5.createGraphics(window.innerWidth * 2, window.innerHeight * 2);
    pgBackRef.current = p5.createGraphics(window.innerWidth * 2, window.innerHeight * 2);
    camRef.current.x = 0; camRef.current.y = 0;
    if (!hasSavedInitial.current) { undoStackRef.current.push(captureState()); hasSavedInitial.current = true; }
  };

  const isSafeToDraw = (p5) => {
    if (page !== 'canvas' || bodyMode === 'none') return false;
    let currentY = p5.touches.length > 0 ? p5.touches[0].y : p5.mouseY;
    let currentX = p5.touches.length > 0 ? p5.touches[0].x : p5.mouseX;
    if (currentY < 100 || currentY > window.innerHeight - 150 || currentX > window.innerWidth - 80) return false;
    return true;
  };

  const mouseReleased = (p5) => {
    if (!isSafeToDraw(p5) || p5.mouseButton === p5.RIGHT) return;
    let state = captureState();
    if (state) { undoStackRef.current.push(state); if (undoStackRef.current.length > 20) undoStackRef.current.shift(); redoStackRef.current = []; }
  };

  const handleUndo = () => {
    if (undoStackRef.current.length > 1) {
      redoStackRef.current.push(captureState()); undoStackRef.current.pop();
      let prev = undoStackRef.current[undoStackRef.current.length - 1];
      pgFrontRef.current.clear(); pgFrontRef.current.image(prev.imgFront, 0, 0);
      pgBackRef.current.clear(); pgBackRef.current.image(prev.imgBack, 0, 0);
      dynamicParticles.current = [...prev.dynamic]; staticParticles.current = [];
    }
  };

  const handleRedo = () => {
    if (redoStackRef.current.length > 0) {
      undoStackRef.current.push(captureState()); let next = redoStackRef.current.pop();
      pgFrontRef.current.clear(); pgFrontRef.current.image(next.imgFront, 0, 0);
      pgBackRef.current.clear(); pgBackRef.current.image(next.imgBack, 0, 0);
      dynamicParticles.current = [...next.dynamic]; staticParticles.current = [];
    }
  };

  const handleClear = () => { undoStackRef.current.push(captureState()); redoStackRef.current = []; pgFrontRef.current.clear(); pgBackRef.current.clear(); dynamicParticles.current = []; staticParticles.current = []; };

  const mouseWheel = (p5, event) => {
    if (page !== 'canvas') return false;
    camRef.current.zoom = Math.max(0.5, Math.min(camRef.current.zoom + (event.delta > 0 ? -0.1 : 0.1), 3.0));
    return false;
  };

  const draw = (p5) => {
    p5.background(0);
    let { x, y, zoom } = camRef.current;
    let isInteracting = (p5.mouseIsPressed || p5.touches.length > 0) && isSafeToDraw(p5);

    let realX = (p5.mouseX - x) / zoom, realY = (p5.mouseY - y) / zoom;
    let realPx = (p5.pmouseX - x) / zoom, realPy = (p5.pmouseY - y) / zoom;
    let speed = p5.dist(realX, realY, realPx, realPy);
    let heading = (speed < 1) ? p5.PI / 2 : p5.atan2(realY - realPy, realX - realPx);

    if (!isInteracting) { pressTimer.current = 0; isLongPressing.current = false; }
    else { if (speed < 1) pressTimer.current++; else pressTimer.current = 0; if (pressTimer.current > 20) isLongPressing.current = true; }

    let isPanning = (activeBrush === null) || isLongPressing.current || p5.mouseButton === p5.RIGHT || p5.touches.length >= 2;
    let currentPg = bodyMode === 'back' ? pgBackRef.current : pgFrontRef.current;

    if (isInteracting) {
      if (isPanning) {
        camRef.current.x += p5.mouseX - p5.pmouseX; camRef.current.y += p5.mouseY - p5.pmouseY;
      } else if (activeBrush === 'eraser') {
        currentPg.erase(); currentPg.ellipse(realX, realY, 40 / zoom, 40 / zoom); currentPg.noErase();
        dynamicParticles.current = dynamicParticles.current.filter(p => p.bodyMode !== bodyMode || p5.dist(p.pos.x, p.pos.y, realX, realY) > 20);
      } else {
        brushCounts.current[activeBrush] += 1;
        let spawnRate = (activeBrush === 'wave' || activeBrush === 'twist' || activeBrush === 'heavy') ? 6 : 2;
        if (p5.frameCount % spawnRate === 0 || speed > 10) {
          let pObj = new PainParticle(p5, realX, realY, activeBrush, PALETTES[activeColor].color, speed, heading, bodyMode);
          if (pObj.isDynamic) {
            dynamicParticles.current.push(pObj);
            if (dynamicParticles.current.length > 500) dynamicParticles.current.shift();
          }
          else { staticParticles.current.push(pObj); }
        }
      }
    }

    for (let i = staticParticles.current.length - 1; i >= 0; i--) {
      let p = staticParticles.current[i];
      p.update(p5);
      let targetPg = p.bodyMode === 'back' ? pgBackRef.current : pgFrontRef.current;
      p.show(targetPg);
      if (p.isDead()) staticParticles.current.splice(i, 1);
    }

    p5.push(); p5.translate(x, y); p5.scale(zoom);

    let activeImg = bodyMode === 'front' ? bgFrontRef.current : (bodyMode === 'back' ? bgBackRef.current : null);
    if (activeImg) {
      p5.imageMode(p5.CENTER); p5.tint(255, 40);
      let imgScale = (p5.height * 0.8) / activeImg.height;
      p5.image(activeImg, p5.width / 2, p5.height / 2, activeImg.width * imgScale, activeImg.height * imgScale);
    }

    if (bodyMode !== 'none') {
      p5.noTint(); p5.imageMode(p5.CORNER); p5.image(currentPg, 0, 0);
    }

    for (let i = dynamicParticles.current.length - 1; i >= 0; i--) {
      let dp = dynamicParticles.current[i];
      dp.update(p5);
      if (dp.bodyMode === bodyMode) dp.show(p5);
      if (dp.isDead()) dynamicParticles.current.splice(i, 1);
    }
    p5.pop();
  };

  const handleFinish = async () => {
    if (p5Ref.current) {
      const url = document.querySelector("canvas").toDataURL("image/jpeg", 0.5);
      setImgUrl(url);

      const dominant = Object.keys(brushCounts.current).reduce((a, b) => brushCounts.current[a] > brushCounts.current[b] ? a : b) || 'twist';
      const content = generateContent(dominant);
      const newRecord = { 
        id: Date.now(), 
        date: new Date().toLocaleDateString(), 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        month: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`,
        img: url, 
        type: dominant, 
        content: content
      };

      const newHistory = [newRecord, ...history].slice(0, 20);
      setHistory(newHistory);
      try { localStorage.setItem('painscape_history', JSON.stringify(newHistory)); } catch (err) { setHistory([newRecord]); }

      setPage("result");
    }
  };

  const handleShare = async (content) => {
    try {
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d');
      cvs.width = 600; cvs.height = 900;
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, 600, 900);
      const img = new Image();
      img.src = imgUrl;
      await new Promise(resolve => { img.onload = resolve; });
      ctx.drawImage(img, 50, 50, 500, (500 / img.width) * img.height);
      ctx.fillStyle = '#1c1c1c'; 
      ctx.roundRect = ctx.roundRect || function (x, y, w, h, r) { this.beginPath(); this.moveTo(x + r, y); this.lineTo(x + w - r, y); this.quadraticCurveTo(x + w, y, x + w, y + r); this.lineTo(x + w, y + h - r); this.quadraticCurveTo(x + w, y + h, x + w - r, y + h); this.lineTo(x + r, y + h); this.quadraticCurveTo(x, y + h, x, y + h - r); this.lineTo(x, y + r); this.quadraticCurveTo(x, y, x + r, y); this.closePath(); };
      ctx.roundRect(50, 650, 500, 200, 20); ctx.fill();
      ctx.fillStyle = '#ff9800'; ctx.font = 'bold 24px sans-serif';
      ctx.fillText('不可见痛苦声明', 70, 700);
      ctx.fillStyle = '#ccc'; ctx.font = '16px sans-serif';
      const lines = content.action.replace(/🛑|🥣|🫂|❤️|复合指令：|偏好指令：/g, '').trim().split('\n');
      ctx.fillText(`我正在经历强烈的 ${content.pain}。`, 70, 740);
      ctx.fillText(`请求协助：${lines[0]}`, 70, 780);
      const finalUrl = cvs.toDataURL('image/jpeg');
      const blob = await (await fetch(finalUrl)).blob();
      const file = new File([blob], 'painscape_card.jpg', { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'PainScape 痛觉通感卡', files: [file] });
      } else {
        const link = document.createElement('a'); link.href = finalUrl; link.download = 'painscape_card.jpg'; link.click();
        alert("已为您生成带文本的复合分享卡片并下载。");
      }
    } catch (e) { console.log("分享被取消", e); }
  };

  const handlePublishPost = () => {
    if (!postText) return alert("写点什么吧~");
    const dominant = Object.keys(brushCounts.current).reduce((a, b) => brushCounts.current[a] > brushCounts.current[b] ? a : b) || 'twist';
    setPosts([{ id: Date.now(), text: postText, img: imgUrl, tags: `#${BRUSHES[dominant].label.split(" ")[1]}`, likes: 0, group: communityFilter }, ...posts]);
    setShowPostModal(false); setPostText(""); setPage("community");
  };

  const handleCreateGroup = () => {
    const name = prompt("请输入新群组名称（如：家庭群）：");
    if (name) {
      const newId = 'group_' + Date.now();
      setCommunityGroups([...communityGroups, { id: newId, name: `💬 ${name}` }]);
      setCommunityFilter(newId);
    }
  };

  const handleJoinGroup = () => {
    const code = prompt("请输入群组邀请码（演示模式任意输入）：");
    if (code) {
      const newId = 'group_' + Date.now();
      setCommunityGroups([...communityGroups, { id: newId, name: `👥 新群组` }]);
      alert("已加入群组！");
    }
  };

  const togglePref = (pref) => {
    if (pref === 'alone') setUserPrefs(['alone']);
    else {
      let next = userPrefs.filter(p => p !== 'alone');
      next = next.includes(pref) ? next.filter(p => p !== pref) : [...next, pref];
      setUserPrefs(next.length === 0 ? ['care'] : next);
    }
  };

  const generateContent = (overrideType) => {
    const dominant = overrideType || (Object.keys(brushCounts.current).reduce((a, b) => brushCounts.current[a] > brushCounts.current[b] ? a : b) || 'twist');
    let actionText = "";
    if (userPrefs.includes('alone')) actionText = "🛑 偏好指令：【需要绝对独处】\n1. 帮她倒一杯温水，备好布洛芬放在床头。\n2. 调暗房间光源，关门出去，给她绝对的个人空间。\n3. 不要每隔十分钟进房询问，这会加重烦躁。";
    else {
      let parts = [];
      if (userPrefs.includes('care')) parts.push("🥣 【物理照顾】\n1. 请主动冲热饮或准备热水袋。\n2. 帮她热敷腰骶部，或用热手掌捂在小腹上。\n3. 主动包揽家务，让她安心平躺。");
      if (userPrefs.includes('comfort')) parts.push("🫂 【情绪安抚】\n1. 请放下手机，安静地陪着她。\n2. 握着她的手，提供心理安全感。");
      actionText = parts.length > 1 ? "❤️ 复合指令：【需双重呵护】\n" + parts.join("\n\n") : parts[0];
    }
    const painName = { twist: "绞痛", pierce: "刺痛", heavy: "严重坠胀", wave: "弥漫性胀痛", scrape: "撕裂样锐痛" };
    const TEXTS = {
      twist: { analogy: "🌪️ 痛觉通感：想象把一条湿毛巾用力拧干，再拧一圈，并持续保持紧绷状态。", med: "主诉：腹部持续性绞痛，呈阵发性/螺旋状收缩。建议排查子宫痉挛。", selfCare: "💡 缓解建议：尝试【婴儿蜷缩式】侧卧，抱紧膝盖减缓肌肉紧绷。" },
      pierce: { analogy: "⚡️ 痛觉通感：想象不打麻药进行根管治疗，或者冰冷的针尖持续扎入腹部深处。", med: "主诉：锐痛（Sharp Pain），呈放射状，伴随间歇性神经刺痛。", selfCare: "💡 缓解建议：刺痛发作时极易引发冷汗，请立刻加盖毛毯保暖。尽量平躺避免牵扯。" },
      heavy: { analogy: "🪨 痛觉通感：想象在腹部绑了5公斤沙袋跑800米，每一步内脏都在受重力拉扯。", med: "主诉：下腹部严重坠胀感（Bearing-down），伴随盆腔充血与腰骶部酸痛。", selfCare: "💡 缓解建议：尝试【臀部垫高平躺】，拿两个枕头垫在臀部下，缓解盆腔充血。" },
      wave: { analogy: "🎈 痛觉通感：想象肚子里有个气球在不断充气，内脏处于极度的高压水肿状态。", med: "主诉：弥漫性胀痛，边界不清，伴随腹部水肿感。", selfCare: "💡 缓解建议：穿着极度宽松衣物，解开任何勒住腰部的松紧带，轻轻顺时针抚摸腹部。" },
      scrape: { analogy: "🔪 痛觉通感：像一颗未完全成熟的果实被强行剥皮，皮上带着丝丝缕缕的血肉被不断撕扯。", med: "主诉：强烈的撕裂样锐痛，伴随组织剥离感。", selfCare: "💡 缓解建议：这是最耗费体力的痛感，请直接服用布洛芬等抑制剂。听白噪音强行切断对痛觉的过度专注。" }
    };
    return { ...TEXTS[dominant], action: actionText, pain: painName[dominant] };
  };

  // 按月归类日记
  const groupedHistory = history.reduce((acc, item) => {
    if (!acc[item.month]) acc[item.month] = [];
    acc[item.month].push(item);
    return acc;
  }, {});

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1, touchAction: 'none' }}>
        <Sketch setup={setup} draw={draw} preload={preload} mouseWheel={mouseWheel} mouseReleased={mouseReleased} touchEnded={mouseReleased} />
      </div>

      {/* UI 容器：关键修复 - 只在 canvas 页面禁用 pointerEvents */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, pointerEvents: page === 'canvas' ? 'none' : 'auto' }}>

        {/* === Splash 开屏页 === */}
        {page === "splash" && (
          <div style={{ pointerEvents: 'auto', background: '#050505', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', boxSizing: 'border-box', opacity: splashOpacity, transition: 'opacity 1s ease-in-out' }}>
            <h1 style={{ color: '#fff', letterSpacing: '8px', marginBottom: '40px' }}>PainScape</h1>
            <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.8', textAlign: 'center', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{quote}</p>
          </div>
        )}

        {/* === Onboarding 页面 === */}
        {page === "onboarding" && (
          <div style={{ pointerEvents: 'auto', background: '#0a0a0a', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h1 style={{ color: '#fff', marginBottom: '5px', fontSize: '2rem' }}>PainScape</h1>
            <p style={{ color: '#aaa', marginBottom: '30px' }}>拒绝隐忍，让疼痛被看见</p>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', width: '100%', maxWidth: '320px', marginBottom: '20px', textAlign: 'left' }}>
              <p style={{ color: '#fff', fontSize: '13px', margin: '0 0 8px 0' }}><strong>🎨 快速指南：</strong></p>
              <p style={{ color: '#888', fontSize: '12px', margin: '4px 0' }}>• 滑动或点击：绘制痛觉质地</p>
              <p style={{ color: '#888', fontSize: '12px', margin: '4px 0' }}>• 长按 0.3 秒：拖拽移动画布</p>
              <p style={{ color: '#888', fontSize: '12px', margin: '4px 0' }}>• 滚轮/双指：放大缩小身体细节</p>
            </div>

            <div style={{ width: '100%', maxWidth: '320px', textAlign: 'left' }}>
              <label style={{ color: '#fff', marginBottom: '15px', display: 'block', fontSize: '1rem', fontWeight: 'bold' }}>当痛经发作时，你最需要伴侣/家人怎么做？</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['alone', 'care', 'comfort'].map((p, i) => (
                  <button key={p} onClick={() => togglePref(p)} style={{ padding: '15px', borderRadius: '12px', textAlign: 'left', background: '#1e1e1e', border: userPrefs.includes(p) ? '2px solid #d32f2f' : '1px solid #444', color: '#fff', cursor: 'pointer' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{['🛑 别管我，让我一个人待着', '🥣 我没力气，需要实际照顾', '🫂 我很脆弱，需要情绪陪伴'][i]}</div>
                  </button>
                ))}
              </div>
            </div>

            <button style={{ marginTop: '30px', width: '200px', padding: '14px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => { pgFrontRef.current?.clear(); pgBackRef.current?.clear(); dynamicParticles.current = []; staticParticles.current = []; setPage("canvas"); }}>开始绘制</button>

            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <button style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }} onClick={() => setPage("community")}>🌍 探索广场</button>
              <button style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }} onClick={() => setPage("history")}>📅 疼痛日记</button>
            </div>
          </div>
        )}

        {/* === Canvas 绘画页面 === */}
        {page === "canvas" && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '20px' }}>PainScape</span>
                <button style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '6px 18px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }} onClick={handleFinish}>生成</button>
              </div>

              <div style={{ display: 'flex', background: 'rgba(30,30,30,0.8)', borderRadius: '20px', padding: '4px', backdropFilter: 'blur(10px)' }}>
                <button style={{ padding: '6px 15px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: bodyMode === 'front' ? '#4caf50' : 'transparent', color: bodyMode === 'front' ? '#fff' : '#888' }} onClick={(e) => { e.stopPropagation(); setBodyMode('front'); }}>正面</button>
                <button style={{ padding: '6px 15px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: bodyMode === 'back' ? '#4caf50' : 'transparent', color: bodyMode === 'back' ? '#fff' : '#888' }} onClick={(e) => { e.stopPropagation(); setBodyMode('back'); }}>背面</button>
                <button style={{ padding: '6px 15px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: bodyMode === 'none' ? '#d32f2f' : 'transparent', color: bodyMode === 'none' ? '#fff' : '#888' }} onClick={(e) => { e.stopPropagation(); setBodyMode('none'); }}>沉浸盲画</button>
              </div>
            </div>

            <div style={{ pointerEvents: 'auto', position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid #444', borderRadius: '30px', width: '50px', height: '50px', fontSize: '24px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleUndo(); }}>↩️</button>
              <button style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid #444', borderRadius: '30px', width: '50px', height: '50px', fontSize: '24px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleRedo(); }}>↪️</button>
              <button style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid #444', borderRadius: '30px', width: '50px', height: '50px', fontSize: '24px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleClear(); }}>🗑️</button>
            </div>

            <div style={{ pointerEvents: 'auto', position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '380px', background: 'rgba(20,20,20,0.9)', padding: '15px', borderRadius: '24px', backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                {Object.keys(BRUSHES).map(k => (
                  <button key={k} style={{ flex: 1, background: activeBrush === k ? '#444' : 'transparent', border: 'none', color: activeBrush === k ? '#fff' : '#888', padding: '8px 0', borderRadius: '10px', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => setActiveBrush(activeBrush === k ? null : k)}>
                    <span style={{ fontSize: '20px', marginBottom: '4px' }}>{BRUSHES[k].icon}</span>
                    <span>{BRUSHES[k].label.split(" ")[1]}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                {Object.keys(PALETTES).map(k => (
                  <div key={k} style={{ width: '30px', height: '30px', borderRadius: '50%', border: activeColor === k ? '2px solid #fff' : '2px solid #444', background: `rgb(${PALETTES[k].color.join(',')})`, cursor: 'pointer', transform: activeColor === k ? 'scale(1.2)' : 'none' }} onClick={() => setActiveColor(k)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === Result 结果页面 === */}
        {page === "result" && (() => {
          const content = generateContent();
          return (
            <div style={{ pointerEvents: 'auto', position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 20, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)', padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

              <img src={imgUrl} style={{ width: '60%', maxWidth: '250px', marginTop: '20px', borderRadius: '12px', border: '2px solid #444' }} alt="pain" />

              <div style={{ display: 'flex', gap: '10px', margin: '20px 0', width: '100%', maxWidth: '350px' }}>
                {['partner', 'work', 'doctor', 'self'].map(tab => (
                  <button key={tab} style={{ flex: 1, padding: '10px 0', background: identity === tab ? '#444' : 'rgba(30,30,30,0.8)', color: identity === tab ? '#fff' : '#888', border: '1px solid #444', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }} onClick={() => setIdentity(tab)}>
                    {{ partner: '伴侣', work: '请假', doctor: '医生', self: '自愈' }[tab]}
                  </button>
                ))}
              </div>

              <div style={{ background: 'rgba(28,28,28,0.9)', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '350px', border: '1px solid #444', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                {identity === 'partner' && (
                  <><h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>通感说明书</h3><p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>{content.analogy}</p><div style={{ marginTop: '15px', padding: '15px', background: 'rgba(211,47,47,0.1)', borderLeft: '3px solid #d32f2f', color: '#ffcdd2', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{content.action}</div></>
                )}
                {identity === 'work' && (
                  <><h3 style={{ color: '#ff9800', margin: '0 0 10px 0' }}>不可见痛苦声明</h3><p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>主管/HR 您好：<br />我今日突发严重原发性痛经（呈现强烈的<strong>{content.pain}</strong>），伴随体力透支，已无法维持正常专注度。</p><div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255,152,0,0.1)', borderLeft: '3px solid #ff9800', color: '#ffcc80', fontSize: '13px' }}><strong>💼 诉求：</strong><br />特申请今日居家休息。身体平复后第一时间处理工作，感谢批准。</div></>
                )}
                {identity === 'doctor' && (
                  <><h3 style={{ color: '#2196f3', margin: '0 0 10px 0' }}>医疗辅助报告</h3><p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>{content.med}</p><div style={{ marginTop: '15px', padding: '15px', background: 'rgba(33,150,243,0.1)', borderLeft: '3px solid #2196f3', color: '#90caf9', fontSize: '13px' }}><strong>📋 记录：</strong> 患者具身痛苦图谱已记录如背景所示。</div></>
                )}
                {identity === 'self' && (
                  <><h3 style={{ color: '#9c27b0', margin: '0 0 10px 0' }}>自愈与社群互助</h3><p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>亲爱的，你画出了你的风暴。现在，请允许自己休息。</p><div style={{ marginTop: '15px', padding: '15px', background: 'rgba(156,39,176,0.1)', borderLeft: '3px solid #9c27b0', color: '#e1bee7', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{content.selfCare}</div></>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '350px', marginTop: '30px', marginBottom: '40px' }}>
                <button style={{ flex: 2, padding: '14px', borderRadius: '20px', background: '#4caf50', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => handleShare(content)}>一键分享卡片</button>
                <button style={{ flex: 1.5, padding: '14px', borderRadius: '20px', background: '#2196f3', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setShowPostModal(true)}>发布到广场</button>
                <button style={{ flex: 1, padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', border: '1px solid #555', color: '#fff', cursor: 'pointer' }} onClick={() => { setPage("onboarding"); }}>返回主页</button>
              </div>
            </div>
          );
        })()}

        {/* === Community 广场页面 === */}
        {page === "community" && (
          <div style={{ pointerEvents: 'auto', background: '#0a0a0a', width: '100vw', minHeight: '100vh', overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', position: 'sticky', top: 0, background: '#0a0a0a', paddingBottom: '10px', zIndex: 5 }}>
              <h2 style={{ color: '#fff', margin: 0 }}>探索共鸣广场</h2>
              <button style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }} onClick={() => setPage('onboarding')}>关闭 ✕</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '15px' }}>
              <button style={{ background: communityFilter === 'all' ? '#d32f2f' : '#222', color: '#fff', border: 'none', padding: '6px 15px', borderRadius: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => setCommunityFilter('all')}>🌍 全部</button>
              {communityGroups.map(g => (
                <button key={g.id} style={{ background: communityFilter === g.id ? '#d32f2f' : '#222', color: '#fff', border: 'none', padding: '6px 15px', borderRadius: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => setCommunityFilter(g.id)}>{g.name}</button>
              ))}
              <button style={{ background: 'transparent', color: '#4caf50', border: '1px dashed #4caf50', padding: '6px 15px', borderRadius: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={handleCreateGroup}>+ 建群</button>
              <button style={{ background: 'transparent', color: '#2196f3', border: '1px dashed #2196f3', padding: '6px 15px', borderRadius: '15px', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={handleJoinGroup}>+ 加入</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {posts.filter(p => communityFilter === 'all' || p.group === communityFilter).map((post) => (
                <div key={post.id} onClick={() => setViewingPost(post)} style={{ background: '#1c1c1c', borderRadius: '12px', padding: '10px', border: '1px solid #333', cursor: 'pointer' }}>
                  <img src={post.img} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', background: '#000' }} alt="post" />
                  <p style={{ color: '#ddd', fontSize: '12px', margin: '8px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.text}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d32f2f', fontSize: '11px' }}>{post.tags}</span>
                    <span style={{ color: '#888', fontSize: '12px' }}>❤️ {post.likes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === History 历史页面（按月归类）=== */}
        {page === "history" && (
          <div style={{ pointerEvents: 'auto', background: '#0a0a0a', width: '100vw', minHeight: '100vh', overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'sticky', top: 0, background: '#0a0a0a', paddingBottom: '10px', zIndex: 5 }}>
              <h2 style={{ color: '#fff', margin: 0 }}>我的疼痛档案</h2>
              <button style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }} onClick={() => setPage('onboarding')}>关闭 ✕</button>
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', marginTop: '100px' }}>暂无记录，去画下你的第一张痛觉图吧。</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {Object.entries(groupedHistory).sort((a, b) => b[0].localeCompare(a[0])).map(([month, records]) => (
                  <div key={month}>
                    <h3 style={{ color: '#d32f2f', fontSize: '16px', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>{month}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {records.sort((a, b) => b.id - a.id).map((record) => (
                        <div key={record.id} onClick={() => setViewingDiary(record)} style={{ display: 'flex', alignItems: 'center', background: '#1c1c1c', padding: '15px', borderRadius: '12px', border: '1px solid #333', cursor: 'pointer' }}>
                          <img src={record.img} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', background: '#000' }} alt="record" />
                          <div style={{ marginLeft: '15px', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '15px' }}>{record.date}</div>
                              <div style={{ color: '#888', fontSize: '12px' }}>{record.time}</div>
                            </div>
                            <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>{BRUSHES[record.type]?.label || '未知'} 主导</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === 弹窗层 === */}
      {viewingDiary && (
        <div style={{ position: 'fixed', zIndex: 500, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }} onClick={() => setViewingDiary(null)}>
          <img src={viewingDiary.img} style={{ width: '100%', maxWidth: '350px', borderRadius: '12px', border: '1px solid #444' }} alt="diary" />
          <h3 style={{ color: '#fff', marginTop: '20px' }}>{viewingDiary.date} {viewingDiary.time}</h3>
          <div style={{ background: 'rgba(28,28,28,0.9)', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '350px', marginTop: '10px' }}>
            <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>{viewingDiary.content?.analogy || '暂无描述'}</p>
            <p style={{ color: '#4caf50', fontSize: '13px', marginTop: '10px' }}>{viewingDiary.content?.selfCare}</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
            <button style={{ padding: '12px 24px', borderRadius: '25px', background: '#4caf50', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleShare(viewingDiary.content); }}>分享此记录</button>
            <button style={{ padding: '12px 24px', borderRadius: '25px', background: 'rgba(255,255,255,0.1)', border: '1px solid #555', color: '#fff', cursor: 'pointer' }} onClick={() => setViewingDiary(null)}>关闭</button>
          </div>
        </div>
      )}

      {viewingPost && (
        <div style={{ position: 'fixed', zIndex: 500, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }} onClick={() => setViewingPost(null)}>
          <img src={viewingPost.img} style={{ width: '100%', maxWidth: '350px', borderRadius: '12px', border: '1px solid #444' }} alt="post" />
          <p style={{ color: '#fff', fontSize: '16px', margin: '20px 0', textAlign: 'left', width: '100%', maxWidth: '350px', lineHeight: '1.6' }}>{viewingPost.text}</p>
          <div style={{ display: 'flex', gap: '15px', width: '100%', maxWidth: '350px' }}>
            <button style={{ flex: 1, padding: '14px', borderRadius: '25px', background: '#d32f2f', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); alert('已发送温暖的抱抱！'); }}>❤️ 抱抱</button>
            <button style={{ flex: 1, padding: '14px', borderRadius: '25px', background: '#2196f3', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); alert('已发送休息提醒！'); }}>🍵 多喝热水</button>
          </div>
          <button style={{ marginTop: '30px', padding: '12px 40px', borderRadius: '25px', background: 'rgba(255,255,255,0.1)', border: '1px solid #555', color: '#fff', cursor: 'pointer' }} onClick={() => setViewingPost(null)}>关闭</button>
        </div>
      )}

      {showPostModal && (
        <div style={{ position: 'fixed', zIndex: 500, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ background: '#1c1c1c', padding: '20px', borderRadius: '16px', width: '100%', maxWidth: '320px', border: '1px solid #444' }}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>分享你的经历</h3>
            {imgUrl && <img src={imgUrl} style={{ width: '100%', borderRadius: '8px', marginBottom: '15px' }} alt="preview" />}
            <textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="写点什么，或者吐槽一下这该死的痛经..." style={{ width: '100%', height: '80px', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', padding: '10px', boxSizing: 'border-box', marginBottom: '15px' }}></textarea>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ flex: 1, padding: '10px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setShowPostModal(false)}>取消</button>
              <button style={{ flex: 1, padding: '10px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }} onClick={handlePublishPost}>发布</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;