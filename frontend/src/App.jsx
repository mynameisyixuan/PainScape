import React, { useState, useRef, useEffect } from "react";
import Sketch from "react-p5";

// === 1. 语录与配置区 ===
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

// === 2. 粒子引擎 (修复此消彼长，重压与刺钻重构) ===
class PainParticle {
  constructor(p5, x, y, type, color, speed, heading) {
    this.p5 = p5; this.pos = p5.createVector(x, y);
    this.type = type; this.color = color;
    this.life = 255; this.seed = p5.random(1000);
    this.isDynamic = (type === 'wave' || type === 'twist');

    if (type === 'pierce') {
      // ⚡️ 【重构】刺钻：控制范围，变得更短促尖锐
      let angle = heading + p5.random(-0.1, 0.1);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      this.vel.mult(p5.random(12, 22)); // 长度减半，避免掩盖位置
      this.size = p5.random(1.5, 3.5);
      this.thorns = [];
      let numThorns = p5.floor(p5.random(2, 4));
      for(let i=0; i<numThorns; i++) {
        this.thorns.push({
          distRatio: p5.random(0.2, 0.8),
          angleOffset: p5.random([p5.random(0.4, 0.7), p5.random(-0.7, -0.4)]),
          len: p5.random(4, 10) // 倒刺变短
        });
      }
    }
    else if (type === 'heavy') {
      // 🪨 【重构】坠/压：沉重、钝角的铁块/秤砣感
      this.vel = p5.createVector(p5.random(-0.05, 0.05), p5.random(1.0, 2.5)); // 初始下坠速度
      this.size = p5.random(6, 12); // 控制单体大小
    }
    else if (type === 'twist') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(15, 30); this.angle = p5.random(p5.TWO_PI);
    }
    else if (type === 'wave') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(5, 15); this.maxSize = p5.random(30, 60);
    }
    else if (type === 'scrape') {
      let angle = p5.PI / 4 + p5.random(-0.15, 0.15);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      this.vel.mult(p5.random(15, 30)); this.size = p5.random(2, 6);
    }
  }

  update(p5) {
    if (this.type === 'heavy') {
      this.pos.add(this.vel);
      this.life -= 10;
      this.vel.y += 1.2; // 极大的重力加速度，使其瞬间坠落并停滞
      this.vel.x *= 0.2;
    } else {
      this.pos.add(this.vel);
    }

    if (this.type === 'twist') {
      this.angle += 0.08; this.size *= 0.98; if(this.size < 3) this.life = 0;
    }
    else if (this.type === 'wave') {
      this.pulseSize = this.size + p5.sin(p5.frameCount * 0.05 + this.seed) * (this.maxSize - this.size);
    }
    else if (this.type === 'scrape') {
      this.life -= 15; this.vel.mult(0.85);
    }
    else if (this.type === 'pierce') {
      this.life -= 25; this.vel.mult(0);
    }
  }

  show(pg) {
    let p = pg || this.p5;

    if (this.type === 'wave' || this.type === 'twist') {
      p.drawingContext.shadowBlur = 10;
      p.drawingContext.shadowColor = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
    } else { p.drawingContext.shadowBlur = 0; }

    if (this.type === 'pierce') {
      let endX = this.pos.x + this.vel.x; let endY = this.pos.y + this.vel.y;
      p.noStroke(); p.fill(255, 255, 255, 220); p.beginShape();
      let perpAngle = this.vel.heading() + p.PI/2; let halfW = this.size / 2;
      p.vertex(this.pos.x + p.cos(perpAngle)*halfW, this.pos.y + p.sin(perpAngle)*halfW);
      p.vertex(this.pos.x - p.cos(perpAngle)*halfW, this.pos.y - p.sin(perpAngle)*halfW);
      p.vertex(endX, endY); p.endShape(p.CLOSE);

      p.fill(this.color[0], 0, 0, 255);
      this.thorns.forEach(thorn => {
        let rootX = this.pos.x + this.vel.x * thorn.distRatio; let rootY = this.pos.y + this.vel.y * thorn.distRatio;
        let thornEndX = rootX + p.cos(this.vel.heading() + thorn.angleOffset) * thorn.len;
        let thornEndY = rootY + p.sin(this.vel.heading() + thorn.angleOffset) * thorn.len;
        p.beginShape(); p.vertex(rootX + p.cos(perpAngle)*1, rootY + p.sin(perpAngle)*1); p.vertex(rootX - p.cos(perpAngle)*1, rootY - p.sin(perpAngle)*1); p.vertex(thornEndX, thornEndY); p.endShape(p.CLOSE);
      });
    }
    else if (this.type === 'heavy') {
      // 🪨 【重构视觉】：画一个沉重、钝角的石块
      p.noStroke(); p.fill(this.color[0]*0.4, this.color[1]*0.4, this.color[2]*0.4, 220);
      p.beginShape();
      p.vertex(this.pos.x - this.size*0.8, this.pos.y); // 左上
      p.vertex(this.pos.x + this.size*0.8, this.pos.y); // 右上
      p.vertex(this.pos.x + this.size*1.5, this.pos.y + this.size*2.5 + p.random(-2,2)); // 右下（底部宽大且参差）
      p.vertex(this.pos.x - this.size*1.5, this.pos.y + this.size*2.5 + p.random(-2,2)); // 左下
      p.endShape(p.CLOSE);
      // 中心加深阴影，增加重量感
      p.fill(0, 0, 0, 150);
      p.ellipse(this.pos.x, this.pos.y + this.size, this.size*1.5, this.size*1.5);
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
      p.fill(this.color[0], this.color[1], this.color[2], 25); p.ellipse(this.pos.x, this.pos.y, this.pulseSize * 0.5, this.pulseSize * 0.5);
    }
    else if (this.type === 'scrape') {
      let endX = this.pos.x + this.vel.x; let endY = this.pos.y + this.vel.y;
      p.stroke(this.color[0]*0.5, 0, 0, 255); p.strokeWeight(this.size); p.line(this.pos.x, this.pos.y, endX, endY);
      p.stroke(this.color[0], this.color[1]*0.3, this.color[2]*0.3, 180); p.strokeWeight(1);
      p.line(this.pos.x + p.random(-8,8), this.pos.y + p.random(-8,8), endX + p.random(-8,8), endY + p.random(-8,8));
      p.line(this.pos.x + p.random(-4,4), this.pos.y + p.random(-4,4), endX + p.random(-4,4), endY + p.random(-4,4));
      if (p.random(1) < 0.6) {
        p.noStroke(); p.fill(this.color[0], 0, 0, 220);
        let spX = endX + p.random(-10, 10); let spY = endY + p.random(-10, 10);
        p.triangle(spX, spY, spX+p.random(-4,4), spY+p.random(-4,4), spX+p.random(-4,4), spY+p.random(-4,4));
      }
    }
    p.drawingContext.shadowBlur = 0;
  }
  isDead() { return this.life < 0; }
}

function App() {
  // === 【新增】开屏动画逻辑 ===
  const [page, setPage] = useState("splash"); // 初始进入 splash
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [splashOpacity, setSplashOpacity] = useState(1);

  const [activeBrush, setActiveBrush] = useState(null);
  const [activeColor, setActiveColor] = useState("crimson");
  const [identity, setIdentity] = useState("partner");
  const [userPrefs, setUserPrefs] = useState(["care"]);
  const [imgUrl, setImgUrl] = useState(null);
  const [bodyMode, setBodyMode] = useState('front');

  // ... (保留 history, posts, 以及弹窗 state) ...
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('painscape_history') || '[]'));
  const [posts, setPosts] = useState([
    { id: 1, text: "痛得下不了床...", img: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200", tags: "#绞痛", likes: 128 },
    { id: 2, text: "腰快断了...", img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200", tags: "#坠痛", likes: 85 }
  ]);
  const [postText, setPostText] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [viewingDiary, setViewingDiary] = useState(null);
  const [viewingPost, setViewingPost] = useState(null);
  const [communityFilter, setCommunityFilter] = useState("all");

  const brushCounts = useRef({ twist: 0, pierce: 0, heavy: 0, wave: 0, scrape: 0 });
  const staticParticles = useRef([]); const dynamicParticles = useRef([]);
  const p5Ref = useRef(null); const bgFrontRef = useRef(null); const bgBackRef = useRef(null);
  const pgRef = useRef(null);
  // 【修复】背景居中：x, y 初始化为 0，利用 imageMode(CENTER) 自然居中
  const camRef = useRef({ x: 0, y: 0, zoom: 1.0 });
  const pressTimer = useRef(0); const isLongPressing = useRef(false);
  const undoStackRef = useRef([]); const redoStackRef = useRef([]); const hasSavedInitial = useRef(false);

  // 【新增】开屏倒计时
  useEffect(() => {
    if (page === 'splash') {
      const timer1 = setTimeout(() => setSplashOpacity(0), 3000); // 3秒后开始淡出
      const timer2 = setTimeout(() => setPage('onboarding'), 4000); // 4秒后切换页面
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
    if (!pgRef.current) return null;
    return { img: pgRef.current.get(), dynamic: [...dynamicParticles.current] };
  };

  const setup = (p5, canvasParentRef) => {
    p5Ref.current = p5;
    p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
    pgRef.current = p5.createGraphics(window.innerWidth * 2, window.innerHeight * 2);
    // 重置坐标为0，保证背景居中
    camRef.current.x = 0; camRef.current.y = 0;
    if(!hasSavedInitial.current) { undoStackRef.current.push(captureState()); hasSavedInitial.current = true; }
  };

  const isSafeToDraw = (p5) => {
    if (page !== 'canvas') return false;
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
      pgRef.current.clear(); pgRef.current.image(prev.img, 0, 0);
      dynamicParticles.current = [...prev.dynamic]; staticParticles.current = [];
    }
  };

  const handleRedo = () => {
    if (redoStackRef.current.length > 0) {
      undoStackRef.current.push(captureState()); let next = redoStackRef.current.pop();
      pgRef.current.clear(); pgRef.current.image(next.img, 0, 0);
      dynamicParticles.current = [...next.dynamic]; staticParticles.current = [];
    }
  };

  const handleClear = () => { undoStackRef.current.push(captureState()); redoStackRef.current = []; pgRef.current.clear(); dynamicParticles.current = []; staticParticles.current = []; };

  const mouseWheel = (p5, event) => {
    if(page !== 'canvas') return false;
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

    if (isInteracting) {
      if (isPanning) {
        camRef.current.x += p5.mouseX - p5.pmouseX; camRef.current.y += p5.mouseY - p5.pmouseY;
      } else if (activeBrush === 'eraser') {
        pgRef.current.erase(); pgRef.current.ellipse(realX, realY, 40 / zoom, 40 / zoom); pgRef.current.noErase();
        dynamicParticles.current = dynamicParticles.current.filter(p => p5.dist(p.pos.x, p.pos.y, realX, realY) > 20);
      } else {
        brushCounts.current[activeBrush] += 1;
        // 【修复】降低动态粒子生成频率，防止达到上限被清空
        let spawnRate = (activeBrush === 'wave' || activeBrush === 'twist') ? 6 : 2;
        if (p5.frameCount % spawnRate === 0 || speed > 10) {
          let pObj = new PainParticle(p5, realX, realY, activeBrush, PALETTES[activeColor].color, speed, heading);
          if (pObj.isDynamic) {
            dynamicParticles.current.push(pObj);
            // 【修复】将上限扩大到 500，避免“此消彼长”当橡皮擦的 BUG
            if (dynamicParticles.current.length > 500) dynamicParticles.current.shift();
          }
          else { staticParticles.current.push(pObj); }
        }
      }
    }

    let pg = pgRef.current;
    for (let i = staticParticles.current.length - 1; i >= 0; i--) {
      let p = staticParticles.current[i]; p.update(p5); p.show(pg);
      if (p.isDead()) staticParticles.current.splice(i, 1);
    }

    p5.push(); p5.translate(x, y); p5.scale(zoom);

    let activeImg = bodyMode === 'front' ? bgFrontRef.current : (bodyMode === 'back' ? bgBackRef.current : null);
    if (activeImg) {
      p5.imageMode(p5.CENTER); p5.tint(255, 40);
      // 根据屏幕高度动态计算完美比例，保证图片在屏幕正中间
      let imgScale = (p5.height * 0.8) / activeImg.height;
      p5.image(activeImg, p5.width/2, p5.height/2, activeImg.width * imgScale, activeImg.height * imgScale);
    }

    p5.noTint(); p5.imageMode(p5.CORNER); p5.image(pg, 0, 0);

    for (let i = dynamicParticles.current.length - 1; i >= 0; i--) {
      let dp = dynamicParticles.current[i]; dp.update(p5); dp.show(p5);
      if (dp.isDead()) dynamicParticles.current.splice(i, 1);
    }
    p5.pop();
  };

  // 【异常捕获升级版：完美修复生成崩溃 Bug】
  const handleFinish = async () => {
    if (p5Ref.current) {
      const canvas = document.querySelector("canvas");
      // 为了省空间，存为压缩画质的 JPEG 格式，或者只存低清缩略图
      const url = canvas.toDataURL("image/jpeg", 0.5);
      setImgUrl(url);

      const dominant = getDominantPain();
      const newRecord = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        img: url, // 为了本地测试，依然存图片，但是存压缩版
        type: dominant
      };

      // 【核心修复】：只保留最近的 5 条历史记录，防止 localStorage 被撑爆
      const newHistory = [newRecord, ...history].slice(0, 5);
      setHistory(newHistory);

      try {
        localStorage.setItem('painscape_history', JSON.stringify(newHistory));
      } catch (err) {
        console.warn("历史记录已满，清理旧数据...", err);
        // 如果还满，强行清空重置
        setHistory([newRecord]);
        localStorage.setItem('painscape_history', JSON.stringify([newRecord]));
      }

      // ====== 向 Python 后端发送请求 ======
      try {
        const response = await fetch("http://localhost:8000/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json"},
          body: JSON.stringify({
            dominantPain: dominant,
            userPref: userPrefs.join(","),
            painScore: 85
          })
        });
        const aiResult = await response.json();
        console.log("✅ 后端返回成功！数据如下：", aiResult);
      } catch (error) {
        console.error("❌ 后端请求失败:", error);
      }

      setPage("result");
    }
  };

  const handleShare = async (content) => {
    try {
      const blob = await (await fetch(imgUrl)).blob();
      const file = new File([blob], 'painscape.png', { type: 'image/png' });
      const cleanAction = content.action.replace(/🛑|🥣|🫂|❤️|复合指令：|偏好指令：/g, '').trim().split('\n')[0];
      const shareText = `【不可见痛苦声明】\n我正在经历强烈的${content.pain}。\n状态：${content.analogy}\n\n请求：${cleanAction}\n—— 来自 PainScape 生成`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'PainScape 痛觉通感卡', text: shareText, files: [file] });
      } else {
        const link = document.createElement('a');
        link.href = imgUrl; link.download = 'painscape.png'; link.click();
        alert("已为您下载图片。您可以搭配截图中的文字发送给朋友/主管。");
      }
    } catch(e) { console.log(e); }
  };

  const handlePublishPost = () => {
    if(!postText) return alert("写点什么吧~");
    const dominant = getDominantPain();
    const newPost = {
      id: Date.now(), text: postText, img: imgUrl, tags: `#${painName[dominant]} #记录`, likes: 0
    };
    setPosts([newPost, ...posts]);
    setShowPostModal(false); setPostText(""); setPage("community");
  };

  const togglePref = (pref) => {
    if (pref === 'alone') {
      setUserPrefs(['alone']);
    } else {
      let newPrefs = userPrefs.filter(p => p !== 'alone');
      if (newPrefs.includes(pref)) {
        newPrefs = newPrefs.filter(p => p !== pref);
      } else {
        newPrefs.push(pref);
      }
      if (newPrefs.length === 0) newPrefs = ['care'];
      setUserPrefs(newPrefs);
    }
  };

  const getDominantPain = () => {
    const counts = brushCounts.current;
    const maxVal = Math.max(...Object.values(counts));
    return maxVal > 0 ? Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) : 'twist';
  };

  const painName = { twist: "绞痛", pierce: "刺痛", heavy: "严重坠胀", wave: "弥漫性胀痛", scrape: "撕裂样锐痛" };

  const generateContent = () => {
    const dominant = getDominantPain();

    let actionText = "";
    if (userPrefs.includes('alone')) {
      actionText = "🛑 偏好指令：【需要绝对独处】\n1. 帮她倒一杯温水，备好布洛芬放在床头。\n2. 调暗房间光源，关门出去，给她绝对的个人空间。\n3. 不要每隔十分钟进房询问，这会加重烦躁。";
    } else {
      let parts = [];
      if (userPrefs.includes('care')) {
        parts.push("🥣 【物理照顾】\n1. 她体力透支，请主动冲热饮或准备热水袋。\n2. 帮她热敷腰骶部，或用热手掌捂在小腹上。\n3. 请主动包揽今日家务，让她安心平躺。");
      }
      if (userPrefs.includes('comfort')) {
        parts.push("🫂 【情绪安抚】\n1. 请放下手机，在床边安静地陪着她。\n2. 握着她的手，或者抱抱她，提供心理安全感。\n3. 允许她的情绪波动，给予温柔的言语支持。");
      }

      if (parts.length > 1) {
        actionText = "❤️ 复合指令：【需双重呵护】\n" + parts.join("\n\n");
      } else {
        actionText = (userPrefs.includes('care') ? "🥣 偏好指令：" : "🫂 偏好指令：") + parts[0];
      }
    }

    const TEXTS = {
      twist: {
        analogy: "🌪️ 痛觉通感：想象把一条湿毛巾用力拧干，再拧一圈，并持续保持这个紧绷状态。",
        med: "主诉：腹部持续性绞痛，呈阵发性/螺旋状收缩。建议排查：子宫痉挛或腺肌症倾向。",
        selfCare: "💡 缓解建议（来自社群）：\n1. 尝试【婴儿蜷缩式】侧卧，抱紧膝盖减缓肌肉紧绷。\n2. 用暖宝宝贴在【八髎穴】(后腰尾骨处) 缓解神经放射痛。\n3. 避免剧烈呼吸，尝试腹式呼吸缓慢吐气。"
      },
      pierce: {
        analogy: "⚡️ 痛觉通感：想象不打麻药进行根管治疗，或者冰冷的针尖持续扎入腹部深处。",
        med: "主诉：锐痛（Sharp Pain），呈放射状，伴随间歇性神经刺痛。建议排查：子宫内膜异位结节。",
        selfCare: "💡 缓解建议（来自社群）：\n1. 刺痛发作时极易引发冷汗，请立刻加盖毛毯保暖。\n2. 若常规止痛药无效，请考虑就医咨询是否存在内膜异位。\n3. 尽量平躺，避免牵扯盆腔周围韧带。"
      },
      heavy: {
        analogy: "🪨 痛觉通感：想象在腹部绑了5公斤沙袋跑800米，每一步内脏都在受重力拉扯。",
        med: "主诉：下腹部严重坠胀感（Bearing-down），伴随盆腔充血与腰骶部酸痛。建议：盆腔超声检查盆腔淤血综合征。",
        selfCare: "💡 缓解建议（来自社群）：\n1. 尝试【臀部垫高平躺】，拿两个枕头垫在臀部下，通过重力倒流缓解盆腔充血。\n2. 绝对避免久站或下蹲！\n3. 饮用温热生姜茶促进局部血液循环。"
      },
      wave: {
        analogy: "🎈 痛觉通感：想象肚子里有个气球在不断充气，内脏处于极度的高压水肿状态。",
        med: "主诉：弥漫性胀痛，边界不清，伴随腹部及肢体水肿感。建议排查：黄体酮不足或经前水肿滞留。",
        selfCare: "💡 缓解建议（来自社群）：\n1. 穿着极度宽松的衣物，解开任何勒住腰部的松紧带。\n2. 此时肠胃极其脆弱，避免任何冷饮或甜食发酵产气。\n3. 轻轻顺时针抚摸腹部，不要用力按压。"
      },
      scrape: {
        analogy: "🔪 痛觉通感：像一颗未完全成熟的果实被强行剥皮，皮上还带着丝丝缕缕的血肉被不断撕扯。",
        med: "主诉：强烈的撕裂样锐痛，伴随组织剥离感。考虑：子宫内膜大块脱落引起的剧烈排异性宫缩。",
        selfCare: "💡 缓解建议（来自社群）：\n1. 这是最耗费体力的痛感，请直接服用布洛芬等前列腺素抑制剂（遵医嘱）。\n2. 保持绝对卧床，备好温热糖水补充体力防虚脱。\n3. 听白噪音或冥想音频，强行切断对痛觉的过度专注。"
      }
    };

    return { ...TEXTS[dominant], action: actionText, pain: painName[dominant] };
  };

  // ================= 页面组件渲染 =================

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1, touchAction: 'none' }}>
        <Sketch setup={setup} draw={draw} preload={preload} mouseWheel={mouseWheel} mouseReleased={mouseReleased} touchEnded={mouseReleased}/>
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, pointerEvents: 'none' }}>

        {/* === 新增：Splash 开屏页 === */}
        {page === "splash" && (
          <div style={{pointerEvents:'auto', background:'#050505', width:'100vw', height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px', boxSizing:'border-box', opacity: splashOpacity, transition: 'opacity 1s ease-in-out'}}>
            <h1 style={{color:'#fff', letterSpacing:'8px', marginBottom:'40px'}}>PainScape</h1>
            <p style={{color:'#aaa', fontSize:'14px', lineHeight:'1.8', textAlign:'center', fontStyle:'italic', whiteSpace:'pre-wrap'}}>{quote}</p>
          </div>
        )}

        {/* === Onboarding 页面 === */}
        {page === "onboarding" && (
           <div className="onboarding-container" style={{pointerEvents:'auto', background:'#0a0a0a', width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
              <h1 style={{color:'#fff', marginBottom:'5px', fontSize:'2rem'}}>PainScape</h1>
              <p style={{color:'#aaa', marginBottom:'30px'}}>拒绝隐忍，让疼痛被看见</p>

              {/* === 【新增】简单使用指南 === */}
              <div style={{background:'rgba(255,255,255,0.05)', padding:'15px', borderRadius:'12px', width:'100%', maxWidth:'320px', marginBottom:'20px', textAlign:'left'}}>
                <p style={{color:'#fff', fontSize:'13px', margin:'0 0 8px 0'}}><strong>🎨 快速指南：</strong></p>
                <p style={{color:'#888', fontSize:'12px', margin:'4px 0'}}>• 滑动或点击：绘制痛觉质地</p>
                <p style={{color:'#888', fontSize:'12px', margin:'4px 0'}}>• 长按 0.3 秒：拖拽移动画布</p>
                <p style={{color:'#888', fontSize:'12px', margin:'4px 0'}}>• 滚轮/双指：放大缩小身体细节</p>
              </div>

              <div style={{width:'100%', maxWidth:'320px', textAlign:'left'}}>
                <label style={{color:'#fff', marginBottom:'15px', display:'block', fontSize:'1rem', fontWeight:'bold'}}>当痛经发作时，你最需要伴侣/家人怎么做？</label>
                <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                  {['alone', 'care', 'comfort'].map((p, i) => (
                    <button key={p} onClick={()=>togglePref(p)} style={{padding:'15px', borderRadius:'12px', textAlign:'left', background:'#1e1e1e', border: userPrefs.includes(p)?'2px solid #d32f2f':'1px solid #444', color:'#fff', cursor:'pointer'}}>
                      <div style={{fontSize:'14px', fontWeight:'bold'}}>{['🛑 别管我，让我一个人待着', '🥣 我没力气，需要实际照顾', '🫂 我很脆弱，需要情绪陪伴'][i]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button style={{marginTop:'30px', width:'200px', padding:'14px', background:'#d32f2f', color:'#fff', border:'none', borderRadius:'25px', fontWeight:'bold', cursor:'pointer'}}
                onClick={() => { pgRef.current.clear(); dynamicParticles.current=[]; staticParticles.current=[]; setPage("canvas"); }}>开始绘制</button>

              <div style={{display:'flex', gap:'15px', marginTop:'20px'}}>
                <button style={{background:'transparent', border:'1px solid #444', color:'#888', padding:'8px 16px', borderRadius:'20px'}} onClick={() => setPage("community")}>🌍 探索广场</button>
                <button style={{background:'transparent', border:'1px solid #444', color:'#888', padding:'8px 16px', borderRadius:'20px'}} onClick={() => setPage("history")}>📅 疼痛日记</button>
              </div>
           </div>
        )}

      {page === "canvas" && (
        <div style={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', zIndex:10, pointerEvents:'none'}}>
          <div className="top-bar" style={{pointerEvents:'auto', display:'flex', flexDirection:'column', alignItems:'center', gap:'15px'}}>
            <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
              <span style={{color:'#fff', fontWeight:'bold', fontSize:'20px'}}>PainScape</span>
              <button style={{background:'#d32f2f', color:'#fff', border:'none', padding:'6px 18px', borderRadius:'20px', cursor:'pointer', fontWeight:'bold'}} onClick={handleFinish}>生成</button>
            </div>

            <div style={{display:'flex', background:'rgba(30,30,30,0.8)', borderRadius:'20px', padding:'4px', backdropFilter:'blur(10px)'}}>
              <button
                style={{padding:'6px 15px', borderRadius:'16px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'bold', background: bodyMode==='front'?'#4caf50':'transparent', color: bodyMode==='front'?'#fff':'#888'}}
                onClick={(e)=>{ e.stopPropagation(); setBodyMode('front'); }}>正面</button>
              <button
                style={{padding:'6px 15px', borderRadius:'16px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'bold', background: bodyMode==='back'?'#4caf50':'transparent', color: bodyMode==='back'?'#fff':'#888'}}
                onClick={(e)=>{ e.stopPropagation(); setBodyMode('back'); }}>背面</button>
              <button
                style={{padding:'6px 15px', borderRadius:'16px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'bold', background: bodyMode==='none'?'#d32f2f':'transparent', color: bodyMode==='none'?'#fff':'#888'}}
                onClick={(e)=>{ e.stopPropagation(); setBodyMode('none'); }}>沉浸盲画</button>
            </div>
          </div>

          <div className="side-tools" style={{pointerEvents:'auto'}}>
            <button className="side-btn" onClick={(e) => { e.stopPropagation(); handleUndo(); }}>↩️</button>
            <button className="side-btn" onClick={(e) => { e.stopPropagation(); handleRedo(); }}>↪️</button>
            <button className="side-btn" onClick={(e) => { e.stopPropagation(); handleClear(); }}>🗑️</button>
          </div>

          <div className="toolbar" style={{pointerEvents:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
              {Object.keys(BRUSHES).map(k => (
                <button key={k} style={{flex:1, background:activeBrush===k?'#444':'transparent', border:'none', color:activeBrush===k?'#fff':'#888', padding:'8px 0', borderRadius:'10px', fontSize:'12px', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer'}} onClick={() => setActiveBrush(activeBrush === k ? null : k)}>
                  <span style={{fontSize:'20px', marginBottom:'4px'}}>{BRUSHES[k].icon}</span>
                  <span>{BRUSHES[k].label.split(" ")[1]}</span>
                </button>
              ))}
            </div>
            <div style={{display:'flex', justifyContent:'center', gap:'20px'}}>
              {Object.keys(PALETTES).map(k => (
                <div key={k} style={{width:'30px', height:'30px', borderRadius:'50%', border:activeColor===k?'2px solid #fff':'2px solid #444', background:`rgb(${PALETTES[k].color.join(',')})`, cursor:'pointer', transform:activeColor===k?'scale(1.2)':'none'}} onClick={() => setActiveColor(k)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {page === "result" && (() => {
        const content = generateContent();
        return (
          <div className="result-screen" style={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', zIndex:20, background:'rgba(10,10,10,0.75)', backdropFilter:'blur(8px)', padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center'}}>

            <div style={{display:'flex', gap:'10px', margin:'40px 0 20px 0', width:'100%', maxWidth:'350px'}}>
              {['partner','work','doctor','self'].map(tab => (
                <button key={tab} style={{flex:1, padding:'10px 0', background:identity===tab?'#444':'rgba(30,30,30,0.8)', color:identity===tab?'#fff':'#888', border:'1px solid #444', borderRadius:'8px', fontSize:'13px'}} onClick={()=>setIdentity(tab)}>
                  {{partner:'伴侣', work:'请假', doctor:'医生', self:'自愈'}[tab]}
                </button>
              ))}
            </div>

            <div className="info-card" style={{background:'rgba(28,28,28,0.9)', padding:'20px', borderRadius:'12px', width:'100%', maxWidth:'350px', border:'1px solid #444', boxShadow:'0 10px 30px rgba(0,0,0,0.5)'}}>
              {identity === 'partner' && (
                <><h3 style={{color:'#fff', margin:'0 0 10px 0'}}>通感说明书</h3><p style={{color:'#ccc', fontSize:'14px', lineHeight:'1.5'}}>{content.analogy}</p><div style={{marginTop:'15px', padding:'15px', background:'rgba(211,47,47,0.1)', borderLeft:'3px solid #d32f2f', color:'#ffcdd2', fontSize:'13px', whiteSpace:'pre-wrap'}}>{content.action}</div></>
              )}
              {identity === 'work' && (
                <><h3 style={{color:'#ff9800', margin:'0 0 10px 0'}}>不可见痛苦声明</h3><p style={{color:'#ccc', fontSize:'14px', lineHeight:'1.5'}}>主管/HR 您好：<br/>我今日突发严重原发性痛经（呈现强烈的<strong>{content.pain}</strong>），伴随体力透支，已无法维持正常专注度。</p><div style={{marginTop:'15px', padding:'15px', background:'rgba(255,152,0,0.1)', borderLeft:'3px solid #ff9800', color:'#ffcc80', fontSize:'13px'}}><strong>💼 诉求：</strong><br/>特申请今日居家休息。身体平复后第一时间处理工作，感谢批准。</div></>
              )}
              {identity === 'doctor' && (
                <><h3 style={{color:'#2196f3', margin:'0 0 10px 0'}}>医疗辅助报告</h3><p style={{color:'#ccc', fontSize:'14px', lineHeight:'1.5'}}>{content.med}</p><div style={{marginTop:'15px', padding:'15px', background:'rgba(33,150,243,0.1)', borderLeft:'3px solid #2196f3', color:'#90caf9', fontSize:'13px'}}><strong>📋 记录：</strong> 患者具身痛苦图谱已记录如背景所示。</div></>
              )}
              {identity === 'self' && (
                <><h3 style={{color:'#9c27b0', margin:'0 0 10px 0'}}>自愈与社群互助</h3><p style={{color:'#ccc', fontSize:'14px', lineHeight:'1.5'}}>亲爱的，你画出了你的风暴。现在，请允许自己休息。</p><div style={{marginTop:'15px', padding:'15px', background:'rgba(156,39,176,0.1)', borderLeft:'3px solid #9c27b0', color:'#e1bee7', fontSize:'13px', whiteSpace:'pre-wrap'}}>{content.selfCare}</div></>
              )}
            </div>

            <div style={{display:'flex', gap:'10px', width:'100%', maxWidth:'350px', marginTop:'30px', marginBottom:'40px'}}>
              <button style={{flex:2, padding:'14px', borderRadius:'20px', background:'#4caf50', color:'#fff', border:'none', fontWeight:'bold', cursor:'pointer'}} onClick={() => handleShare(content)}>一键分享卡片</button>
              <button style={{flex:1.5, padding:'14px', borderRadius:'20px', background:'#2196f3', color:'#fff', border:'none', fontWeight:'bold', cursor:'pointer'}} onClick={() => setShowPostModal(true)}>发布到广场</button>
              <button style={{flex:1, padding:'14px', borderRadius:'20px', background:'rgba(255,255,255,0.1)', border:'1px solid #555', color:'#fff', cursor:'pointer'}} onClick={()=>{ setPage("onboarding"); }}>返回主页</button>
            </div>

            {showPostModal && (
              <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:100, display:'flex', justifyContent:'center', alignItems:'center', padding:'20px'}}>
                <div style={{background:'#1c1c1c', padding:'20px', borderRadius:'16px', width:'100%', maxWidth:'320px', border:'1px solid #444'}}>
                  <h3 style={{color:'#fff', marginTop:0}}>分享你的经历</h3>
                  {/* 如果截图失败，不显示破损图片 */}
                  {imgUrl && <img src={imgUrl} style={{width:'100%', borderRadius:'8px', marginBottom:'15px'}} alt="preview"/>}
                  <textarea value={postText} onChange={e=>setPostText(e.target.value)} placeholder="写点什么，或者吐槽一下这该死的痛经..." style={{width:'100%', height:'80px', background:'#111', color:'#fff', border:'1px solid #333', borderRadius:'8px', padding:'10px', boxSizing:'border-box', marginBottom:'15px'}}></textarea>
                  <div style={{display:'flex', gap:'10px'}}>
                    <button style={{flex:1, padding:'10px', background:'#333', color:'#fff', border:'none', borderRadius:'8px'}} onClick={()=>setShowPostModal(false)}>取消</button>
                    <button style={{flex:1, padding:'10px', background:'#2196f3', color:'#fff', border:'none', borderRadius:'8px', fontWeight:'bold'}} onClick={handlePublishPost}>发布</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {page === "community" && (
        <div style={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', zIndex:100, background:'#050505', overflowY:'auto', padding:'20px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', position:'sticky', top:0, background:'#050505', paddingBottom:'10px'}}>
            <h2 style={{color:'#fff', margin:0}}>探索共鸣广场</h2>
            <button style={{background:'transparent', color:'#888', border:'none', fontSize:'16px'}} onClick={() => setPage('onboarding')}>关闭 ✕</button>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
            {posts.map((post) => (
              <div key={post.id} style={{background:'#111', borderRadius:'12px', overflow:'hidden', border:'1px solid #222'}}>
                <div style={{width:'100%', height:'150px', backgroundImage:`url(${post.img})`, backgroundSize:'cover', backgroundPosition:'center'}}></div>
                <div style={{padding:'10px'}}>
                  <p style={{color:'#ddd', fontSize:'12px', margin:'0 0 8px 0', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{post.text}</p>
                  <div style={{color:'#d32f2f', fontSize:'10px', fontWeight:'bold', marginBottom:'8px'}}>{post.tags}</div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{color:'#888', fontSize:'12px'}}>❤️ {post.likes}</span>
                    <button style={{background:'rgba(255,255,255,0.1)', border:'1px solid #444', color:'#ccc', borderRadius:'15px', padding:'4px 12px', fontSize:'10px'}} onClick={(e)=>{ e.target.innerText='已抱抱'; e.target.style.color='#d32f2f'; }}>抱抱</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {page === "history" && (
        <div style={{position:'absolute', top:0, left:0, width:'100vw', height:'100vh', zIndex:100, background:'#0a0a0a', overflowY:'auto', padding:'20px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', position:'sticky', top:0, background:'#0a0a0a', paddingBottom:'10px'}}>
            <h2 style={{color:'#fff', margin:0}}>我的疼痛档案</h2>
            <button style={{background:'transparent', color:'#888', border:'none', fontSize:'16px'}} onClick={() => setPage('onboarding')}>关闭 ✕</button>
          </div>

          {history.length === 0 ? (
            <div style={{textAlign:'center', color:'#666', marginTop:'100px'}}>暂无记录，去画下你的第一张痛觉图吧。</div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              {history.map((record) => (
                <div key={record.id} style={{display:'flex', background:'#1a1a1a', borderRadius:'12px', padding:'10px', border:'1px solid #333', gap:'15px'}}>
                  <img src={record.img} style={{width:'80px', height:'80px', borderRadius:'8px', objectFit:'cover', background:'#000'}} alt="record"/>
                  <div style={{display:'flex', flexDirection:'column', justifyContent:'center'}}>
                    <div style={{color:'#fff', fontWeight:'bold', fontSize:'16px', marginBottom:'5px'}}>{record.date}</div>
                    <div style={{color:'#888', fontSize:'12px', marginBottom:'5px'}}>{record.time}</div>
                    <div style={{display:'inline-block', background:'rgba(211,47,47,0.15)', color:'#ffcdd2', padding:'4px 8px', borderRadius:'8px', fontSize:'10px', border:'1px solid #d32f2f', width:'fit-content'}}>
                      主导痛感: {BRUSHES[record.type]?.label || '未知'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
   </>
  );
}

export default App;