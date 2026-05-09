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
  wave: { label: "〰️ 胀/扩", icon: "〰️" },
  scrape: { label: "🔪 刮/撕", icon: "🔪" },
  eraser: { label: "🧽 橡皮", icon: "🧽" }
};
const PAIN_NAME_MAP = {
  twist: "绞痛",
  pierce: "刺痛",
  heavy: "坠痛",
  wave: "胀痛",
  scrape: "撕裂痛"
};
const PALETTES = {
  crimson: { color: [220, 20, 60], label: "🩸" },
  dark: { color: [180, 180, 180], label: "🌑" },
  purple: { color: [140, 50, 200], label: "🔮" },
  blue: { color: [80, 160, 220], label: "❄️" },
};
const EXAM_DATABASE = {
  "盆腔超声": {
    prep: "需在检查前 1 小时饮水 500-800ml，保持充盈膀胱（憋尿）。",
    purpose: "观察子宫形态、内膜厚度，排除肌瘤、腺肌症或卵巢囊肿。"
  },
  "经阴道超声": {
    prep: "检查前需排空尿液。如无性生活史请务必告知医生，改为经腹超声。",
    purpose: "更清晰地观察内膜异位病灶及盆腔粘连。建议在月经干净后 3-7 天复查。"
  },
  "激素六项": {
    prep: "建议在月经周期的第 2-3 天清晨空劳抽血，检查前静坐 10 分钟。",
    purpose: "评估内分泌状态，排查由于激素失调（如多囊）引起的疼痛。"
  },
  "腹腔镜": {
    prep: "这属于微创手术，需住院进行。术前需禁食禁饮。",
    purpose: "子宫内膜异位症诊断的‘金标准’，可同时进行病灶剥离。"
  }
};
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <h1 style={{color:'#fff', textAlign:'center'}}>页面出了点小问题，请刷新重试</h1>;
    return this.props.children;
  }
}
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
      this.vel.mult(p5.random(6, 18));  // ← 缩短单步距离
      this.size = p5.random(2, 5);

      this.thorns = [];
      let numThorns = p5.floor(p5.random(2, 5));
      for (let i = 0; i < numThorns; i++) {
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
      this.vel = p5.createVector(0, 0); this.size = p5.random(5, 15); this.maxSize = p5.random(30, 60);
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
      this.angle += 0.08; this.size *= 0.98; if (this.size < 3) this.life = 0;
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
      let perpAngle = this.vel.heading() + p.PI / 2;
      let halfW = this.size / 2;
      p.vertex(this.pos.x + p.cos(perpAngle) * halfW, this.pos.y + p.sin(perpAngle) * halfW);
      p.vertex(this.pos.x - p.cos(perpAngle) * halfW, this.pos.y - p.sin(perpAngle) * halfW);
      p.vertex(endX, endY);
      p.endShape(p.CLOSE);

      p.fill(this.color[0], 0, 0, 255);
      this.thorns.forEach(thorn => {
        let rootX = this.pos.x + this.vel.x * thorn.distRatio;
        let rootY = this.pos.y + this.vel.y * thorn.distRatio;
        let thornEndX = rootX + p.cos(this.vel.heading() + thorn.angleOffset) * thorn.len;
        let thornEndY = rootY + p.sin(this.vel.heading() + thorn.angleOffset) * thorn.len;
        p.beginShape();
        p.vertex(rootX + p.cos(perpAngle) * 1, rootY + p.sin(perpAngle) * 1);
        p.vertex(rootX - p.cos(perpAngle) * 1, rootY - p.sin(perpAngle) * 1);
        p.vertex(thornEndX, thornEndY);
        p.endShape(p.CLOSE);
      });
    }
    else if (this.type === 'heavy') {
      // 绘制沉重的、上尖下宽的动态水滴
      p.noStroke(); p.fill(this.color[0] * 0.5, this.color[1] * 0.5, this.color[2] * 0.5, 200);
      p.beginShape();
      p.vertex(this.pos.x, this.pos.y - this.size * 0.8);
      p.bezierVertex(this.pos.x + this.size, this.pos.y, this.pos.x + this.size, this.pos.y + this.size * 1.5, this.pos.x, this.pos.y + this.size * 1.5);
      p.bezierVertex(this.pos.x - this.size, this.pos.y + this.size * 1.5, this.pos.x - this.size, this.pos.y, this.pos.x, this.pos.y - this.size * 0.8);
      p.endShape(p.CLOSE);
    }
    else if (this.type === 'scrape') {
      // 🔪 【恢复】狂暴刮撕：主线条 + 乱序纤维 + 三角血块
      let endX = this.pos.x + this.vel.x; let endY = this.pos.y + this.vel.y;
      p.stroke(this.color[0] * 0.5, 0, 0, 255); p.strokeWeight(this.size); p.line(this.pos.x, this.pos.y, endX, endY);
      p.stroke(this.color[0], this.color[1] * 0.3, this.color[2] * 0.3, 180); p.strokeWeight(1);
      p.line(this.pos.x + p.random(-8, 8), this.pos.y + p.random(-8, 8), endX + p.random(-8, 8), endY + p.random(-8, 8));
      if (p.random(1) < 0.6) {
        p.noStroke(); p.fill(this.color[0], 0, 0, 220);
        let spX = endX + p.random(-6, 6); let spY = endY + p.random(-6, 6);
        p.triangle(spX, spY, spX + p.random(-4, 4), spY + p.random(-4, 4), spX + p.random(-4, 4), spY + p.random(-4, 4));
      }
    }
    else if (this.type === 'twist') {
      p.push(); p.translate(this.pos.x, this.pos.y); p.rotate(this.angle);
      p.noFill(); p.stroke(this.color[0], this.color[1], this.color[2], 100); p.strokeWeight(1.5);
      p.arc(0, 0, this.size * 2, this.size * 2, 0, p.PI * 1.5);
      p.stroke(this.color[0], this.color[1], this.color[2], 200); p.strokeWeight(1.5);
      for (let i = 0; i < 5; i++) p.line(0, 0, this.size * p.cos(i * p.TWO_PI / 5), this.size * p.sin(i * p.TWO_PI / 5));
      p.noStroke(); p.fill(this.color[0] * 0.8, 0, 0, 220); p.ellipse(0, 0, this.size * 0.4); p.pop();
    }
    else if (this.type === 'wave') {
      p.noStroke(); p.fill(this.color[0], this.color[1], this.color[2], 10); p.ellipse(this.pos.x, this.pos.y, this.pulseSize, this.pulseSize);
    }
    p.drawingContext.shadowBlur = 0;
  }
  isDead() { return this.life < 0; }
}
// 【新增】：Canvas 文字自动换行工具
const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
  if (!text) return y;
  const words = text.split("");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n];
    let metrics = ctx.measureText(testLine);
    let testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight; // 返回最后一行的高度，方便后续排版
};
function App() {
  const [page, setPage] = useState("splash");
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [splashOpacity, setSplashOpacity] = useState(1);
  const [llmData, setLlmData] = useState(null); // 【新增】：专门用来存大模型返回的数据
  // 新增状态变量
  const [showGuide, setShowGuide] = useState(false);
  const [showMedicalOpt, setShowMedicalOpt] = useState(false);
  const [medicalBackground, setMedicalBackground] = useState({
    diagnosed: '',
    allergies: '',
  });
  const [tonePreference, setTonePreference] = useState('gentle');
  const [isLoading, setIsLoading] = useState(false);
  // 新增：内容可编辑
  const [editedContents, setEditedContents] = useState({});  // { fieldKey: '编辑后文字' }
  const [editingField, setEditingField] = useState(null);     // 当前正在编辑的字段名
  // 新增：选择分享身份
  const [diaryShareIdentity, setDiaryShareIdentity] = useState('partner');
  // 新增 ref
  const particlePositions = useRef([]);
  const speedHistory = useRef([]);
  const [activeBrush, setActiveBrush] = useState(null);
  const [activeColor, setActiveColor] = useState("crimson");
  const [identity, setIdentity] = useState("partner");
  const [userPrefs, setUserPrefs] = useState(["care"]);
  const [imgUrl, setImgUrl] = useState(null);
  const [bodyMode, setBodyMode] = useState('front');

  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('painscape_history') || '[]'));
  const [posts, setPosts] = useState([
    {
      id: 1,
      text: "痛得下不了床...",
      img: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200",
      painTags: ["绞痛"],
      likes: 0,                          // ← 修改：初始值从 0 开始
      hugs: 0,                           // ← 新增：抱抱数
      restReminders: 0,                  // ← 新增：休息提醒数
      group: "family",
      analogy: "🌪️ 像拧毛巾一样，一圈一圈拧紧",
      userExperience: null,              // ← 新增：用户亲历经验
      experienceTags: [],                // ← 新增：经验针对的问题类型
      hasUserHugged: false               // ← 新增：当前用户是否已抱抱
    },
    {
      id: 2,
      text: "腰快断了，一直坠坠的。",
      img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200",
      painTags: ["坠痛"],                // ← 新增：替代原来的 tags
      likes: 0,                          // ← 修改：初始值从 0 开始
      hugs: 0,                           // ← 新增：抱抱数
      restReminders: 0,                  // ← 新增：休息提醒数
      group: "friend",
      analogy: "🪨 像绑了沙袋往下坠，站着就想蹲下",
      userExperience: null,              // ← 新增：用户亲历经验
      experienceTags: [],                // ← 新增：经验针对的问题类型
      hasUserHugged: false               // ← 新增：当前用户是否已抱抱
    }
  ]);
  // 经验仓库（独立于帖子）：
  const [experienceLibrary, setExperienceLibrary] = useState([]);

  // 共鸣统计（标签 → 有多少人有同样经历）：
  const getPainTagStats = () => {
    const stats = {};
    posts.forEach(p => {
      (p.painTags || []).forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1;
      });
    });
    return stats;
  };
  const [postText, setPostText] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [viewingDiary, setViewingDiary] = useState(null);
  const [viewingPost, setViewingPost] = useState(null);
  const [communityFilter, setCommunityFilter] = useState("all");
  const [communityGroups, setCommunityGroups] = useState([{ id: 'family', name: '👩‍👧 家庭群' }, { id: 'friend', name: '🤝 朋友群' }]);

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
  const getExamReminders = (medText) => {
    if (!medText) return [];
    return Object.keys(EXAM_DATABASE).filter(keyword => medText.includes(keyword));
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
  const getFullShareText = (idty, content) => {
    const safeAction = content.action.replace(/🛑|🥣|🫂|❤️|复合指令：|偏好指令：/g, '').trim();
    const safeSelfCare = content.selfCare.replace(/✨/g, '•').trim();

    switch (idty) {
      case 'partner':
        return `【痛觉通感】\n${content.analogy}\n\n【你可以为她做的事】\n${safeAction}`;
      case 'work':
        return `【请假声明】\n${content.workText}`;
      case 'doctor':
        // 整合：画像 + 主诉 + 补充参考（包含检查建议）
        return `【痛觉画像】\n${content.med_profile}\n\n【临床主诉】\n${content.med_complaint}\n\n【诊疗补充参考】\n${content.med_reference}`;
      case 'self':
        return `【疼痛复盘】\n${content.analogy}\n\n【针对性缓解方案】\n${safeSelfCare}`;
      default:
        return "";
    }
  };
  const draw = (p5) => {
    p5.background(0);
    // 只在画板页才绘制人体底图
    if (page !== 'canvas') return;
    let { x, y, zoom } = camRef.current;
    let isInteracting = (p5.mouseIsPressed || p5.touches.length > 0) && isSafeToDraw(p5);

    let realX = (p5.mouseX - x) / zoom, realY = (p5.mouseY - y) / zoom;
    let realPx = (p5.pmouseX - x) / zoom, realPy = (p5.pmouseY - y) / zoom;
    let speed = p5.dist(realX, realY, realPx, realPy);
    let heading = (speed < 1) ? p5.PI / 2 : p5.atan2(realY - realPy, realX - realPx);
    if (speedHistory.current.length > 200) speedHistory.current.shift();
    speedHistory.current.push(speed);
    if (speedHistory.current.length > 200) speedHistory.current.shift();
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

          // === 新增：记录粒子位置和速度 ===
          particlePositions.current.push({ x: realX, y: realY, bodyMode });
          speedHistory.current.push(speed);
          if (speedHistory.current.length > 200) speedHistory.current.shift();
          // === 新增结束 ===

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

    // 始终显示离屏画布（包含静态粒子）
    p5.noTint(); p5.imageMode(p5.CORNER); p5.image(currentPg, 0, 0);

    for (let i = dynamicParticles.current.length - 1; i >= 0; i--) {
      let dp = dynamicParticles.current[i];
      dp.update(p5);
      if (dp.bodyMode === bodyMode) dp.show(p5);
      if (dp.isDead()) dynamicParticles.current.splice(i, 1);
    }
    p5.pop();

  };
  // 分享预览相关状态
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [shareContent, setShareContent] = useState(null);

  const prepareSharePreview = (content) => {
    // 将用户编辑过的字段合并进 shareContent
    setShareContent({
      ...content,
      analogy: getEditedOrDefault('analogy', content.analogy),
      action: getEditedOrDefault('action', content.action),
      workText: getEditedOrDefault('workText', content.workText),
      med_complaint: getEditedOrDefault('med_complaint', content.med_complaint),
      med_reference: getEditedOrDefault('med_reference', content.med_reference),
      selfCare: getEditedOrDefault('selfCare', content.selfCare),
      identity: identity
    });
    setShowSharePreview(true);
  };

  // 第二步：确认分享（生成最终图片并分享）
  const confirmShare = async () => {
    if (!shareContent) return;
    setIsLoading(true); // 开启加载状态提示

    try {
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d');
      const fullText = getFullShareText(shareContent.identity, shareContent);

      // 1. 预估文字高度（每行 28px）来决定画布总高度
      const textWidth = 480;
      const charPerLine = 22;
      const estimatedLines = Math.ceil(fullText.length / charPerLine) + (fullText.split('\n').length * 1.5);
      const textHeight = estimatedLines * 28 + 150;

      cvs.width = 600;
      cvs.height = 600 + textHeight; // 动态高度：图片区 + 文字区

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      // 2. 绘制痛觉图谱（等比缩放，防止变形）
      const mainImg = new Image();
      // 增加错误拒绝逻辑，防呆
      await new Promise((resolve, reject) => {
        mainImg.onload = resolve;
        mainImg.onerror = reject;
        mainImg.src = shareContent.historyImg || imgUrl;
      });

      // 计算等比缩放，放入 520x520 的区域（留白各 40px）
      const maxDim = 520;
      const ratio = Math.min(maxDim / mainImg.width, maxDim / mainImg.height);
      const drawW = mainImg.width * ratio;
      const drawH = mainImg.height * ratio;
      const drawX = 40 + (maxDim - drawW) / 2;  // 水平居中
      const drawY = 40 + (maxDim - drawH) / 2;  // 垂直居中
      ctx.drawImage(mainImg, drawX, drawY, drawW, drawH);

      // 3. 绘制半透明装饰框
      ctx.fillStyle = '#1c1c1c';
      roundRect(ctx, 30, 580, 540, textHeight - 40, 20);
      ctx.fill();

      // 4. 绘制文字
      ctx.fillStyle = '#ff9800';
      ctx.font = 'bold 26px sans-serif';
      const titleMap = { partner: '通感说明书', work: '不可见痛苦声明', doctor: '医疗辅助报告', self: '自愈建议' };
      ctx.fillText(titleMap[shareContent.identity], 60, 630);

      ctx.fillStyle = '#eee';
      ctx.font = '16px "Microsoft YaHei", sans-serif';
      wrapText(ctx, fullText, 60, 680, 480, 30);

      // 5. 底部品牌标识
      ctx.fillStyle = '#444';
      ctx.font = '12px sans-serif';
      ctx.fillText('PainScape - 让不可见的痛苦被看见', 60, cvs.height - 40);

      const finalUrl = cvs.toDataURL('image/jpeg', 0.9);
      const blob = await (await fetch(finalUrl)).blob();
      const file = new File([blob], 'painscape_share.jpg', { type: 'image/jpeg' });

      // 6. 分享或下载逻辑（修复用户取消分享导致的报错问题）
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: '我的痛觉声明卡',
            files: [file]
          });
          // 只有真正分享成功才关闭预览
          setShowSharePreview(false);
        } catch (e) {
          if (e.name === 'AbortError') {
            // 用户主动取消分享，静默处理，不提示失败也不关闭预览
            return;
          }
          // 其他真正的错误（如网络中断等），降级到下载
          const link = document.createElement('a');
          link.href = finalUrl;
          link.download = `PainScape_${Date.now()}.jpg`;
          link.click();
        }
      } else {
        // 如果环境不支持分享（如普通 PC 浏览器），则触发下载
        const link = document.createElement('a');
        link.href = finalUrl;
        link.download = `PainScape_${Date.now()}.jpg`;
        link.click();
        alert("已为您保存分享卡片！");
        setShowSharePreview(false);
      }

    } catch (e) {
      console.error("生成分享卡片失败:", e);
      alert("生成分享卡片失败，可能是图片加载超时。请尝试直接截图分享。");
    } finally {
      setIsLoading(false); // 【关键修复】：确保分享结束后 Loading 消失
    }
  };

  // ── 辅助函数 ──
  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };
  // 捕获包含动态粒子的完整画面
  const captureFullCanvas = (side) => {
    const p5 = p5Ref.current;
    if (!p5) {
      console.warn('p5 实例不存在');
      return document.createElement('canvas');
    }

    const pg = side === 'front' ? pgFrontRef.current : pgBackRef.current;
    if (!pg) {
      console.warn(`${side} 画布不存在`);
      return document.createElement('canvas');
    }

    // 创建一个新的 p5 Graphics 对象
    const captureGraphics = p5.createGraphics(pg.width, pg.height);

    // 1. 绘制静态图层
    captureGraphics.image(pg, 0, 0);

    // 2. 绘制该面的动态粒子
    dynamicParticles.current.forEach(dp => {
      if (dp.bodyMode === side) {
        dp.show(captureGraphics);
      }
    });

    // 返回原生 canvas 元素
    return captureGraphics.elt;
  };

  // 检查某一面是否有任何内容（静态笔触 + 动态粒子）
  const isSideEmpty = (side) => {
    // 1. 检查画笔计数器（最快最准）
    const totalCount = Object.values(brushCounts.current).reduce((a, b) => a + b, 0);
    if (totalCount > 10) return false; // 只要画了超过10个粒子就肯定不为空

    // 2. 检查动态粒子（针对刚画完还没计入总数的情况）
    if (dynamicParticles.current && dynamicParticles.current.some(dp => dp.bodyMode === side)) {
      return false;
    }

    return true;
  };
  const handlePublishPost = () => {

    if (!postText) return alert("写下你的感受吧~");

    const dominant = getDominantPain();
    const content = generateContent(dominant);

    const newPost = {
      id: Date.now(),
      text: postText,
      img: imgUrl,
      likes: 0,
      hugs: 0,
      restReminders: 0,
      group: communityFilter === 'all' ? 'family' : communityFilter,
      painTags: [PAIN_NAME_MAP[dominant]],
      analogy: content.analogy,
      action: content.action,
      userExperience: null,
      experienceTags: [],
      hasUserHugged: false,
    };

    setPosts(prev => [newPost, ...prev]);
    setShowPostModal(false);
    setPostText("");

    // 发布后显示激励弹窗
    setTimeout(() => {
      const tagStats = getPainTagStats();
      const myTag = PAIN_NAME_MAP[dominant];
      // 获取真实的同痛人数
      let sameCount = (tagStats[myTag] || 0);
      // 如果 sameCount 为 0，则生成一个 3~8 的随机基数
      if (sameCount === 0) {
        sameCount = Math.floor(Math.random() * 6) + 3; // 随机生成 3 到 8 之间的整数
      }
      // 如果真实人数少于3人，就补足到3~8人
      if (sameCount < 3) {
        sameCount = sameCount + Math.floor(Math.random() * 6) + (3 - sameCount);
      }
      // sameCount = sameCount || 5; 
      alert(`你的经历已发布 🌸\n\n目前有 ${sameCount} 位和你一样经历着"${myTag}"的人。\n\n你的分享，可能正是她们一直在找的答案。`);
    }, 300);

    setPage("community");

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

  // === 2.generateContent ===
  // === 修复后的 generateContent ===
  const generateContent = (overrideType, externalLlm = null) => {
    // currentLlmData 不存在，改为优先使用传入的 externalLlm，其次用 state 中的 llmData
    const activeLlm = externalLlm || llmData;
    const hasLlm = activeLlm?.status === 'success';
    const dominant = overrideType || getDominantPain();
    const painNameMap = {
      twist: "严重绞痛",
      pierce: "荆棘刺痛",
      heavy: "坠胀重压",
      wave: "弥漫胀痛",
      scrape: "撕裂刮痛"
    };
    const painName = painNameMap[dominant];

    const TEXTS = {
      twist: {
        analogy: "想象把一条湿毛巾用力拧干...",
        med: "下腹部持续性绞痛，建议排查子宫痉挛。",
        selfCare: "✨ 尝试【婴儿蜷缩式】侧卧..."
      },
      pierce: {
        analogy: "想象不打麻药进行根管治疗...",
        med: "锐痛（Sharp Pain），建议排查神经性疼痛。",
        selfCare: "✨ 刺痛发作易引发冷汗..."
      },
      heavy: {
        analogy: "像在腹部绑了5公斤沙袋...",
        med: "下腹部严重坠胀感，建议排查盆腔充血。",
        selfCare: "✨ 尝试【臀部垫高平躺】..."
      },
      wave: {
        analogy: "像肚子里有个气球在不断充气...",
        med: "弥漫性胀痛，建议排查水肿或肠胀气。",
        selfCare: "✨ 穿着极度宽松的衣物..."
      },
      scrape: {
        analogy: "像一颗未成熟的果实被强行剥皮...",
        med: "强烈的撕裂样锐痛，建议排查组织粘连。",
        selfCare: "✨ 这是最耗费体力的痛感..."
      }
    };

    let finalMedComplaint = hasLlm ? activeLlm.med : (TEXTS[dominant]?.med || "主诉：持续性痛经。");

    let examPreps = [];
    const EXAM_KEYWORDS = {
      "盆腔超声": ["盆腔超声", "腹部超声", "B超", "继发性", "子宫内膜异位"],
      "经阴道超声": ["经阴道超声", "阴超"],
      "激素六项": ["激素六项", "性激素"],
      "腹腔镜": ["腹腔镜", "微创手术"]
    };
    Object.keys(EXAM_KEYWORDS).forEach(std => {
      if (EXAM_KEYWORDS[std].some(a => finalMedComplaint.includes(a))) {
        examPreps.push(`📝【${std}须知】: ${EXAM_DATABASE[std]?.prep}`);
      }
    });

    let auxiliaryInfo = [];
    const diagMap = {
      'endometriosis': '子宫内膜异位症',
      'adenomyosis': '子宫腺肌症',
      'pcos': '多囊卵巢综合征',
      'fibroids': '子宫肌瘤',
      'pid': '盆腔炎性疾病（PID）',
      'ovariancyst': '卵巢囊肿',
      'cervicalstenosis': '宫颈管狭窄',
      'unchecked': '未做过相关检查',
      'none': '无确诊'
    };
    const diagValue = medicalBackground.diagnosed;
    if (diagValue && diagValue !== '' && diagValue !== 'none' && diagValue !== 'unchecked') {
      auxiliaryInfo.push(`• 既往诊断：${diagMap[diagValue] || diagValue}。`);
    } else if (diagValue === 'unchecked') {
      auxiliaryInfo.push(`• 既往病史：患者自述未做过痛经相关妇科检查。`);
    }

    const allergyValue = medicalBackground.allergies;
    const allergyLabelMap = {
      aspirin: '阿司匹林', ibuprofen: '布洛芬', nsaids: '多种NSAIDs'
    };
    if (allergyValue && allergyValue !== '' && allergyValue !== 'none' && allergyValue !== 'unknown') {
      auxiliaryInfo.push(`• 药物过敏：${allergyLabelMap[allergyValue] || allergyValue}过敏，请注意用药。`);
    }

    let finalMedReference = auxiliaryInfo.join('\n');
    if (examPreps.length > 0) {
      finalMedReference += (finalMedReference ? '\n' : '') + examPreps.join('\n');
    } else if (!finalMedReference) {
      finalMedReference = "• 建议向医生详细描述本次记录的痛觉质地与发作时间。";
    }
    // 根据过敏史智能推荐止痛药
    let safePainkiller = "布洛芬";
    if (medicalBackground.allergies === 'ibuprofen') {
      safePainkiller = "对乙酰氨基酚（泰诺）";
    } else if (medicalBackground.allergies === 'nsaids') {
      safePainkiller = "对乙酰氨基酚（请遵医嘱）";
    } else if (medicalBackground.allergies === 'aspirin') {
      safePainkiller = "布洛芬（避免阿司匹林）";
    }

    let actionParts = [];
    if (userPrefs.includes('alone')) {
      actionParts.push(`☑️ 帮她倒杯温水，备好${safePainkiller}。`);
      actionParts.push("☑️ 调暗灯光，关门出去，不要频繁询问。");
    } else {
      if (userPrefs.includes('care')) actionParts.push("☑️ 搓热手掌捂在她小腹或后腰。主动承担家务。");
      if (userPrefs.includes('comfort')) actionParts.push("☑️ 坐在旁边握着她的手，不用说话，给予安全感。");
    }

    const workTemplate = `领导/HR 您好：本人今日突发严重原发性痛经（${painName}），伴随体力透支与冷汗。目前状态已无法维持正常专注度，特申请今日居家休息。紧急事务已交接。感谢批准。`;

    let finalSelfCare = hasLlm ? activeLlm.selfCare : TEXTS[dominant].selfCare;
    if (tonePreference === 'gentle' && !hasLlm) {
      finalSelfCare += "\n\n✨ 允许自己今天做一个废物，好好休息。";
    }

    return {
      pain: painName,
      analogy: hasLlm ? activeLlm.analogy : TEXTS[dominant].analogy,
      med_complaint: finalMedComplaint,
      med_reference: finalMedReference,
      med_profile: `PainScape 痛觉成像显示强烈的 ${painName} 特征。`,
      selfCare: finalSelfCare,
      workText: hasLlm ? activeLlm.work : workTemplate,
      action: actionParts.join("\n"),
      med: finalMedComplaint  // 补充：Result 页面医生 tab 引用了 content.med
    };
  };

  // 可编辑内容辅助函数
  const getEditedOrDefault = (key, defaultVal) =>
    editedContents[key] !== undefined ? editedContents[key] : defaultVal;

  const EditableBlock = ({ fieldKey, defaultValue, color = '#ccc', style = {} }) => {
    const value = getEditedOrDefault(fieldKey, defaultValue);
    const isEditing = editingField === fieldKey;

    if (isEditing) {
      return (
        <textarea
          autoFocus
          value={value}
          onChange={e => setEditedContents(prev => ({ ...prev, [fieldKey]: e.target.value }))}
          onBlur={() => setEditingField(null)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)',
            color: '#fff', border: '1px solid #555', borderRadius: '8px',
            padding: '10px', fontSize: '13px', lineHeight: '1.6',
            resize: 'vertical', minHeight: '80px', boxSizing: 'border-box',
            fontFamily: 'inherit', ...style
          }}
        />
      );
    }

    return (
      <div
        onClick={() => setEditingField(fieldKey)}
        title="点击编辑"
        style={{
          color, fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap',
          cursor: 'text', padding: '6px 8px', borderRadius: '6px',
          border: '1px dashed transparent',
          transition: 'border-color 0.2s',
          ...style
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#555'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      >
        {value}
        <span style={{ marginLeft: '6px', fontSize: '10px', color: '#555', verticalAlign: 'middle' }}>✏️</span>
      </div>
    );
  };
  // 【新增】：一键复制功能
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("文案已复制到剪贴板，可直接粘贴至微信！");
    }).catch(err => {
      console.error('复制失败', err);
    });
  };
  // === 1. 优化数据提取计算函数 ===
  const calculateSpatialMap = () => {
    // 盲画模式不计算解剖位置
    if (bodyMode === 'none') return null;

    const positions = particlePositions.current;
    if (positions.length === 0) return null;

    const canvasHeight = window.innerHeight;
    let upper = 0, middle = 0, lower = 0;

    positions.forEach(p => {
      // 过滤掉非当前面的粒子
      if (p.bodyMode !== bodyMode) return;
      const ratio = p.y / canvasHeight;
      if (ratio < 0.35) upper++;
      else if (ratio < 0.65) middle++;
      else lower++;
    });

    const total = upper + middle + lower;
    if (total === 0) return null;

    return {
      abdomen: parseFloat((middle / total).toFixed(2)),
      lowerBack: parseFloat((lower / total).toFixed(2)),
      upperBody: parseFloat((upper / total).toFixed(2))
    };
  };

  const calculateIntensity = () => {
    const speeds = speedHistory.current;
    if (speeds.length === 0) return null;

    const avg = speeds.reduce((s, v) => s + v, 0) / speeds.length;
    const peak = Math.max(...speeds);
    return {
      avgSpeed: parseFloat(avg.toFixed(1)),
      peakSpeed: parseFloat(peak.toFixed(1))
    };
  };
  const getDominantPain = () => {
    const counts = brushCounts.current;
    const maxVal = Math.max(...Object.values(counts));
    // 找出使用次数最多的画笔，如果都没用过，默认返回 'twist'
    return maxVal > 0 ? Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) : 'twist';
  };
  const handleFinish = async () => {
    if (!p5Ref.current) return;
    setIsLoading(true);

    try {
      // 去除 try 块内重复的 const canvas/url/dominant 声明
      const canvas = document.querySelector("canvas");
      const url = canvas.toDataURL("image/jpeg", 0.5);
      setImgUrl(url);
      const dominant = getDominantPain();
      let aiResult = null;

      const payload = {
        dominantPain: dominant,
        userPref: userPrefs.join(','),
        painScore: Object.values(brushCounts.current).reduce((sum, v) => sum + v, 0),
        spatialMap: calculateSpatialMap(),
        intensityProfile: calculateIntensity(),
        colorPalette: activeColor,
        bodyMode: bodyMode,
        medicalBackground: medicalBackground,
        tonePreference: tonePreference,
      };

      // API 地址
      const API_BASE = 'https://painscape-api.onrender.com';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        const response = await fetch(`${API_BASE}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dominantPain: dominant,
            userPref: userPrefs.join(','),
            medicalBackground,
            painScore: Object.values(brushCounts.current).reduce((a, b) => a + b, 0)
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          aiResult = await response.json();
          setLlmData(aiResult);
        }
      } catch (err) {
        console.warn("后端不可用，转入本地模式", err);
        setLlmData(null);
      }

      // 将 aiResult 正确传入 generateContent
      const finalContent = generateContent(dominant, aiResult);

      const newRecord = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        img: url,
        type: dominant,
        painName: PAIN_NAME_MAP[dominant],
        content: finalContent,
        meta: {
          brushCounts: { ...brushCounts.current },
          bodyMode,
          colorPalette: activeColor,
          painScore: Object.values(brushCounts.current).reduce((a, b) => a + b, 0)
        }
      };

      const newHistory = [newRecord, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('painscape_history', JSON.stringify(newHistory));
    } catch (e) {
      console.error("handleFinish 出错:", e);
    } finally {
      setIsLoading(false);
      setPage("result");
      particlePositions.current = [];
      speedHistory.current = [];
    }
  };
  const updateRecordInfo = (recordId, field, value) => {
    const updatedHistory = history.map(r =>
      r.id === recordId ? { ...r, [field]: value } : r
    );
    setHistory(updatedHistory);
    localStorage.setItem('painscape_history', JSON.stringify(updatedHistory));

    if (viewingDiary?.id === recordId) {
      setViewingDiary({ ...viewingDiary, [field]: value });
    }
  };
  // 【新增逻辑】：将历史记录按年月分组
  const getGroupedHistory = () => {
    return history.reduce((acc, item) => {
      // 假设 item.date 是 "2026/5/7" 这种格式
      const dateParts = item.date.split('/');
      const monthKey = `${dateParts[0]}年${dateParts[1]}月`;
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(item);
      return acc;
    }, {});
  };

  const groupedHistory = getGroupedHistory();
  // 存储哪些月份是折叠的 (默认全部展开)
  const [collapsedMonths, setCollapsedMonths] = useState({});

  const toggleMonth = (month) => {
    setCollapsedMonths(prev => ({
      ...prev,
      [month]: !prev[month]
    }));
  };
  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1 }}>
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
          <div style={{ pointerEvents: 'auto', background: '#0a0a0a', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>

            {/* 快速指南问号按钮 */}
            <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10 }}>
              <button onClick={() => setShowGuide(!showGuide)}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid #444', color: '#888', width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ?
              </button>
              {showGuide && (
                <div style={{
                  position: 'absolute', top: '40px', right: '0',
                  background: 'rgba(30,30,30,0.97)', border: '1px solid #444',
                  borderRadius: '12px', padding: '16px', width: '260px',
                  backdropFilter: 'blur(10px)', zIndex: 200
                }}>
                  <p style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
                    使用指南
                  </p>
                  {[
                    ['🎨 选择画笔', '每种画笔对应一种痛感质地，可混合使用'],
                    ['🩸 选择颜色', '不同颜色代表疼痛的情绪与温度'],
                    ['✏️ 开始绘制', '在身体图上点击或滑动，画出你的疼痛范围'],
                    ['📐 调整视角', '长按 0.3 秒可拖拽移动；双指缩放细节'],
                    ['↩️ 撤销/重做', '右侧按钮随时修改，清除重新开始'],
                    ['⚡ 生成报告', '右上角"生成"，AI 将转译你的痛觉图谱'],
                  ].map(([title, desc]) => (
                    <div key={title} style={{ marginBottom: '8px' }}>
                      <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{title}</span>
                      <p style={{ color: '#888', fontSize: '11px', margin: '2px 0 0 0' }}>{desc}</p>
                    </div>
                  ))}

                  {/* 反馈入口 */}
                  <div style={{ borderTop: '1px solid #333', marginTop: '12px', paddingTop: '10px' }}>
                    <button
                      onClick={() => {
                        setShowGuide(false);
                        const fb = prompt("你的反馈将帮助我们改善产品（可留空提交匿名反馈）：");
                        if (fb !== null) {
                          localStorage.setItem('painscape_feedback_' + Date.now(), fb);
                          alert("感谢你的反馈！每一条都会被认真阅读。");
                        }
                      }}
                      style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #555', color: '#888', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      📮 提交使用反馈
                    </button>
                  </div>
                  <button onClick={() => setShowGuide(false)} style={{ marginTop: '8px', width: '100%', background: 'transparent', border: '1px solid #444', color: '#666', padding: '5px', borderRadius: '8px', fontSize: '10px', cursor: 'pointer' }}>
                    知道了
                  </button>
                </div>
              )}
            </div>

            <h1 style={{ color: '#fff', marginBottom: '5px', fontSize: '2rem' }}>PainScape</h1>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>让说不出的痛，换一种方式抵达</p>

            <div style={{ width: '100%', maxWidth: '320px', textAlign: 'left' }}>
              <label style={{ color: '#fff', marginBottom: '10px', display: 'block', fontSize: '0.9rem', fontWeight: 'bold' }}>当痛经发作时，你最需要伴侣/家人怎么做？</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['alone', 'care', 'comfort'].map((p, i) => (
                  <button key={p} onClick={() => togglePref(p)} style={{ padding: '12px', borderRadius: '10px', textAlign: 'left', background: '#1e1e1e', border: userPrefs.includes(p) ? '2px solid #d32f2f' : '1px solid #444', color: '#fff', cursor: 'pointer' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{['🛑 别管我，让我一个人待着', '🥣 我没力气，需要实际照顾', '🫂 我很脆弱，需要情绪陪伴'][i]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 选填：健康信息 */}
            <div style={{ width: '100%', maxWidth: '320px', marginTop: '15px' }}>
              <button onClick={() => setShowMedicalOpt(!showMedicalOpt)}
                style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '8px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', width: '100%' }}>
                {showMedicalOpt ? '收起 ↑' : '填写健康信息（可选，用于生成更准确的医疗建议）'}
              </button>
              {showMedicalOpt && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select value={medicalBackground.diagnosed} onChange={(e) => setMedicalBackground({ ...medicalBackground, diagnosed: e.target.value })}
                    style={{ width: '100%', padding: '8px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '8px', fontSize: '12px' }}>
                    <option value="">既往诊断（可选）</option>
                    <option value="none">无确诊</option>
                    <option value="endometriosis">子宫内膜异位症</option>
                    <option value="adenomyosis">子宫腺肌症</option>
                    <option value="fibroids">子宫肌瘤</option>
                    <option value="pcos">多囊卵巢综合征</option>
                    <option value="pid">盆腔炎性疾病（PID）</option>
                    <option value="ovariancyst">卵巢囊肿</option>
                    <option value="cervicalstenosis">宫颈管狭窄</option>
                    <option value="unchecked">未做过相关检查</option>
                  </select>
                  <select value={medicalBackground.allergies} onChange={(e) => setMedicalBackground({ ...medicalBackground, allergies: e.target.value })}
                    style={{ width: '100%', padding: '8px', background: '#1e1e1e', color: '#fff', border: '1px solid #444', borderRadius: '8px', fontSize: '12px' }}>
                    <option value="">药物过敏史（可选）</option>
                    <option value="none">无已知过敏</option>
                    <option value="aspirin">阿司匹林过敏</option>
                    <option value="ibuprofen">布洛芬过敏</option>
                    <option value="nsaids">多种NSAIDs过敏</option>
                    <option value="unknown">未留意过</option>
                  </select>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setTonePreference('gentle')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', background: tonePreference === 'gentle' ? '#4caf50' : '#1e1e1e', color: tonePreference === 'gentle' ? '#fff' : '#888', border: tonePreference === 'gentle' ? '2px solid #4caf50' : '1px solid #444' }}>🌿 温和</button>
                    <button onClick={() => setTonePreference('direct')} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', background: tonePreference === 'direct' ? '#2196f3' : '#1e1e1e', color: tonePreference === 'direct' ? '#fff' : '#888', border: tonePreference === 'direct' ? '2px solid #2196f3' : '1px solid #444' }}>💬 直接</button>
                  </div>
                  <p style={{ color: '#666', fontSize: '10px', margin: '0' }}>温和：安抚为主 / 直接：只说方法</p>
                </div>
              )}
            </div>

            <button style={{ marginTop: '20px', width: '200px', padding: '14px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => { pgFrontRef.current?.clear(); pgBackRef.current?.clear(); dynamicParticles.current = []; staticParticles.current = []; particlePositions.current = []; speedHistory.current = []; setPage("canvas"); }}>
              开始绘制
            </button>

            <div style={{ display: 'flex', gap: '15px', marginTop: '15px', marginBottom: '10px' }}>
              <button style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px' }} onClick={() => setPage("community")}>🌍 探索广场</button>
              <button style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px' }} onClick={() => setPage("history")}>📅 疼痛日记</button>
            </div>
          </div>
        )}

        {/* === Canvas 绘画页面 === */}
        {page === "canvas" && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setPage("onboarding")}
                  style={{
                    background: 'transparent',
                    border: '1px solid #444',
                    color: '#888',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ←
                </button>
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

            <div style={{ pointerEvents: 'auto', position: 'absolute', bottom: '20px', paddingBottom: '8px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '380px', maxHeight: '38vh', overflowY: 'visible', background: 'rgba(20,20,20,0.9)', padding: '15px', borderRadius: '24px', backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                {Object.keys(BRUSHES).map(k => (
                  <button key={k} style={{ flex: 1, background: activeBrush === k ? '#444' : 'transparent', border: 'none', color: activeBrush === k ? '#fff' : '#888', padding: '8px 0', borderRadius: '10px', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => setActiveBrush(activeBrush === k ? null : k)}>
                    <span style={{ fontSize: '20px', marginBottom: '4px' }}>{BRUSHES[k].icon}</span>
                    <span>{BRUSHES[k].label.split(" ")[1]}</span>
                  </button>
                ))}
              </div>
              {/* 画板的颜色选择器 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                  {Object.keys(PALETTES).map(k => (
                    <div key={k} style={{ width: '30px', height: '30px', borderRadius: '50%', border: activeColor === k ? '2px solid #fff' : '2px solid #444', background: `rgb(${PALETTES[k].color.join(',')})`, cursor: 'pointer', transform: activeColor === k ? 'scale(1.2)' : 'none' }} onClick={() => setActiveColor(k)} />
                  ))}
                </div>
                <span style={{ color: '#888', fontSize: '11px', marginTop: '6px', textAlign: 'center', display: 'block' }}>
                  {activeColor === 'crimson' ? '深红：急性锐痛/充血' : activeColor === 'dark' ? '暗灰：沉重钝痛/抑郁' : activeColor === 'purple' ? '紫：神经性放射痛' : '冰蓝：发冷/发僵'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* === Result 结果页面 === */}
        {page === "result" && (() => {
          try {
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
                  {/* === 伴侣 tab === */}
                  {identity === 'partner' && (
                    <>
                      <h3 style={{ color: '#fff', margin: '0 0 15px 0' }}>通感说明书</h3>
                      <div style={{ background: 'rgba(211,47,47,0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #d32f2f' }}>
                        <p style={{ color: '#ffcdd2', fontSize: '13px', margin: '0 0 6px 0', lineHeight: '1.5' }}>
                          她正在经历强烈的<strong>{content.pain}</strong>。
                        </p>
                        {/* ✅ 可编辑：通感比喻 */}
                        <EditableBlock fieldKey="analogy" defaultValue={content.analogy} color="#ffcdd2" />
                      </div>
                      <div style={{ marginTop: '20px' }}>
                        <strong style={{ color: '#fff', fontSize: '14px' }}>💡 请立刻执行以下操作：</strong>
                        {/* ✅ 可编辑：伴侣实操指令 */}
                        <EditableBlock fieldKey="action" defaultValue={content.action} color="#ccc" style={{ marginTop: '10px' }} />
                      </div>
                      <button
                        onClick={() => handleCopy(getEditedOrDefault('action', content.action))}
                        style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #d32f2f', color: '#ffcdd2', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        📋 复制实操指令
                      </button>
                    </>
                  )}

                  {/* === 请假 tab === */}
                  {identity === 'work' && (
                    <>
                      <h3 style={{ color: '#ff9800', margin: '0 0 15px 0' }}>高情商请假模板</h3>
                      <p style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>客观描述生理状况，不卑不亢，并留出交接空间。</p>
                      <div style={{ background: 'rgba(255,152,0,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,152,0,0.3)' }}>
                        {/* ✅ 可编辑：请假模板 */}
                        <EditableBlock fieldKey="workText" defaultValue={content.workText} color="#ccc" />
                      </div>
                      <button
                        onClick={() => handleCopy(getEditedOrDefault('workText', content.workText))}
                        style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #ff9800', color: '#ffcc80', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        📋 复制请假模板
                      </button>
                    </>
                  )}

                  {/* === 医生 tab === */}
                  {identity === 'doctor' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>
                        <h3 style={{ color: '#2196f3', margin: 0 }}>医疗辅助报告</h3>
                        <span style={{ color: '#666', fontSize: '10px', background: '#111', padding: '2px 8px', borderRadius: '10px' }}>算法生成 · 仅供参考</span>
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ color: '#90caf9', margin: '0 0 5px 0', fontSize: '13px' }}>🩺 临床诊断建议</h4>
                        {/* ✅ 可编辑：医疗主诉 */}
                        <EditableBlock fieldKey="med_complaint" defaultValue={content.med_complaint} color="#fff" />
                      </div>
                      {/* 【新增】：针对性检查提醒框 */}
                      {getExamReminders(content.med).map(exam => (
                        <div key={exam} style={{ marginTop: '15px', padding: '12px', marginTop: '15px', marginBottom: '12px', background: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33,150,243,0.3)', borderRadius: '10px' }}>
                          <p style={{ color: '#90caf9', fontSize: '13px', fontWeight: 'bold', margin: '0 0 5px 0' }}>💡 患者检查须知：{exam}</p>
                          <p style={{ color: '#aaa', fontSize: '12px', margin: 0 }}><strong>准备：</strong>{EXAM_DATABASE[exam].prep}</p>
                          <p style={{ color: '#888', fontSize: '11px', margin: 0 }}>
                            <strong>目的：</strong>{EXAM_DATABASE[exam].purpose}  {/* 顺便把 purpose 也展示出来 */}
                          </p>
                        </div>
                      ))}
                      <div style={{ marginTop: '8px', marginBottom: '12px', padding: '10px', background: 'rgba(33,150,243,0.08)', borderLeft: '3px solid #2196f3', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={imgUrl} style={{ width: '30px', height: '30px', borderRadius: '4px', objectFit: 'cover' }} alt="thumb" />
                        <p style={{ color: '#90caf9', fontSize: '12px', margin: 0 }}>本次多维痛觉图谱已附在报告后方，可向接诊医生展示。</p>
                      </div>
                      <div style={{ padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid #333' }}>
                        <h4 style={{ color: '#e0e0e0', fontSize: '13px', margin: '0 0 10px 0' }}>📋 供您与医生讨论参考：</h4>
                        {/* ✅ 可编辑：诊疗参考清单 */}
                        <EditableBlock fieldKey="med_reference" defaultValue={content.med_reference} color="#aaa" />
                      </div>
                      <button
                        onClick={() => handleCopy(
                          `主诉：${getEditedOrDefault('med_complaint', content.med_complaint)}\n\n参考清单：\n${getEditedOrDefault('med_reference', content.med_reference)}`
                        )}
                        style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #2196f3', color: '#90caf9', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        📋 复制完整报告
                      </button>
                    </>
                  )}

                  {/* === 自愈 tab === */}
                  {identity === 'self' && (
                    <>
                      <h3 style={{ color: '#9c27b0', margin: '0 0 15px 0' }}>自愈与社群互助</h3>
                      <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.5', marginBottom: '15px' }}>
                        亲爱的，你画出了你的风暴。痛不是你的错，允许自己今天做一个废物，好好休息吧。
                      </p>
                      <div style={{ background: 'rgba(156,39,176,0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #9c27b0' }}>
                        {/* ✅ 可编辑：自愈建议 */}
                        <EditableBlock fieldKey="selfCare" defaultValue={content.selfCare} color="#e1bee7" />
                      </div>
                      <button
                        onClick={() => handleCopy(getEditedOrDefault('selfCare', content.selfCare))}
                        style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #9c27b0', color: '#e1bee7', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        📋 复制建议保存
                      </button>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '350px', marginTop: '30px', marginBottom: '40px' }}>
                  <button style={{ flex: 2, padding: '14px', borderRadius: '20px', background: '#4caf50', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => prepareSharePreview(content)}>一键分享卡片</button>
                  <button style={{ flex: 1.5, padding: '14px', borderRadius: '20px', background: '#2196f3', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setShowPostModal(true)}>发布到广场</button>
                  <button style={{ flex: 1, padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', border: '1px solid #555', color: '#fff', cursor: 'pointer' }} onClick={() => { setPage("onboarding"); }}>返回主页</button>
                </div>
              </div>
            );
          } catch (e) {
            // 防如果 generateContent 崩溃，至少不黑屏
            console.error("Result 渲染出错:", e);
            return (
              <div style={{ pointerEvents: 'auto', position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 20, background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <p>报告生成遇到问题</p>
                <button onClick={() => setPage("onboarding")} style={{ marginTop: '20px', padding: '12px 24px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>返回首页</button>
              </div>
            );
          }
        })()}
        {/* === Community 广场页面 === */}
        {page === "community" && (
          <div style={{ pointerEvents: 'auto', background: '#0a0a0a', width: '100vw', height: '100vh', overflowY: 'auto', padding: '15px', boxSizing: 'border-box' }}>
            {/* 头部固定 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10, paddingBottom: '10px' }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>🌍 共鸣广场</h2>
              <button className="retry-btn" style={{ margin: 0, padding: '6px 15px', width: 'auto' }} onClick={() => setPage('onboarding')}>返回</button>
            </div>

            {/* 筛选区域 */}
            <div style={{ marginBottom: '15px' }}>
              {/* 第一排：群组筛选  */}
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                {['all', 'family', 'friend'].map(f => (
                  <button
                    key={f}
                    onClick={() => setGroupFilter(f)}
                    style={{
                      padding: '6px 15px', borderRadius: '15px', border: 'none',
                      background: groupFilter === f ? '#d32f2f' : '#222',
                      color: '#fff', whiteSpace: 'nowrap', cursor: 'pointer'
                    }}
                  >
                    {f === 'all' ? '全部' : f === 'family' ? '🏠 家庭' : '👥 好友'}
                  </button>
                ))}
                <button
                  style={{ padding: '6px 15px', borderRadius: '15px', border: '1px dashed #666', background: 'none', color: '#666', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  onClick={handleCreateGroup}
                >
                  + 创建群组
                </button>
              </div>

              {/* 第二排：痛感标签筛选 */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                {['全部', ...Object.values(PAIN_NAME_MAP)].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setPainFilter(tag === '全部' ? 'all' : tag)}
                    style={{
                      padding: '5px 12px', borderRadius: '15px', border: 'none', whiteSpace: 'nowrap',
                      // 区分"全部"和具体标签
                      background: (tag === '全部' ? painFilter === 'all' : painFilter === tag) ? '#d32f2f' : '#222',
                      color: '#fff', cursor: 'pointer', fontSize: '12px'
                    }}
                  >
                    {tag === '全部' ? '全部' : `${tag} (${posts.filter(p => p.painTags?.includes(tag)).length})`}
                  </button>
                ))}
              </div>
            </div>
            {/* 共鸣统计横幅 */}
            {(() => {
              const stats = getPainTagStats();
              const sortedPains = Object.entries(stats).sort((a, b) => b[1] - a[1]);
              const topPain = sortedPains.length > 0 ? sortedPains[0] : null;

              // ================= 阶段一：完全没有数据时的空状态 =================
              if (!topPain) {
                return (
                  <div style={{
                    background: 'rgba(255, 171, 64, 0.06)', // 换用暖橙色底
                    border: '1px solid rgba(255, 171, 64, 0.15)',
                    borderRadius: '10px',
                    padding: '15px',
                    marginBottom: '15px'
                  }}>
                    <p style={{ color: '#ffe0b2', fontSize: '13px', margin: 0, textAlign: 'center', lineHeight: '1.6' }}>
                      🌱 这里还有些安静，数据正在悄悄生长。
                    </p>
                    <p style={{ color: '#888', fontSize: '12px', margin: '8px 0 0 0', textAlign: 'center', lineHeight: '1.6' }}>
                      成为第一个留下足迹的人吧，你的分享就是照亮同路人的微光 ↓
                    </p>
                    <p style={{ color: '#5d4037', fontSize: '11px', margin: '10px 0 0 0', textAlign: 'center', fontStyle: 'italic' }}>
                      —— 或许，这也是大家的痛感正在慢慢变好的信号呢 🍀
                    </p>
                  </div>
                );
              }

              // ================= 阶段二：有数据时的正常显示 =================
              const realTotalCount = Object.values(stats).reduce((sum, count) => sum + count, 0);

              // 保底逻辑：如果真实人数少于5人，固定显示8人
              const displayCount = realTotalCount < 5 ? 8 : realTotalCount;

              // 优先显示真实最高频痛感，否则默认显示"坠痛"
              const displayPain = topPain[0] || "坠痛";

              return (
                <div style={{ background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '15px' }}>
                  <p style={{ color: '#ffcdd2', fontSize: '12px', margin: 0, textAlign: 'center' }}>
                    🌸 本周共 <strong style={{ color: '#ef9a9a' }}>{displayCount} 位</strong> 女性分享了她们的 <strong style={{ color: '#ef9a9a' }}>{displayPain}</strong> 经历
                  </p>
                  <p style={{ color: '#888', fontSize: '11px', margin: '4px 0 0 0', textAlign: 'center' }}>
                    她们中的许多人,也在这里留下了自己的缓解方法 ↓
                  </p>
                </div>
              );
            })()}


            {/* 帖子网格：限制图片高度，美化排版 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '80px' }}>

              {/* 使用 groupFilter 和 painFilter 进行双重交叉过滤 */}
              {posts.filter(p => {
                const matchGroup = groupFilter === 'all' || p.group === groupFilter;
                const matchPain = painFilter === 'all' || (p.painTags || []).includes(painFilter);
                return matchGroup && matchPain;
              }).map((post) => (
                <div key={post.id}
                  style={{ background: '#1c1c1c', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>

                  {/* 点击图片看详情 */}
                  <img src={post.img} onClick={() => setViewingPost(post)}
                    style={{ width: '100%', height: '110px', objectFit: 'cover', cursor: 'pointer', background: '#000' }} />

                  <div style={{ padding: '10px', flex: 1 }}>
                    <p style={{ color: '#fff', fontSize: '12px', margin: '0 0 8px 0', fontWeight: 'bold', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.text}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                      {/* 将 post.tags 改为 post.painTags 的第一项，防止报错 */}
                      <span style={{ color: '#d32f2f', fontSize: '10px', background: 'rgba(211,47,47,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        {post.painTags?.[0] || '未标记'}
                      </span>

                      <button style={{ background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); alert("共鸣已发送"); }}>
                        ❤️ {post.likes}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
        {/* --- History (疼痛日记：增强版分类折叠) --- */}
        {page === "history" && (
          <div style={{
            pointerEvents: 'auto',
            background: '#0a0a0a',
            width: '100vw',
            height: '100vh',
            overflowY: 'auto', // 核心修复：允许纵向滚动
            padding: '20px',
            boxSizing: 'border-box',
            WebkitOverflowScrolling: 'touch' // 优化 iOS 滚动手感
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10, paddingBottom: '10px' }}>
              <h2 style={{ color: '#fff', margin: 0 }}>📋 我的疼痛档案</h2>
              <button className="retry-btn" style={{ margin: 0, padding: '6px 15px', width: 'auto' }} onClick={() => setPage('onboarding')}>返回</button>
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', marginTop: '100px' }}>还没有记录，去画下第一张痛感图吧。</div>
            ) : (
              Object.entries(groupedHistory).map(([month, records]) => (
                <div key={month} style={{ marginBottom: '20px' }}>
                  {/* 月份标题头 - 点击切换折叠 */}
                  <div
                    onClick={() => toggleMonth(month)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 15px', background: '#1a1a1a', borderRadius: '10px',
                      borderLeft: '4px solid #d32f2f', cursor: 'pointer', marginBottom: '10px'
                    }}
                  >
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{month}</span>
                    <span style={{ color: '#666', fontSize: '12px' }}>
                      {records.length} 条记录 {collapsedMonths[month] ? '▼' : '▲'}
                    </span>
                  </div>

                  {/* 记录列表内容 - 受折叠状态控制 */}
                  {!collapsedMonths[month] && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {records.map(h => (
                        <div
                          key={h.id}
                          onClick={() => setViewingDiary(h)}
                          style={{
                            display: 'flex', alignItems: 'center', background: '#1c1c1c',
                            padding: '12px', borderRadius: '12px', border: '1px solid #333',
                            transition: 'transform 0.1s'
                          }}
                        >
                          <img src={h.img} style={{ width: '55px', height: '55px', borderRadius: '8px', background: '#000', objectFit: 'cover' }} />
                          <div style={{ marginLeft: '15px', flex: 1 }}>
                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{h.date}</div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                              {BRUSHES[h.type]?.label}
                            </div>
                          </div>
                          <span style={{ color: '#444' }}>›</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            {/* 留白底部，防止被遮挡 */}
            <div style={{ height: '100px' }}></div>
          </div>
        )}
        {/* 查看日记详情弹窗（增强版）*/}
        {viewingDiary && (
          <div
            style={{
              position: 'fixed',
              zIndex: 500,
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              boxSizing: 'border-box',
              overflow: 'hidden' // 完全隐藏滚动条
            }}
            onClick={() => setViewingDiary(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '400px',
                maxHeight: '90vh',
                overflowY: 'auto', // 保留滚动功能
                // 隐藏滚动条（Webkit浏览器）
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none', // IE和Edge
                '&::-webkit-scrollbar': {
                  display: 'none' // Chrome, Safari, Opera
                }
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 原有的图谱图片 */}
              <img
                src={viewingDiary.img}
                style={{ width: '100%', borderRadius: '12px', border: '1px solid #444' }}
                alt="diary"
              />

              {/* 痛觉元数据徽章行 */}
              {viewingDiary.meta && (
                <div style={{
                  display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px'
                }}>
                  {/* 颜色色块 */}
                  {viewingDiary.meta.colorPalette && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: 'rgba(255,255,255,0.07)', borderRadius: '12px',
                      padding: '3px 10px', fontSize: '11px', color: '#ccc'
                    }}>
                      <span style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: `rgb(${(PALETTES[viewingDiary.meta.colorPalette]?.color || [200, 50, 50]).join(',')})`,
                        display: 'inline-block'
                      }} />
                      {viewingDiary.meta.colorPalette === 'crimson' ? '深红·急性' :
                        viewingDiary.meta.colorPalette === 'dark' ? '暗灰·钝痛' :
                          viewingDiary.meta.colorPalette === 'purple' ? '紫·放射' : '冰蓝·发冷'}
                    </span>
                  )}
                  {/* 涂抹强度 */}
                  {viewingDiary.meta.painScore > 0 && (
                    <span style={{
                      background: 'rgba(211,47,47,0.15)', borderRadius: '12px',
                      padding: '3px 10px', fontSize: '11px', color: '#ffcdd2'
                    }}>
                      涂抹 {viewingDiary.meta.painScore} 次
                    </span>
                  )}
                  {/* 部位 */}
                  {viewingDiary.meta.bodyMode && viewingDiary.meta.bodyMode !== 'none' && (
                    <span style={{
                      background: 'rgba(76,175,80,0.12)', borderRadius: '12px',
                      padding: '3px 10px', fontSize: '11px', color: '#a5d6a7'
                    }}>
                      {viewingDiary.meta.bodyMode === 'front' ? '腹部正面' :
                        viewingDiary.meta.bodyMode === 'back' ? '腰骶背面' : '正背双侧'}
                    </span>
                  )}
                  {/* 主笔触 */}
                  {viewingDiary.meta.brushCounts && (() => {
                    const counts = viewingDiary.meta.brushCounts;
                    const max = Math.max(...Object.values(counts));
                    if (max === 0) return null;
                    const top = Object.keys(counts).find(k => counts[k] === max);
                    return (
                      <span style={{
                        background: 'rgba(255,152,0,0.12)', borderRadius: '12px',
                        padding: '3px 10px', fontSize: '11px', color: '#ffe082'
                      }}>
                        主导 {BRUSHES[top]?.icon} {BRUSHES[top]?.label.split(' ')[1]}
                      </span>
                    );
                  })()}
                </div>
              )}

              <h3 style={{ color: '#fff', marginTop: '20px', marginBottom: '10px' }}>
                {viewingDiary.date} {viewingDiary.time}
                <span style={{
                  marginLeft: '12px',
                  color: '#d32f2f',
                  fontSize: '16px',
                  background: 'rgba(211, 47, 47, 0.15)',
                  padding: '4px 12px',
                  borderRadius: '12px'
                }}>
                  {viewingDiary.icon} {viewingDiary.painName}
                </span>
              </h3>

              {/* 痛觉通感描述 */}
              <div style={{
                background: 'rgba(28,28,28,0.9)',
                padding: '18px',
                borderRadius: '12px',
                marginTop: '10px',
                border: '1px solid #444'
              }}>
                <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px 0' }}>
                  {viewingDiary.content?.analogy}
                </p>
                <p style={{ color: '#4caf50', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                  {viewingDiary.content?.selfCare}
                </p>
              </div>
              {/* 用户补充信息 - 自由文本，无数字 */}
              <div style={{
                background: 'rgba(28,28,28,0.9)',
                padding: '18px',
                borderRadius: '12px',
                marginTop: '15px',
                border: '1px solid #444'
              }}>
                <h4 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '14px' }}>
                  📝 记录你的感受
                </h4>
                <p style={{ color: '#888', fontSize: '11px', marginBottom: '15px', fontStyle: 'italic' }}>
                  「语言在痛苦面前总是匮乏的，但每一种描述都是真实的。」
                </p>

                {/* 持续时间 - 自由文本输入 */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                    ⏱️ 这种感觉持续了...
                  </label>
                  <input
                    type="text"
                    placeholder="例如：整个下午 / 断断续续几个小时 / 到晚上才缓解"
                    defaultValue={viewingDiary.duration || ''}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val) updateRecordInfo(viewingDiary.id, 'duration', val);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#111',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: '8px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* 缓解方式 - 自由选择或输入 */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                    🌿 什么让你感觉好一些？
                  </label>
                  <input
                    type="text"
                    list="relief-options"
                    placeholder="例如：蜷缩起来 / 热敷 / 安静独处..."
                    defaultValue={viewingDiary.reliefMethod || ''}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val) updateRecordInfo(viewingDiary.id, 'reliefMethod', val);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#111',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: '8px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <datalist id="relief-options">
                    <option value="蜷缩侧卧，抱紧膝盖" />
                    <option value="热敷小腹或后腰" />
                    <option value="安静独处，不被打扰" />
                    <option value="有人陪伴，握着我的手" />
                    <option value="听白噪音或轻音乐" />
                    <option value="喝热水或热饮" />
                    <option value="垫高臀部平躺" />
                    <option value="轻轻按摩腹部" />
                  </datalist>
                </div>

                {/* 自由备注 */}
                <div>
                  <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                    📓 想记录的其他感受
                  </label>
                  <textarea
                    placeholder="任何你想说的话...疼痛是真实存在的，不需要被证明。"
                    defaultValue={viewingDiary.notes || ''}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val) updateRecordInfo(viewingDiary.id, 'notes', val);
                    }}
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '10px',
                      background: '#111',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: '8px',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              {/* 操作按钮区 - 优化后的布局 */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '20px',
                borderRadius: '12px',
                marginTop: '20px',
                border: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
              }}>
                {/* 分享语境选择器 */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#888', fontSize: '12px', marginBottom: '12px' }}>选择分享语境：</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {['partner', 'work', 'doctor', 'self'].map(tab => (
                      <button
                        key={tab}
                        onClick={(e) => { e.stopPropagation(); setDiaryShareIdentity(tab); }}
                        style={{
                          flex: 1, padding: '10px 0', fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          background: diaryShareIdentity === tab ? '#d32f2f' : '#222',
                          color: diaryShareIdentity === tab ? '#fff' : '#888',
                          minWidth: '60px'
                        }}
                      >
                        {{ partner: '伴侣', work: '请假', doctor: '医生', self: '自愈' }[tab]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 底部操作按钮 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '25px',
                      background: '#4caf50',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareContent({
                        ...viewingDiary.content,
                        identity: diaryShareIdentity,
                        historyImg: viewingDiary.img,
                        pain: viewingDiary.painName
                      });
                      setShowSharePreview(true);
                      setViewingDiary(null);
                    }}
                  >
                    📤 分享
                  </button>

                  <button
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '25px',
                      background: 'rgba(167, 119, 224, 0.99)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setImgUrl(viewingDiary.img);
                      setShowPostModal(true);
                      setViewingDiary(null);
                    }}
                  >
                    🌐 发布
                  </button>
                </div>

                <button
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '25px',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setViewingDiary(null)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}


        {/* 帖子详情弹窗 (Modal) */}
        {viewingPost && (
          <div style={{ position: 'fixed', zIndex: 1000, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.98)', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }} onClick={() => setViewingPost(null)}>
            <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }} onClick={e => e.stopPropagation()}>
              {/* 顶部操作 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>PainScape 具身证据</span>
                <button onClick={() => setViewingPost(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px' }}>✕</button>
              </div>

              {/* 大图 */}
              <img src={viewingPost.img} style={{ width: '100%', borderRadius: '15px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />

              {/* 描述与分析 */}
              <div style={{ marginTop: '20px' }}>
                <p style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', lineHeight: '1.4' }}>
                  “{viewingPost.text}”
                </p>

                {/* AI 痛觉分析 */}
                <div style={{ background: '#111', padding: '15px', borderRadius: '12px', marginTop: '15px', borderLeft: '4px solid #d32f2f' }}>
                  <h4 style={{ color: '#d32f2f', margin: '0 0 8px 0', fontSize: '13px' }}>🤖 AI 痛觉分析：</h4>
                  <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6' }}>
                    {viewingPost.analogy || "根据图像特征，该痛感呈现典型的机械性收缩特征，伴随局部组织的深度压迫感。"}
                  </p>
                </div>

                {/* 她的自愈经验 / 亲历经验 区块 */}
                <div style={{ background: 'rgba(76, 175, 80, 0.05)', padding: '15px', borderRadius: '12px', marginTop: '15px', borderLeft: '4px solid #4caf50' }}>
                  <h4 style={{ color: '#4caf50', margin: '0 0 8px 0', fontSize: '13px' }}>🌿 她的自愈经验：</h4>

                  {/* 如果有亲历经验，优先展示亲历经验 */}
                  {viewingPost.userExperience ? (
                    <div style={{ background: 'rgba(76,175,80,0.1)', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #4caf50' }}>
                      <p style={{ color: '#a5d6a7', fontSize: '12px', fontWeight: 'bold', margin: '0 0 6px 0' }}>
                        💬 她的亲历经验
                      </p>
                      <p style={{ color: '#ccc', fontSize: '12px', margin: 0 }}>{viewingPost.userExperience}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                        {(viewingPost.experienceTags || []).map(tag => (
                          <span key={tag} style={{ background: 'rgba(76,175,80,0.2)', color: '#4caf50', padding: '2px 8px', borderRadius: '10px', fontSize: '10px' }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // 没有亲历经验时降级显示
                    <>
                      <p style={{ color: '#888', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                        {viewingPost.reliefExperience || "暂无自愈经验，等待过来人分享..."}
                      </p>
                      {/* 补充经验入口按钮 */}
                      <button
                        style={{ marginTop: '12px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #4caf50', color: '#4caf50', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
                        onClick={() => setShowExpInput(true)} // 改为控制状态展示输入框，不再用 prompt
                      >
                        + 补充我的缓解经验（帮助后来者少走弯路）
                      </button>
                    </>
                  )}
                </div>

                {/* 内联经验输入框 */}
                {showExpInput && (
                  <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '12px', marginTop: '12px', border: '1px solid #333' }}>
                    <textarea
                      placeholder="分享你的缓解经验（她们在等你的答案）"
                      style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '8px', padding: '10px', fontSize: '13px', minHeight: '80px', resize: 'none' }}
                      value={expText}
                      onChange={e => setExpText(e.target.value)}
                    />
                    <input
                      placeholder="针对的症状（如：绞痛，坠痛，用逗号分隔）"
                      style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '8px', padding: '10px', fontSize: '13px', marginTop: '8px' }}
                      value={expTags}
                      onChange={e => setExpTags(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button
                        style={{ flex: 1, padding: '8px', background: '#333', color: '#aaa', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={() => setShowExpInput(false)}
                      >取消</button>
                      <button
                        style={{ flex: 1, padding: '8px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={handleSaveExperience} // 抽离保存逻辑
                      >发布经验</button>
                    </div>
                  </div>
                )}
              </div>


              {/* 底部互动 */}
              <button
                style={{ background: 'none', border: 'none', color: post.hasUserHugged ? '#d32f2f' : '#888', fontSize: '12px', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPosts(prev => prev.map(p =>
                    p.id === post.id
                      ? { ...p, hugs: p.hugs + (p.hasUserHugged ? -1 : 1), hasUserHugged: !p.hasUserHugged }
                      : p
                  ));
                }}
              >
                🤗 {post.hugs}
              </button>
              <button onClick={() => {
                setPosts(prev => prev.map(p =>
                  p.id === viewingPost.id ? { ...p, hugs: p.hugs + 1 } : p
                ));
                setViewingPost(vp => ({ ...vp, hugs: (vp.hugs || 0) + 1 }));
                // 短暂显示"已送达"视觉反馈
                alert("🤗 抱抱已送达");
              }}>❤️ 给她一个抱抱</button>
            </div>
          </div>
        )}
        {showPostModal && (
          <div style={{
            position: 'fixed', zIndex: 500, top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', padding: '20px', boxSizing: 'border-box'
          }}>
            <div style={{
              background: '#1c1c1c', padding: '24px', borderRadius: '20px', width: '100%',
              maxWidth: '380px', border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)' // 增加立体感
            }}>

              {/* 标题区 */}
              <h3 style={{ color: '#fff', marginTop: 0, fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
                💌 留下你的印记
              </h3>

              {/* 重新润色的引导语 */}
              <div style={{
                background: 'rgba(255, 152, 0, 0.06)', // 改用更温暖的橙色调
                border: '1px solid rgba(255, 152, 0, 0.15)',
                borderRadius: '12px', padding: '12px 14px', marginBottom: '16px'
              }}>
                <p style={{ color: '#ffcc80', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                  💡 你此刻的感受，也许正是她人在长夜里寻找的共鸣。<br />
                  发布后，还可以补充一条"缓解经验"，告诉姐妹们你是怎么撑过来的。
                </p>
              </div>

              {/* 图片预览区 */}
              {imgUrl && (
                <div style={{ marginBottom: '15px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
                  <img src={imgUrl} style={{ width: '100%', display: 'block' }} alt="preview" />
                </div>
              )}

              {/* 输入框优化 */}
              <textarea
                value={postText}
                onChange={e => setPostText(e.target.value)}
                placeholder="写点什么吧，吐槽也好，倾诉也好，这里懂你……"
                style={{
                  width: '100%', height: '100px', background: '#111', color: '#fff',
                  border: '1px solid #333', borderRadius: '12px', padding: '14px',
                  boxSizing: 'border-box', marginBottom: '20px', fontSize: '14px',
                  lineHeight: '1.5', resize: 'none',
                  outline: 'none' // 去除点击时的黑框
                }}
              />

              {/* 按钮组优化 */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  style={{
                    flex: 1, padding: '12px', background: '#2a2a2a', color: '#999',
                    border: 'none', borderRadius: '12px', cursor: 'pointer',
                    fontSize: '14px', fontWeight: 'bold'
                  }}
                  onClick={() => setShowPostModal(false)}
                >
                  再想想
                </button>
                <button
                  style={{
                    flex: 1, padding: '12px', background: 'linear-gradient(135deg, #ff9800, #f44336)',
                    color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer',
                    fontSize: '14px', fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(244, 67, 54, 0.3)' // 按钮发光
                  }}
                  onClick={handlePublishPost}
                >
                  发送共鸣
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 分享预览弹窗 */}
        {showSharePreview && shareContent && (
          <div style={{
            position: 'fixed',
            zIndex: 600,
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflowY: 'auto',
              background: '#1c1c1c',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid #444'
            }}>
              <h3 style={{ color: '#fff', margin: '0 0 15px 0', textAlign: 'center' }}>
                📤 分享预览
              </h3>

              {/* --- 修改预览说明逻辑 --- */}
              <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', marginBottom: '15px' }}>
                {shareContent.historyImg ? '疼痛档案回顾' : (
                  (!pgFrontRef.current) ? '加载中...' :
                    (isSideEmpty('front') && isSideEmpty('back') ? '暂无绘画内容' : '实时绘画预览')
                )}
              </p>

              {/* --- 修改缩略图显示逻辑 --- */}
              <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={shareContent.historyImg || imgUrl}  // 核心修改：优先使用历史图片
                  style={{ width: '100%', maxWidth: '300px', borderRadius: '8px', border: '1px solid #444' }}
                  alt="预览"
                />
              </div>

              {/* 文字预览 - 根据身份显示 */}
              {(() => {
                const getPreviewText = () => {
                  switch (shareContent.identity) {
                    case 'partner':
                      return {
                        title: '通感说明书',
                        content: shareContent.analogy?.slice(0, 80) + '...'
                      };
                    case 'work':
                      return {
                        title: '不可见痛苦声明',
                        content: shareContent.workText?.slice(0, 80) + '...'
                      };
                    case 'doctor':
                      return {
                        title: '医疗辅助报告',
                        // 【关键修改】：这里要对应 med_complaint
                        content: (shareContent.med_complaint || "已记录具身痛觉图谱")?.slice(0, 80) + '...'
                      };
                    case 'self':
                      return {
                        title: '自愈建议',
                        // 【关键修改】：这里要对应 selfCare
                        content: shareContent.selfCare?.slice(0, 80) + '...'
                      };
                    default:
                      return {
                        title: '状态声明',
                        content: `正在经历 ${shareContent.pain}`
                      };
                  }
                };

                const previewText = getPreviewText();
                return (
                  <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    padding: '15px',
                    marginBottom: '20px'
                  }}>
                    <p style={{ color: '#ff9800', fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
                      {previewText.title}
                    </p>
                    <p style={{ color: '#ccc', fontSize: '13px', margin: 0 }}>
                      {previewText.content}
                    </p>
                  </div>
                );
              })()}

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '25px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid #555',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  onClick={() => setShowSharePreview(false)}
                >
                  取消
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '25px',
                    background: '#4caf50',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  onClick={confirmShare}
                >
                  确认分享
                </button>
              </div>
            </div>
          </div>
        )}
        {/* --- 全局 Loading 遮罩层 --- */}
        {isLoading && (
          <div style={{
            position: 'fixed', zIndex: 9999, top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)',
              borderTop: '3px solid #d32f2f', borderRadius: '50%',
              animation: 'spin 1s linear infinite' // 这里用一段简单的内联动画
            }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#fff', marginTop: '20px', letterSpacing: '2px' }}>AI 医疗助理转译中...</p>
            <p style={{ color: '#666', fontSize: '12px' }}>正在基于您的痛觉参数生成多语境报告</p>
            <p style={{ color: '#666', fontSize: '12px' }}>
              首次请求可能需要 30-60 秒唤醒服务器，请耐心等待
            </p>
          </div>
        )}
      </div>
    </>
  );
}
export default App;