import React, { useState, useRef, useEffect } from "react";
import Sketch from "react-p5";

// === 配置区 ===
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

// === 粒子类 (v5) ===
class PainParticle {
  // 【新增 heading 参数，获取手指滑动的真实方向】
  constructor(p5, x, y, type, color, speed, heading) {
    this.p5 = p5; this.pos = p5.createVector(x, y);
    this.type = type; this.color = color;
    this.life = 255; this.seed = p5.random(1000);
    this.isDynamic = (type === 'wave' || type === 'twist');

    if (type === 'pierce') {
      // 不再发散！顺着滑动的方向直愣愣扎进去
      // 限制偏转角在极其狭窄的范围内 (p5.random(-0.15, 0.15))
      let angle = heading + p5.random(-0.15, 0.15);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      this.vel.mult(p5.random(8, 18)); // 短促、极快的扎入速度
      this.size = p5.random(1, 3); // 钻头/针尖的粗细
    }
    else if (type === 'heavy') {
      this.vel = p5.createVector(p5.random(-0.2, 0.2), p5.random(0.5, 1.5));
      this.size = p5.random(2, 4);
    }
    else if (type === 'twist') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(10, 25); this.angle = p5.random(p5.TWO_PI);
    }
    else if (type === 'wave') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(5, 15); this.maxSize = p5.random(30, 60);
    }
    else if (type === 'scrape') {
      // 刮撕也顺着滑动方向
      let angle = heading + p5.random(-0.25, 0.25);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      this.vel.mult(p5.random(2, 6));
    }
  }

  update(p5) {
    this.pos.add(this.vel);
    if (this.type === 'twist') {
      this.angle += 0.05; this.size *= 0.99;
      if(this.size < 2) this.life = 0;
    }
    else if (this.type === 'heavy') { this.life -= 4; this.vel.y += 0.3; }
    else if (this.type === 'wave') { this.pulseSize = this.size + p5.sin(p5.frameCount * 0.05 + this.seed) * (this.maxSize - this.size); }
    else if (this.type === 'scrape') { this.life -= 15; this.vel.mult(0.9); }
    else { this.life -= 20; } // pierce 瞬间扎入，消失极快
  }

  show(pg) {
    let p = pg || this.p5;

    // 【核心滤镜隔离】：只有重压、胀气、绞痛需要发光发糊。
    // 刺钻和刮撕必须极其锐利，绝不能加 shadowBlur！
    if (this.type === 'wave' || this.type === 'heavy' || this.type === 'twist') {
      p.drawingContext.shadowBlur = 15;
      p.drawingContext.shadowColor = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
    } else {
      p.drawingContext.shadowBlur = 0; // 关闭发光，保持锐利
    }

    if (this.type === 'pierce') {
      // 【直刺特效】：冰冷、锐利的一刀扎入
      p.stroke(255, 255, 255, 220); // 针身是高亮的白色
      p.strokeWeight(this.size * 0.6); // 极细
      p.line(this.pos.x, this.pos.y, this.pos.x + this.vel.x, this.pos.y + this.vel.y);

      // 末端带有深色的血孔/钻孔
      p.noStroke();
      p.fill(this.color[0]*0.5, 0, 0, 255);
      p.ellipse(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.size * 1.5, this.size * 1.5);
    }
    else if (this.type === 'heavy') {
      p.noStroke(); p.fill(this.color[0]*0.5, this.color[1]*0.5, this.color[2]*0.5, 150); p.ellipse(this.pos.x, this.pos.y, this.size, this.size * 2);
    }
    else if (this.type === 'twist') {
      p.push(); p.translate(this.pos.x, this.pos.y); p.rotate(this.angle);
      p.stroke(this.color[0], this.color[1], this.color[2], 180); p.strokeWeight(1.5);
      for(let i=0; i<6; i++) p.line(0, 0, this.size * p.cos(i * p.PI/3), this.size * p.sin(i * p.PI/3));
      p.noStroke(); p.fill(this.color[0], this.color[1], this.color[2], 200); p.ellipse(0, 0, this.size * 0.3); p.pop();
    }
    else if (this.type === 'wave') {
      p.noStroke(); p.fill(this.color[0], this.color[1], this.color[2], 12); p.ellipse(this.pos.x, this.pos.y, this.pulseSize, this.pulseSize);
      p.fill(this.color[0], this.color[1], this.color[2], 30); p.ellipse(this.pos.x, this.pos.y, this.pulseSize * 0.5, this.pulseSize * 0.5);
    }
    else if (this.type === 'scrape') {
      // 【彻底去糊的刮肉感】：多条平行错落的锐利直线
      p.stroke(this.color[0], this.color[1]*0.5, this.color[2]*0.5, 255);
      p.strokeWeight(p.random(0.5, 2)); // 极细极锐利

      let angle = this.vel.heading();
      let len = p.random(10, 30);
      let endX = this.pos.x + p.cos(angle)*len;
      let endY = this.pos.y + p.sin(angle)*len;

      // 主刮痕
      p.line(this.pos.x, this.pos.y, endX, endY);

      // 平行的辅刮痕，模拟皮肉撕裂的“丝丝缕缕”
      if (p.random(1) > 0.4) {
        let offset = p.random(-4, 4);
        p.stroke(this.color[0]-60, 0, 0, 180); // 更暗的血痕
        p.line(this.pos.x + offset, this.pos.y + offset, endX + offset, endY + offset);
      }

      // 末端的碎肉渣 (锐角三角形)
      if (p.random(1) < 0.3) {
        p.noStroke();
        p.fill(this.color[0]*0.8, 0, 0, 255);
        p.triangle(endX, endY, endX+p.random(-4,4), endY+p.random(-4,4), endX+p.random(-4,4), endY+p.random(-4,4));
      }
    }

    p.drawingContext.shadowBlur = 0; // 统一重置发光
  }
  isDead() { return this.life < 0; }
}

function App() {
  const [page, setPage] = useState("onboarding");
  const [activeBrush, setActiveBrush] = useState(null);
  const [activeColor, setActiveColor] = useState("crimson");
  const [identity, setIdentity] = useState("partner");
  const [userPrefs, setUserPrefs] = useState(["care"]);
  const [imgUrl, setImgUrl] = useState(null);

  const [bodyMode, setBodyMode] = useState('front');

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('painscape_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [posts, setPosts] = useState([
    { id: 1, text: "痛得下不了床，感觉像洗衣机在肚子里转...", img: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200&auto=format&fit=crop", tags: "#绞痛 #冷汗", likes: 128 },
    { id: 2, text: "腰快断了，一直有很重的下坠感。", img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop", tags: "#下坠感 #无法站立", likes: 85 },
    { id: 3, text: "吃布洛芬都没用，像有人拿刀在刮...", img: "https://images.unsplash.com/photo-1508163223045-1880bc36e222?q=80&w=200&auto=format&fit=crop", tags: "#撕裂感 #绝望", likes: 342 }
  ]);
  const [postText, setPostText] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);

  const brushCounts = useRef({ twist: 0, pierce: 0, heavy: 0, wave: 0, scrape: 0 });
  const staticParticles = useRef([]);
  const dynamicParticles = useRef([]);

  const p5Ref = useRef(null);
  const bgFrontRef = useRef(null);
  const bgBackRef = useRef(null);
  const pgRef = useRef(null);
  const camRef = useRef({ x: 0, y: 0, zoom: 1.2 });

  const pressTimer = useRef(0);
  const isLongPressing = useRef(false);

  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const hasSavedInitial = useRef(false);

  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener("contextmenu", preventDefault);
    return () => document.removeEventListener("contextmenu", preventDefault);
  }, []);

  const preload = (p5) => {
    bgFrontRef.current = p5.loadImage("body_front.png", () => {}, () => { console.log("缺失 body_front.png") });
    bgBackRef.current = p5.loadImage("body_back.png", () => {}, () => { console.log("缺失 body_back.png") });
  };

  const captureState = () => {
    if (!pgRef.current) return null;
    return { img: pgRef.current.get(), dynamic: [...dynamicParticles.current] };
  };

  const setup = (p5, canvasParentRef) => {
    p5Ref.current = p5;
    p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
    pgRef.current = p5.createGraphics(window.innerWidth * 2, window.innerHeight * 2);
    camRef.current.x = -window.innerWidth / 2;
    camRef.current.y = -window.innerHeight / 4;

    if(!hasSavedInitial.current) {
      undoStackRef.current.push(captureState());
      hasSavedInitial.current = true;
    }
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
    if (state) {
      undoStackRef.current.push(state);
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
      redoStackRef.current = [];
    }
  };

  const handleUndo = () => {
    if (undoStackRef.current.length > 1) {
      redoStackRef.current.push(captureState());
      undoStackRef.current.pop();
      let prevState = undoStackRef.current[undoStackRef.current.length - 1];
      pgRef.current.clear(); pgRef.current.image(prevState.img, 0, 0);
      dynamicParticles.current = [...prevState.dynamic]; staticParticles.current = [];
    }
  };

  const handleRedo = () => {
    if (redoStackRef.current.length > 0) {
      undoStackRef.current.push(captureState());
      let nextState = redoStackRef.current.pop();
      pgRef.current.clear(); pgRef.current.image(nextState.img, 0, 0);
      dynamicParticles.current = [...nextState.dynamic]; staticParticles.current = [];
    }
  };

  const handleClear = () => {
    undoStackRef.current.push(captureState()); redoStackRef.current = [];
    pgRef.current.clear(); dynamicParticles.current = []; staticParticles.current = [];
  };

  const mouseWheel = (p5, event) => {
    if(page !== 'canvas') return false;
    let zoomAmount = event.delta > 0 ? -0.1 : 0.1;
    camRef.current.zoom = Math.max(0.5, Math.min(camRef.current.zoom + zoomAmount, 3.0));
    return false;
  };

  const draw = (p5) => {
    p5.background(0);
    let { x, y, zoom } = camRef.current;
    let isInteracting = (p5.mouseIsPressed || p5.touches.length > 0) && isSafeToDraw(p5);

    let realX = (p5.mouseX - x) / zoom, realY = (p5.mouseY - y) / zoom;
    let realPx = (p5.pmouseX - x) / zoom, realPy = (p5.pmouseY - y) / zoom;

    let velX = realX - realPx;
    let velY = realY - realPy;
    let speed = p5.dist(realX, realY, realPx, realPy);

    // 【捕获滑动方向】：如果只点击不滑动，则默认垂直向下扎入
    let heading = (speed < 1) ? p5.PI / 2 : p5.atan2(velY, velX);

    if (!isInteracting) {
      pressTimer.current = 0; isLongPressing.current = false;
    } else {
      if (speed < 1) pressTimer.current++; else pressTimer.current = 0;
      if (pressTimer.current > 20) isLongPressing.current = true;
    }

    let isPanning = (activeBrush === null) || isLongPressing.current || p5.mouseButton === p5.RIGHT || p5.touches.length >= 2;

    if (isInteracting) {
      if (isPanning) {
        camRef.current.x += p5.mouseX - p5.pmouseX; camRef.current.y += p5.mouseY - p5.pmouseY;
      } else if (activeBrush === 'eraser') {
        pgRef.current.erase(); pgRef.current.ellipse(realX, realY, 40 / zoom, 40 / zoom); pgRef.current.noErase();
        dynamicParticles.current = dynamicParticles.current.filter(p => p5.dist(p.pos.x, p.pos.y, realX, realY) > 20);
      } else {
        brushCounts.current[activeBrush] += 1;
        if (p5.frameCount % 2 === 0 || speed > 10) {
          // 【传入 heading 参数，供刺钻和刮撕使用】
          let pObj = new PainParticle(p5, realX, realY, activeBrush, PALETTES[activeColor].color, speed, heading);
          if (pObj.isDynamic) {
            dynamicParticles.current.push(pObj);
            if (dynamicParticles.current.length > 150) dynamicParticles.current.shift();
          } else { staticParticles.current.push(pObj); }
        }
      }
    }

    let pg = pgRef.current;
    for (let i = staticParticles.current.length - 1; i >= 0; i--) {
      let p = staticParticles.current[i];
      p.update(p5); p.show(pg);
      if (p.isDead()) staticParticles.current.splice(i, 1);
    }

    p5.push(); p5.translate(x, y); p5.scale(zoom);

    let activeImg = null;
    if (bodyMode === 'front' && bgFrontRef.current) activeImg = bgFrontRef.current;
    if (bodyMode === 'back' && bgBackRef.current) activeImg = bgBackRef.current;

    if (activeImg) {
      p5.imageMode(p5.CENTER); p5.tint(255, 40);
      let imgScale = (p5.height * 0.9) / activeImg.height;
      p5.image(activeImg, p5.width/2, p5.height/2, activeImg.width * imgScale, activeImg.height * imgScale);
    }

    p5.noTint(); p5.imageMode(p5.CORNER); p5.image(pg, 0, 0);

    for (let i = dynamicParticles.current.length - 1; i >= 0; i--) {
      let dp = dynamicParticles.current[i];
      dp.update(p5); dp.show(p5);
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
        const response = await fetch(" https://among-showpiece-rush.ngrok-free.dev/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json",
        // Ngrok 免费版有时候会有一个警告页，加上下面这行 Header 可以绕过它：
        "ngrok-skip-browser-warning": "true" },
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

      {page === "onboarding" && (
        <div className="onboarding-container" style={{position:'absolute', zIndex:100, background:'#0a0a0a', padding: '30px', textAlign: 'center', overflowY:'auto'}}>
          <h1 style={{marginBottom:'5px', letterSpacing:'4px'}}>PainScape</h1>
          <p style={{marginBottom:'30px', fontSize:'0.9rem', color:'#aaa'}}>拒绝隐忍，让疼痛被看见</p>

          <div style={{width:'100%', maxWidth:'320px', textAlign:'left'}}>
            <label style={{color:'#fff', marginBottom:'5px', display:'block', fontSize:'1.1rem', fontWeight:'bold'}}>
              当痛经发作时，你最需要伴侣/家人怎么做？
            </label>
            <p style={{color:'#777', fontSize:'12px', marginTop:0, marginBottom:'15px'}}>* 可多选复合需求</p>

            <div className="pref-group" style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <button className={`pref-btn ${userPrefs.includes('alone')?'active':''}`} onClick={()=>togglePref('alone')} style={{padding:'15px', borderRadius:'12px', textAlign:'left', background:'#222', border: userPrefs.includes('alone')?'2px solid #d32f2f':'1px solid #444', color:'#fff'}}>
                <div style={{fontSize:'15px', fontWeight:'bold'}}>🛑 别管我，让我一个人待着</div>
                <div style={{fontSize:'12px', color:'#888', marginTop:'5px'}}>只需备好药和水，禁止频繁打扰</div>
              </button>
              <button className={`pref-btn ${userPrefs.includes('care')?'active':''}`} onClick={()=>togglePref('care')} style={{padding:'15px', borderRadius:'12px', textAlign:'left', background:'#222', border: userPrefs.includes('care')?'2px solid #d32f2f':'1px solid #444', color:'#fff'}}>
                <div style={{fontSize:'15px', fontWeight:'bold'}}>🥣 我没力气，需要实际照顾</div>
                <div style={{fontSize:'12px', color:'#888', marginTop:'5px'}}>冲热饮、揉腰、包揽家务</div>
              </button>
              <button className={`pref-btn ${userPrefs.includes('comfort')?'active':''}`} onClick={()=>togglePref('comfort')} style={{padding:'15px', borderRadius:'12px', textAlign:'left', background:'#222', border: userPrefs.includes('comfort')?'2px solid #d32f2f':'1px solid #444', color:'#fff'}}>
                <div style={{fontSize:'15px', fontWeight:'bold'}}>🫂 我很脆弱，需要情绪陪伴</div>
                <div style={{fontSize:'12px', color:'#888', marginTop:'5px'}}>安静陪着我，握着手提供安全感</div>
              </button>
            </div>
          </div>

          <button style={{marginTop:'35px', width:'100%', maxWidth:'320px', padding:'16px', background:'#d32f2f', color:'#fff', border:'none', borderRadius:'25px', fontSize:'16px', fontWeight:'bold', cursor:'pointer'}}
            onClick={() => { pgRef.current.clear(); dynamicParticles.current=[]; staticParticles.current=[]; setPage("canvas"); }}>
            🎨 开始绘制今日痛感
          </button>

          <div style={{display:'flex', gap:'15px', marginTop:'15px', width:'100%', maxWidth:'320px'}}>
             <button style={{flex:1, padding:'14px', background:'#222', color:'#ccc', border:'1px solid #444', borderRadius:'20px', fontSize:'14px', cursor:'pointer'}} onClick={() => setPage("community")}>
              🌍 探索社群
            </button>
            <button style={{flex:1, padding:'14px', background:'#222', color:'#ccc', border:'1px solid #444', borderRadius:'20px', fontSize:'14px', cursor:'pointer'}} onClick={() => setPage("history")}>
              📅 疼痛日记
            </button>
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
    </>
  );
}

export default App;