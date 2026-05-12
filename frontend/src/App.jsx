import React, { useState, useRef, useEffect } from "react";
import Sketch from "react-p5";
import { I18nProvider, useI18n } from "./i18n/i18nContext";
// 导入翻译文件中的常量和映射（用于动态内容）
import { PAIN_NAME_MAP, BRUSHES, PALETTES, EXAM_DATABASE, QUOTES } from "./i18n/translationsConstants";
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <h1 style={{ color: '#fff', textAlign: 'center' }}>页面出了点小问题，请刷新重试</h1>;
    return this.props.children;
  }
}
// === 粒子引擎 (重构重力悬停、动态呼吸) ===
class PainParticle {
  constructor(p5, x, y, type, color, speed, heading, bodyMode, pressure = 0.5) {
    this.p5 = p5;
    this.pos = p5.createVector(x, y);
    this.baseY = y; // 记录初始位置，用于重压的向下脉动
    this.type = type;
    this.color = color;
    this.life = 255;
    this.seed = p5.random(1000);
    this.bodyMode = bodyMode; // 记录画在哪一面
    // 压感系数 (0.2 ~ 1.0)
    this.pressureScale = pressure;
    // 【修改】：坠痛现在是动态粒子，永远呼吸
    this.isDynamic = (type === 'wave' || type === 'twist' || type === 'heavy');
    // 【新增】：记录绘画时的绝对时间与一天中的分钟数
    const now = new Date();
    this.drawnAt = now.getTime();
    this.minuteOfDay = now.getHours() * 60 + now.getMinutes();

    if (type === 'pierce') {
      let angle = heading + p5.random(-0.1, 0.1);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      // 【修改】：重按刺得更深，轻点刺得浅
      this.vel.mult(p5.random(6, 18) * (0.5 + pressure));
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
      this.vel = p5.createVector(0, 0);
      // 【修改】：重按水滴更大，轻按水滴小（坠痛程度）
      this.size = p5.random(8, 15) * (0.5 + pressure);
    } else if (type === 'twist') {
      this.vel = p5.createVector(0, 0);
      // 【修改】：重按绞拧范围更大
      this.size = p5.random(15, 30) * (0.5 + pressure);
      this.angle = p5.random(p5.TWO_PI);
    } else if (type === 'wave') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(5, 15);
      // 【修改】：重按胀痛扩散上限更高
      this.maxSize = p5.random(30, 60) * (0.5 + pressure);
    } else if (type === 'scrape') {
      let angle = p5.PI / 4 + p5.random(-0.15, 0.15);
      this.vel = p5.createVector(p5.cos(angle), p5.sin(angle));
      // 【修改】：重按刮撕距离更长
      this.vel.mult(p5.random(15, 30) * (0.5 + pressure));
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
    // 【修改】：利用压感动态调整发光模糊度，重按时光晕更强烈
    if (this.isDynamic) {
      p.drawingContext.shadowBlur = 10 * this.pressureScale;
      p.drawingContext.shadowColor = `rgb(${this.color[0]},${this.color[1]}, ${this.color[2]})`;
    } else {
      p.drawingContext.shadowBlur = 0;
    }
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
      p.fill(255, 255, 255, 150 + (105 * this.pressureScale)); // 轻点半透，重按全白
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
      // 【修改】：重按水滴更不透明，颜色更深沉
      p.fill(this.color[0] * 0.5, this.color[1] * 0.5, this.color[2] * 0.5, 120 + (80 * this.pressureScale));
      p.beginShape();
      p.vertex(this.pos.x, this.pos.y - this.size * 0.8);
      p.bezierVertex(this.pos.x + this.size, this.pos.y, this.pos.x + this.size, this.pos.y + this.size * 1.5, this.pos.x, this.pos.y + this.size * 1.5);
      p.bezierVertex(this.pos.x - this.size, this.pos.y + this.size * 1.5, this.pos.x - this.size, this.pos.y, this.pos.x, this.pos.y - this.size * 0.8);
      p.endShape(p.CLOSE);
    }
    else if (this.type === 'scrape') {
      // 主线条 + 乱序纤维 + 三角血块
      let endX = this.pos.x + this.vel.x; let endY = this.pos.y + this.vel.y;
      p.stroke(this.color[0] * 0.5, 0, 0, 255); p.strokeWeight(this.size); p.line(this.pos.x, this.pos.y, endX, endY);
      p.stroke(this.color[0], this.color[1] * 0.3, this.color[2] * 0.3, 180); p.strokeWeight(1);
      // 【修改】：重按刮痕更粗更红
      p.strokeWeight(this.size * (0.5 + this.pressureScale));
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
      // 【修改】：绞拧中心点随压感变深红
      p.fill(this.color[0] * 0.8, 0, 0, 150 + (70 * this.pressureScale));
      for (let i = 0; i < 5; i++) p.line(0, 0, this.size * p.cos(i * p.TWO_PI / 5), this.size * p.sin(i * p.TWO_PI / 5));
      p.noStroke(); p.fill(this.color[0] * 0.8, 0, 0, 220); p.ellipse(0, 0, this.size * 0.4); p.pop();
    }
    else if (this.type === 'wave') {
      p.noStroke(); p.fill(this.color[0], this.color[1], this.color[2], 10); p.ellipse(this.pos.x, this.pos.y, this.pulseSize, this.pulseSize);
      // 【修改】：重按胀痛波纹更不透明
      p.fill(this.color[0], this.color[1], this.color[2], 5 + (15 * this.pressureScale));
      p.ellipse(this.pos.x, this.pos.y, this.pulseSize, this.pulseSize);
    }
    p.drawingContext.shadowBlur = 0;
  }
  isDead() { return this.life < 0; }
}
// Canvas 文字自动换行工具
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

function AppContent({ targetLanguage, setTargetLanguage }) {
  console.log("AppContent rendering start");
  const { t, texts } = useI18n();
  try {
    const [page, setPage] = useState("splash");
    // 1. Splash 页面 - 使用 t('splash.quotes') 并取随机
    const [quote] = useState(() => {
      const quotes = t('splash.quotes', {});
      // 确保 quotes 是数组且有内容
      if (Array.isArray(quotes) && quotes.length > 0) {
        return quotes[Math.floor(Math.random() * quotes.length)];
      }
      // 备用数组（防止翻译文件加载失败）
      const fallbackQuotes = [
        "慢性疼痛相当于长期的“unmaking”——把人困在身体牢笼里。\n—— Elaine Scarry",
        "疼痛不仅是神经的电冲动，它是对自我边界的侵犯。",
        "语言在痛苦面前总是匮乏的，而视觉是一道划破沉默的闪电。",
        "不被看见的痛楚，往往需要承受双倍的煎熬。",
        "拒绝隐忍，让不可言说之痛成为公共的视觉证据。",
        "你的身体是一座战场，允许它留下风暴的痕迹。",
        "这不是矫情，这是一场真切的生理型灾难。",
      ];
      return fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    });
    const [splashOpacity, setSplashOpacity] = useState(1);
    const [llmData, setLlmData] = useState(null); // 【新增】：专门用来存大模型返回的数据
    const [quickPainType, setQuickPainType] = useState('twist');
    const [quickPainScore, setQuickPainScore] = useState(7);


    // 新增状态变量
    const [showGuide, setShowGuide] = useState(false);
    const [showMedicalOpt, setShowMedicalOpt] = useState(false);
    const [showContent, setShowContent] = useState('preference'); // 'preference' 或 'medical'
    const [medicalBackground, setMedicalBackground] = useState({
      diagnosed: '',
      allergies: '',
    });
    const [showCompare, setShowCompare] = useState(false);

    const [cycleDay, setCycleDay] = useState(''); // '1', '2', 'ovulation' 等，空字符串代表未选择
    const [tonePreference, setTonePreference] = useState('gentle');
    const [isLoading, setIsLoading] = useState(false);
    // 新增：内容可编辑
    const [editedContents, setEditedContents] = useState({});  // { fieldKey: '编辑后文字' }
    const [editingField, setEditingField] = useState(null);     // 当前正在编辑的字段名
    // 新增：选择分享身份
    const [diaryShareIdentity, setDiaryShareIdentity] = useState('partner');
    // 新增：补充经验输入状态
    const [showExpInput, setShowExpInput] = useState(false);
    const [expText, setExpText] = useState("");
    const [expTags, setExpTags] = useState("");
    const [refineTargetField, setRefineTargetField] = useState('med_complaint'); // 【新增】：医生Tab优化目标，默认为主诉

    // 新增：保存经验的函数
    const handleSaveExperience = () => {
      if (!expText.trim()) return alert("请写下你的经验");
      const tagsArray = expTags ? expTags.split(/[,，]/).filter(t => t.trim()) : [];
      setPosts(prev => prev.map(p =>
        p.id === viewingPost.id
          ? { ...p, userExperience: expText, experienceTags: tagsArray }
          : p
      ));
      setViewingPost(vp => ({
        ...vp,
        userExperience: expText,
        experienceTags: tagsArray
      }));
      setShowExpInput(false);
      setExpText("");
      setExpTags("");
    };
    // 轻量级提示
    const showToast = (msgKey, vars = {}) => {
      const msg = t(`toast.${msgKey}`, vars);
      const toast = document.createElement('div');
      toast.innerText = msg;
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20,20,20,0.9)',
        color: '#fff',
        padding: '10px 24px',
        borderRadius: '20px',
        fontSize: '14px',
        zIndex: '9999',
        backdropFilter: 'blur(5px)',
        border: '1px solid #333',
        transition: 'opacity 0.3s'
      });
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 1500);
    };
    // === 声音反馈系统 ===
    const audioCtx = useRef(null);
    const [isMuted, setIsMuted] = useState(false); // 默认开启声音

    // 播放笔触音效的函数
    const playBrushSound = (type) => {
      if (isMuted) return; // 如果静音，直接返回
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();

      // 确保音频上下文处于运行状态
      if (audioCtx.current.state === 'suspended') {
        audioCtx.current.resume();
      }

      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();
      const params = {
        twist: { freq: 80, wave: 'sawtooth', duration: 0.3 },
        pierce: { freq: 800, wave: 'sine', duration: 0.05 },
        heavy: { freq: 40, wave: 'sine', duration: 0.5 },
        wave: { freq: 200, wave: 'sine', duration: 0.8 },
        scrape: { freq: 300, wave: 'sawtooth', duration: 0.15 },
        eraser: { freq: 500, wave: 'triangle', duration: 0.08 }, // 新增：橡皮擦的清脆音效
      };
      const p = params[type];
      if (!p) return;

      osc.type = p.wave;
      osc.frequency.value = p.freq;
      gain.gain.setValueAtTime(0.05, audioCtx.current.currentTime); // 低音量
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + p.duration);
      osc.connect(gain);
      gain.connect(audioCtx.current.destination);
      osc.start();
      osc.stop(audioCtx.current.currentTime + p.duration);
    };
    const [refiningField, setRefiningField] = useState(null); // 正在优化的字段名
    const [refineInput, setRefineInput] = useState('');       // 优化指令输入框
    // === 导出完整疼痛档案为 PDF ===
    const exportHistoryPDF = async () => {
      if (history.length === 0) return showToast("noRecords");
      setIsLoading(true);
      showToast("pdfGenerating");
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4'); // A4 纸，纵向
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPos = 20;

        // 辅助函数：新增页面
        const checkPageBreak = (heightNeeded) => {
          if (yPos + heightNeeded > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
            // 新页面页脚
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(t('pdf.disclaimer1'), pageWidth / 2, pageHeight - 10, { align: 'center' });
          }
        };

        // === 封面页 ===
        doc.setFontSize(24);
        doc.setTextColor(40);
        doc.text("PainScape", pageWidth / 2, 40, { align: 'center' });

        doc.setFontSize(16);
        doc.text("Patient Pain Profile", pageWidth / 2, 50, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Report Range: ${history[history.length - 1].date} - ${history[0].date}`, pageWidth / 2, 65, { align: 'center' });
        doc.text(`Total Records: ${history.length}`, pageWidth / 2, 73, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("This document is generated by AI based on patient's visual drawing.", pageWidth / 2, 90, { align: 'center' });
        doc.text("Please present this to your gynecologist.", pageWidth / 2, 96, { align: 'center' });

        // === 逐条记录渲染 ===
        for (let i = 0; i < history.length; i++) {
          const record = history[i];
          doc.addPage();
          yPos = 20;

          // 1. 日期与主导痛感
          doc.setFontSize(14);
          doc.setTextColor(40);
          doc.text(`Record ${i + 1}: ${record.date}`, 15, yPos);

          doc.setFontSize(12);
          doc.setTextColor(211, 47, 47); // 红色
          doc.text(`Dominant Pain: ${record.painName || 'Unknown'}`, 15, yPos + 8);
          yPos += 18;

          // 2. 图谱图片 (将 base64 图片嵌入)
          if (record.img) {
            try {
              doc.addImage(record.img, 'JPEG', 15, yPos, 80, 80); // 80x80mm 的图
              yPos += 85;
            } catch (e) {
              console.warn("图片加载失败", e);
            }
          }

          // 3. AI 医疗主诉（换行处理）
          checkPageBreak(40);
          doc.setFontSize(11);
          doc.setTextColor(80);
          doc.text("Medical Complaint:", 15, yPos);
          yPos += 6;

          doc.setFontSize(10);
          doc.setTextColor(120);
          const complaintText = record.content?.med_complaint || "No data";
          const splitComplaint = doc.splitTextToSize(complaintText, pageWidth - 30);
          doc.text(splitComplaint, 15, yPos);
          yPos += splitComplaint.length * 5 + 10;

          // 4. 诊疗参考
          checkPageBreak(30);
          doc.setFontSize(11);
          doc.setTextColor(80);
          doc.text("Medical Reference:", 15, yPos);
          yPos += 6;

          doc.setFontSize(10);
          doc.setTextColor(120);
          const refText = (record.content?.med_reference || "No data").substring(0, 300); // 限制长度防溢出
          const splitRef = doc.splitTextToSize(refText, pageWidth - 30);
          doc.text(splitRef, 15, yPos);

          // 页脚
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text("PainScape - Generated Report", pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        doc.save(`PainScape_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
        showToast("pdfSuccess");

      } catch (err) {
        console.error("PDF 生成失败:", err);
        showToast("pdfFailed");
      } finally {
        setIsLoading(false);
      }
    };

    // 新增 ref
    const particlePositions = useRef([]);
    const speedHistory = useRef([]);
    const pressureHistory = useRef([]); // 【新增】：记录压感历史
    const [activeBrush, setActiveBrush] = useState(null);
    const [activeColor, setActiveColor] = useState("crimson");
    const [identity, setIdentity] = useState("partner");
    const [userPrefs, setUserPrefs] = useState(["care"]);
    const [imgUrl, setImgUrl] = useState(null);
    const [bodyMode, setBodyMode] = useState('front');

    const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('painscape_history') || '[]'));
    const [posts, setPosts] = useState([
      // 中文帖子
      {
        id: 1,
        text: "痛得下不了床...",
        img: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200",
        painTags: ["twist"],  // ✅ 使用 key
        likes: 0,
        hugs: 0,
        restReminders: 0,
        group: "family",
        analogy: "🌪️ 像拧毛巾一样，一圈一圈拧紧",
        userExperience: null,
        experienceTags: [],
        hasUserHugged: false,
        lang: "zh",
      },
      {
        id: 2,
        text: "腰快断了，一直坠坠的。",
        img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200",
        painTags: ["heavy"],  // ✅ 使用 key
        likes: 0,
        hugs: 0,
        restReminders: 0,
        group: "friend",
        analogy: "🪨 像绑了沙袋往下坠，站着就想蹲下",
        userExperience: null,
        experienceTags: [],
        hasUserHugged: false,
        lang: "zh",
      },

      // 英文帖子 - 也使用相同的 key
      {
        id: 3,
        text: "Feels like my insides are being twisted with a hot knife...",
        img: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=200",
        painTags: ["twist"],  // ✅ 使用 key
        likes: 0,
        hugs: 0,
        restReminders: 0,
        group: "friend",
        analogy: "🌪️ Like a wet towel being wrung out, tighter and tighter",
        userExperience: null,
        experienceTags: [],
        hasUserHugged: false,
        lang: "en",
      },
      {
        id: 4,
        text: "The heaviness in my lower back makes it impossible to stand for more than 5 minutes.",
        img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=200",
        painTags: ["heavy"],  // ✅ 使用 key
        likes: 0,
        hugs: 0,
        restReminders: 0,
        group: "family",
        analogy: "🪨 Like carrying a 10kg weight pulling down from inside",
        userExperience: null,
        experienceTags: [],
        hasUserHugged: false,
        lang: "en",
      },
      {
        id: 5,
        text: "Sharp stabbing pain that comes out of nowhere, then disappears just as fast.",
        img: "https://images.unsplash.com/photo-1584362917165-526a968579e8?q=80&w=200",
        painTags: ["pierce"],  // ✅ 使用 key
        likes: 0,
        hugs: 0,
        restReminders: 0,
        group: "friend",
        analogy: "⚡️ Like an electric drill piercing through without warning",
        userExperience: null,
        experienceTags: [],
        hasUserHugged: false,
        lang: "en",
      },
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
    const [groupFilter, setGroupFilter] = useState("all");   // 群组筛选
    const [painFilter, setPainFilter] = useState("all");     // 痛感标签筛选
    const [communityGroups, setCommunityGroups] = useState([
      { id: 'family', name: '👩‍👧 家庭群' },
      { id: 'friend', name: '🤝 朋友群' },
    ]);

    // 语言切换时更新群组名称
    useEffect(() => {
      setCommunityGroups(prev => prev.map(group => {
        if (group.id === 'family') {
          return { ...group, name: t('community.groupFamily') };
        }
        if (group.id === 'friend') {
          return { ...group, name: t('community.groupFriend') };
        }
        return group;
      }));
    }, [t, setCommunityGroups]);
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
      const safeAction = content.action?.replace(/🛑|🥣|🫂|❤️|复合指令：|偏好指令：/g, '').trim() || '';
      const safeSelfCare = content.selfCare?.replace(/✨/g, '•').trim() || '';

      switch (idty) {
        case 'partner':
          return `${t('shareText.partner.title')}\n${content.analogy || ''}\n\n${t('shareText.partner.action')}\n${safeAction}`;
        case 'work':
          return `${t('shareText.work.title')}\n${content.workText || ''}`;
        case 'doctor':
          return `${t('shareText.doctor.profile')}\n${content.med_profile || ''}\n\n${t('shareText.doctor.complaint')}\n${content.med_complaint || ''}\n\n${t('shareText.doctor.reference')}\n${content.med_reference || ''}`;
        case 'self':
          return `${t('shareText.self.title')}\n${content.analogy || ''}\n\n${t('shareText.self.solution')}\n${safeSelfCare}`;
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
            // 【新增】：获取压感 (0.0 - 1.0)
            let pressure = 0.5; // 默认中等力度（适配无压感的鼠标）
            if (p5.touches.length > 0) {
              // 触屏设备：使用 pointer force，如果没有则回退到 0.5
              pressure = p5.touches[0].force ?? 0.5;
            } else if (typeof p5.mouseX === 'number' && p5._curElement) {
              // p5 内部挂载了 pointer 对象，可以读取原生压感 (Apple Pencil 等)
              pressure = p5._curElement?.pointer?.pressure ?? 0.5;
            }
            pressure = Math.max(0.2, pressure);
            // 将 pressure 传入构造函数
            let pObj = new PainParticle(p5, realX, realY, activeBrush, PALETTES[activeColor].color, speed, heading, bodyMode, pressure);
            // === 新增：记录粒子位置和速度 ===
            particlePositions.current.push({ x: realX, y: realY, bodyMode });
            speedHistory.current.push(speed);
            pressureHistory.current.push(pressure); // 【新增】：记录压感
            if (speedHistory.current.length > 200) speedHistory.current.shift();
            if (pressureHistory.current.length > 200) pressureHistory.current.shift();
            if (pObj.isDynamic) {
              dynamicParticles.current.push(pObj);
              if (dynamicParticles.current.length > 500) dynamicParticles.current.shift();
            }
            else { staticParticles.current.push(pObj); }
          }
          // 【新增】：成功生成粒子时，播放对应笔触的音效
          playBrushSound(activeBrush);
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
        const fullText = getFullShareText(shareContent.identity, shareContent, t);

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
        const titleMap = {
          partner: t('shareCard.titles.partner'),
          work: t('shareCard.titles.work'),
          doctor: t('shareCard.titles.doctor'),
          self: t('shareCard.titles.self')
        };
        ctx.fillText(titleMap[shareContent.identity], 60, 630);

        ctx.fillStyle = '#eee';
        ctx.font = '16px "Microsoft YaHei", sans-serif';
        wrapText(ctx, fullText, 60, 680, 480, 30);

        // 5. 底部品牌标识
        ctx.fillStyle = '#444';
        ctx.font = '12px sans-serif';
        ctx.fillText(t('shareCard.footer'), 60, cvs.height - 40);

        const finalUrl = cvs.toDataURL('image/jpeg', 0.9);
        const blob = await (await fetch(finalUrl)).blob();
        const file = new File([blob], 'painscape_share.jpg', { type: 'image/jpeg' });

        // 6. 分享或下载逻辑
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: t('sharePreview.shareTitle'),
              files: [file]
            });
            setShowSharePreview(false);
          } catch (e) {
            if (e.name === 'AbortError') {
              return;
            }
            const link = document.createElement('a');
            link.href = finalUrl;
            link.download = `PainScape_${Date.now()}.jpg`;
            link.click();
          }
        } else {
          const link = document.createElement('a');
          link.href = finalUrl;
          link.download = `PainScape_${Date.now()}.jpg`;
          link.click();
          alert(t('toast.shareSaved'));
          setShowSharePreview(false);
        }

      } catch (e) {
        console.error("生成分享卡片失败:", e);
        alert(t('toast.shareFailed'));
      } finally {
        setIsLoading(false);
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

      if (!postText) return alert(t('toast.postRequired'));

      const dominant = getDominantPain();
      const content = generateContent(dominant);

      const newPost = {
        id: Date.now(),
        text: postText,
        img: imgUrl,
        likes: 0,
        hugs: 0,
        restReminders: 0,
        group: groupFilter === 'all' ? 'family' : groupFilter,
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
        alert(t('toast.publishSuccess', { count: sameCount, pain: myTag }));
      }, 300);

      setPage("community");

    };

    const handleCreateGroup = () => {
      const name = prompt(t('community.createGroupPrompt'));
      if (name) {
        const newId = 'group_' + Date.now();
        setCommunityGroups([...communityGroups, { id: newId, name: `💬 ${name}` }]);
        setCommunityFilter(newId);
        alert(t('community.groupCreated', { name }));
      }
    };

    const handleJoinGroup = () => {
      const code = prompt(t('community.joinGroupPrompt'));
      if (code) {
        const newId = 'group_' + Date.now();
        setCommunityGroups([...communityGroups, { id: newId, name: `👥 ${t('community.newGroup')}` }]);
        alert(t('community.joinedGroup'));
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
    const generateContent = (overrideType, externalLlm = null) => {
      const activeLlm = externalLlm || llmData;
      const hasLlm = activeLlm?.status === 'success';
      const dominant = overrideType || getDominantPain(); // 痛觉主导类型

      // 【新增】：获取压感强度描述
      const intensityProfile = calculateIntensity();
      const pressureLevel = intensityProfile?.avgPressure || 0.5; // 0.2~1.0

      let painAdjectiveKey = "persistent";
      if (pressureLevel > 0.8) painAdjectiveKey = "extremelyIntense";
      else if (pressureLevel > 0.6) painAdjectiveKey = "intense";
      else if (pressureLevel < 0.4) painAdjectiveKey = "faint";

      const painNameMap = {
        twist: `${t(`painAdjectives.${painAdjectiveKey}`)}${t('painNames.twist')}`,
        pierce: `${t(`painAdjectives.${painAdjectiveKey}`)}${t('painNames.pierce')}`,
        heavy: `${t(`painAdjectives.${painAdjectiveKey}`)}${t('painNames.heavy')}`,
        wave: `${t(`painAdjectives.${painAdjectiveKey}`)}${t('painNames.wave')}`,
        scrape: `${t(`painAdjectives.${painAdjectiveKey}`)}${t('painNames.scrape')}`,
      };
      const painName = painNameMap[dominant];

      const TEXTS = {
        twist: { analogy: "想象把一条湿毛巾用力拧干...", med: "下腹部持续性绞痛，建议排查子宫痉挛。", selfCare: "✨ 尝试【婴儿蜷缩式】侧卧..." },
        pierce: { analogy: "想象不打麻药进行根管治疗...", med: "锐痛，建议排查神经性疼痛。", selfCare: "✨ 刺痛发作易引发冷汗..." },
        heavy: { analogy: "像在腹部绑了5公斤沙袋...", med: "下腹部严重坠胀感，建议排查盆腔充血。", selfCare: "✨ 尝试【臀部垫高平躺】..." },
        wave: { analogy: "像肚子里有个气球在不断充气...", med: "弥漫性胀痛，建议排查水肿或肠胀气。", selfCare: "✨ 穿着极度宽松的衣物..." },
        scrape: { analogy: "像一颗未成熟的果实被强行剥皮...", med: "强烈的撕裂样锐痛，建议排查组织粘连。", selfCare: "✨ 这是最耗费体力的痛感..." }
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
        'endometriosis': '子宫内膜异位症', 'adenomyosis': '子宫腺肌症', 'pcos': '多囊卵巢综合征',
        'fibroids': '子宫肌瘤', 'pid': '盆腔炎性疾病（PID）', 'ovariancyst': '卵巢囊肿',
        'cervicalstenosis': '宫颈管狭窄', 'unchecked': '未做过相关检查', 'none': '无确诊'
      };
      const diagValue = medicalBackground.diagnosed;
      if (diagValue && diagValue !== '' && diagValue !== 'none' && diagValue !== 'unchecked') {
        auxiliaryInfo.push(`• 既往诊断：${diagMap[diagValue] || diagValue}。`);
      } else if (diagValue === 'unchecked') {
        auxiliaryInfo.push(`• 既往病史：患者自述未做过痛经相关妇科检查。`);
      }

      const allergyValue = medicalBackground.allergies;
      const allergyLabelMap = { aspirin: '阿司匹林', ibuprofen: '布洛芬', nsaids: '多种NSAIDs' };
      if (allergyValue && allergyValue !== '' && allergyValue !== 'none' && allergyValue !== 'unknown') {
        auxiliaryInfo.push(`• 药物过敏：${allergyLabelMap[allergyValue] || allergyValue}过敏，请注意用药。`);
      }

      // 1. 先定义 finalMedReference
      let finalMedReference = auxiliaryInfo.join('\n');
      if (examPreps.length > 0) {
        finalMedReference += (finalMedReference ? '\n' : '') + examPreps.join('\n');
      } else if (!finalMedReference) {
        finalMedReference = "• 建议向医生详细描述本次记录的痛觉质地与发作时间。";
      }

      // 2. 然后再追加时间节律分析
      const timeRhythm = calculateTimeRhythm();
      if (timeRhythm) {
        const periodMap = {
          morning: { name: '上午/晨间', insight: '这与前列腺素/子宫收缩素在晨间分泌达峰的节律高度一致，常伴随起床后的下腹坠胀感。' },
          afternoon: { name: '下午', insight: '午后疼痛加剧，可能与久坐导致的盆腔充血及体力消耗有关。' },
          night: { name: '夜间/晚间', insight: '夜间痛觉敏感度生理性升高，且平卧时盆腔血流改变，易使坠痛感加剧。' }
        };
        // 修复：更改变量名避免覆盖 dominant
        const dominantPeriodInfo = periodMap[timeRhythm.dominantPeriod];
        if (dominantPeriodInfo) {
          finalMedReference += `\n\n⏱️【时间节律分析】：您的图谱绘制行为显示，痛感主要集中于${dominantPeriodInfo.name}（占比 ${Math.round(timeRhythm[timeRhythm.dominantPeriod] * 100)}%）。${dominantPeriodInfo.insight}`;
        }
      }

      // 根据过敏史智能推荐止痛药
      let safePainkiller = "布洛芬";
      if (medicalBackground.allergies === 'ibuprofen') safePainkiller = "对乙酰氨基酚（泰诺）";
      else if (medicalBackground.allergies === 'nsaids') safePainkiller = "对乙酰氨基酚（请遵医嘱）";
      else if (medicalBackground.allergies === 'aspirin') safePainkiller = "布洛芬（避免阿司匹林）";

      let actionParts = [];
      if (userPrefs.includes('alone')) {
        actionParts.push(`☑️ 帮她倒杯温水，备好${safePainkiller}。`);
        actionParts.push("☑️ 调暗灯光，关门出去，不要频繁询问。");
      } else {
        if (userPrefs.includes('care')) actionParts.push("☑️ 搓热手掌捂在她小腹或后腰。主动承担家务。");
        if (userPrefs.includes('comfort')) actionParts.push("☑️ 坐在旁边握着她的手，不用说话，给予安全感。");
      }

      const workTemplate = `领导/HR 您好：本人今日突发严重原发性痛经（${painName}），伴随体力透支与冷汗。目前状态已无法维持正常专注度，特申请今日居家休息。紧急事务已交接。感谢批准。`;

      let finalSelfCare = hasLlm ? activeLlm.selfCare : (TEXTS[dominant]?.selfCare || TEXTS.twist.selfCare);
      if (tonePreference === 'gentle' && !hasLlm) {
        finalSelfCare += "\n\n✨ 允许自己今天做一个废物，好好休息。";
      }

      return {
        pain: painName,
        analogy: hasLlm ? activeLlm.analogy : (TEXTS[dominant]?.analogy || TEXTS.twist.analogy),
        med_complaint: hasLlm ? activeLlm.med : (TEXTS[dominant]?.med || "主诉：持续性痛经。"),
        med_reference: finalMedReference,
        med_profile: `PainScape 痛觉成像显示强烈的 ${painName} 特征。`,
        selfCare: finalSelfCare,
        workText: hasLlm ? activeLlm.work : workTemplate,
        action: actionParts.join("\n"),
        med: finalMedComplaint
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
          title={t('editable.clickToEdit')}
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
        alert(t('toast.copySuccess'));
      }).catch(err => {
        console.error('复制失败', err);
        alert(t('toast.copyFailed'));
      });
    };
    // === 优化数据提取计算函数 ===
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
    // === 计算痛觉时间节律 ===
    const calculateTimeRhythm = () => {
      // 汇总所有粒子的时间数据（只需统计动态粒子即可代表总体分布）
      const particles = dynamicParticles.current;
      if (particles.length === 0) return null;

      let morning = 0;     // 0:00 - 11:59 (0 - 719 分钟)
      let afternoon = 0;   // 12:00 - 17:59 (720 - 1079 分钟)
      let night = 0;       // 18:00 - 23:59 (>= 1080 分钟)

      particles.forEach(p => {
        if (p.minuteOfDay < 720) morning++;
        else if (p.minuteOfDay < 1080) afternoon++;
        else night++;
      });

      const total = morning + afternoon + night;
      if (total === 0) return null;

      return {
        morning: parseFloat((morning / total).toFixed(2)),
        afternoon: parseFloat((afternoon / total).toFixed(2)),
        night: parseFloat((night / total).toFixed(2)),
        // 额外传一个主诉时段给后端，方便它造句
        dominantPeriod: morning >= afternoon && morning >= night ? 'morning'
          : afternoon >= morning && afternoon >= night ? 'afternoon'
            : 'night'
      };
    };
    // === 实时计算情绪负荷指数 ===
    const calcEmotionLoad = () => {
      const avgSpeed = speedHistory.current.length > 0
        ? speedHistory.current.reduce((a, b) => a + b, 0) / speedHistory.current.length : 0;
      const colorWeight = { crimson: 1.0, purple: 0.8, dark: 0.6, blue: 0.3 };
      const coverage = Object.values(brushCounts.current).reduce((a, b) => a + b, 0);

      // 速度权重40% + 颜色权重30% + 涂抹量权重30%
      const raw = (avgSpeed / 30) * 40 + (colorWeight[activeColor] || 0.5) * 30 + Math.min(coverage / 200, 1) * 30;
      return Math.min(Math.round(raw), 100);
    };

    const calculateIntensity = () => {
      const speeds = speedHistory.current;
      const pressures = pressureHistory.current; // 获取压感数据 
      if (speeds.length === 0 && pressures.length === 0) return null;
      const avg = speeds.length > 0 ? speeds.reduce((s, v) => s + v, 0) / speeds.length : 0;
      const peak = speeds.length > 0 ? Math.max(...speeds) : 0;
      // 计算平均压感
      const avgPressure = pressures.length > 0
        ? pressures.reduce((s, v) => s + v, 0) / pressures.length
        : 0.5; // 默认0.5中等压力
      return {
        avgSpeed: parseFloat(avg.toFixed(1)),
        peakSpeed: parseFloat(peak.toFixed(1)),
        avgPressure: parseFloat(avgPressure.toFixed(2)) // 传出平均压感 (0.2 - 1.0)
      };
    };

    const getDominantPain = () => {
      const counts = brushCounts.current;
      const maxVal = Math.max(...Object.values(counts));
      // 找出使用次数最多的画笔，如果都没用过，默认返回 'twist'
      return maxVal > 0 ? Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) : 'twist';
    };
    const API_BASE = 'https://painscape-api.onrender.com';

    const handleRefine = async (fieldKey) => {
      if (!refineInput.trim() || refiningField) return; // 正在请求中时，拒绝重复点击
      setRefiningField(fieldKey);

      const currentText = getEditedOrDefault(fieldKey, generateContent()[fieldKey]);

      try {
        const res = await fetch(`${API_BASE}/api/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: fieldKey, currentText: currentText, userFeedback: refineInput })
        });

        // 【关键修复】抛出异常给 catch
        if (!res.ok) {
          throw new Error(`接口请求失败: ${res.status}`);
        }

        const data = await res.json();
        const refined = data.refined;

        if (refined) {
          setEditedContents(prev => ({ ...prev, [fieldKey]: refined }));
          setRefineInput('');
          showToast('refineSuccess');
        } else {
          showToast('refineEmpty');
        }
      } catch (err) {
        console.error('优化失败:', err);
        showToast('refineFailed');
      } finally {
        setRefiningField(null);
      }
    };
    const handleQuickLogSubmit = async () => {
      setIsLoading(true);

      try {
        // 1. 伪造画布数据（生成一张纯色占位图）
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 300; tempCanvas.height = 300;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, 300, 300);
        ctx.fillStyle = '#333'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(t('quickLog.title'), 150, 150);
        const url = tempCanvas.toDataURL("image/jpeg", 0.5);
        setImgUrl(url);

        // 2. 伪造笔触和压感数据
        const fakeBrushCounts = { twist: 0, pierce: 0, heavy: 0, wave: 0, scrape: 0 };
        fakeBrushCounts[quickPainType] = quickPainScore * 5; // 根据分值模拟涂抹量
        brushCounts.current = fakeBrushCounts;

        speedHistory.current = [15]; // 模拟中等速度
        pressureHistory.current = [quickPainScore / 10]; // 将 1-10 分值映射为 0.1-1.0 的压感

        // 3. 请求 AI
        const dominant = quickPainType;
        let aiResult = null;
        const payload = {
          dominantPain: dominant,
          userPref: userPrefs.join(','),
          painScore: quickPainScore * 10, // 映射为 0-100 的分值
          spatialMap: { abdomen: 0.8, lowerBack: 0.2, upperBody: 0 }, // 默认下腹痛为主
          intensityProfile: { avgSpeed: 15, peakSpeed: 25, avgPressure: quickPainScore / 10 },
          timeRhythm: calculateTimeRhythm() || { dominantPeriod: 'morning' },
          colorPalette: 'crimson', // 快速模式默认深红
          bodyMode: 'front',
          medicalBackground: medicalBackground,
          tonePreference: tonePreference,
          cycleDay: cycleDay || t('medical.cycleNotProvided'),
          isQuickLog: true // 【新增】：告知后端这是快速模式，可能描述需要更简练
        };

        const API_BASE = 'https://painscape-api.onrender.com';
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000);
          const response = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (response.ok) aiResult = await response.json();
        } catch (err) {
          console.warn("后端不可用，转入本地模式", err);
        }

        // 4. 生成报告并跳转
        const finalContent = generateContent(dominant, aiResult);
        const newRecord = {
          id: Date.now(),
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          img: url, type: dominant, painName: PAIN_NAME_MAP[dominant],
          content: finalContent,
          meta: { brushCounts: fakeBrushCounts, bodyMode: 'front', colorPalette: 'crimson', painScore: quickPainScore * 10, isQuickLog: true }
        };
        const newHistory = [newRecord, ...history].slice(0, 10);
        setHistory(newHistory);
        localStorage.setItem('painscape_history', JSON.stringify(newHistory));

        setPage("result");
      } catch (e) {
        console.error("快速记录出错:", e);
      } finally {
        setIsLoading(false);
      }
    };

    const handleFinish = async () => {
      if (!p5Ref.current) return;
      setIsLoading(true);
      try {
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
          timeRhythm: calculateTimeRhythm(),
          colorPalette: activeColor,
          bodyMode: bodyMode,
          medicalBackground: medicalBackground,
          tonePreference: tonePreference,
          cycleDay: cycleDay || t('medical.cycleNotProvided'), // 【新增】：传入周期天数
        };

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000);
          const response = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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
            painScore: Object.values(brushCounts.current).reduce((a, b) => a + b, 0),
            dominantPeriod: calculateTimeRhythm()?.dominantPeriod || 'morning' // 【新增】保存主时段

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
        pressureHistory.current = []; // 【新增】：重置压感历史
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
        const dateParts = item.date.split('/');
        const monthKey = `${dateParts[0]}年${dateParts[1]}月`;
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(item);
        return acc;
      }, {});
    };
    // === 疼痛趋势分析组件 ===
    const TrendSummary = ({ history }) => {
      if (history.length < 2) return null;

      // 统计最近5次的主导痛感
      const recent = history.slice(0, 5);
      const typeFreq = recent.reduce((acc, r) => {
        acc[r.painName] = (acc[r.painName] || 0) + 1;
        return acc;
      }, {});
      const sortedTypes = Object.entries(typeFreq).sort((a, b) => b[1] - a[1]);
      const dominant = sortedTypes.length > 0 ? sortedTypes[0] : ['未知', 0];

      // 统计平均间隔天数
      const gaps = history.slice(0, -1).map((r, i) => {
        // 【关键修复】：将 "2026/5/7" 替换为 "2026-5-7"，解决 Safari/移动端日期解析 NaN 的问题
        const d1 = new Date(history[i + 1].date.replace(/\//g, '-'));
        const d2 = new Date(r.date.replace(/\//g, '-'));
        return Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));
      }).filter(d => !isNaN(d)); // 过滤掉无效日期

      const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;

      return (
        <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '15px', marginBottom: '20px', border: '1px solid #333' }}>
          <p style={{ color: '#fff', fontWeight: 'bold', margin: '0 0 10px 0', fontSize: '13px' }}>{t('history.trendTitle')}</p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#ef9a9a', fontSize: '20px', fontWeight: 'bold' }}>{dominant[0]}</div>
              <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>{t('history.trendMostCommon')}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#90caf9', fontSize: '20px', fontWeight: 'bold' }}>~{avgGap}{t('history.days')}</div>
              <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>{t('history.trendAvgInterval')}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#a5d6a7', fontSize: '20px', fontWeight: 'bold' }}>{history.length}</div>
              <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>{t('history.trendTotal')}</div>
            </div>
          </div>
          {avgGap > 0 && (avgGap < 25 || avgGap > 35) ? (
            <p style={{ color: '#ff9800', fontSize: '11px', margin: '10px 0 0 0', padding: '8px', background: 'rgba(255,152,0,0.08)', borderRadius: '6px' }}>
              {t('history.trendDeviation')}
            </p>
          ) : null}
        </div>
      );
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
        {/* 心跳动画注入 */}
        <style>{`
      @keyframes pulse {
        0% { transform: scale(1); }
        25% { transform: scale(1.15); }
        50% { transform: scale(0.95); }
        100% { transform: scale(1); }
      }
    `}</style>
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1 }}>
          <Sketch setup={setup} draw={draw} preload={preload} mouseWheel={mouseWheel} mouseReleased={mouseReleased} touchEnded={mouseReleased} />
        </div>

        {/* UI 容器：关键修复 - 只在 canvas 页面禁用 pointerEvents */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, pointerEvents: 'auto' }}>

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
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ?
                </button>
                {showGuide && (
                  <div style={{
                    position: 'absolute', top: '40px', right: '0',
                    background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px', padding: '20px', width: '260px',
                    backdropFilter: 'blur(20px)', zIndex: 200
                  }}>
                    <p style={{ color: '#eee', fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
                      {t('onboarding.guideTitle')}
                    </p>
                    {t('onboarding.guideItems').map(([title, desc], idx) => (
                      <div key={idx} style={{ marginBottom: '8px' }}>
                        <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{title}</span>
                        <p style={{ color: '#888', fontSize: '11px', margin: '2px 0 0 0' }}>{desc}</p>
                      </div>
                    ))}

                    {/* 反馈入口 */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '12px', paddingTop: '10px' }}>
                      <button
                        onClick={() => {
                          setShowGuide(false);
                          const fb = prompt(t('onboarding.feedbackPrompt'));
                          if (fb !== null) {
                            localStorage.setItem('painscape_feedback_' + Date.now(), fb);
                            alert(t('onboarding.feedbackThanks'));
                          }
                        }}
                        style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#888', borderRadius: '10px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        {t('onboarding.submitFeedback')}
                      </button>
                    </div>
                    <button onClick={() => setShowGuide(false)} style={{ marginTop: '8px', width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#666', padding: '6px', borderRadius: '10px', fontSize: '10px', cursor: 'pointer' }}>
                      {t('onboarding.gotIt')}
                    </button>
                  </div>
                )}
              </div>

              <h1 style={{ color: '#fff', marginBottom: '5px', fontSize: '2rem' }}>PainScape</h1>
              <p style={{ color: '#aaa', marginBottom: '20px' }}>{t('app.subtitle')}</p>

              {/* 核心卡片区 */}
              <div style={{
                width: '100%',
                maxWidth: '360px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '24px',
                padding: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}>
                {/* 陪伴偏好内容 */}
                {showContent === 'preference' && (
                  <div style={{ width: '100%' }}>
                    <label style={{
                      color: '#eee',
                      fontSize: '1rem',
                      display: 'block',
                      marginBottom: '20px',
                      textAlign: 'center',
                      fontWeight: '300'
                    }}>
                      {t('onboarding.preferenceTitle')}
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {['alone', 'care', 'comfort'].map((p, i) => (
                        <button key={p} onClick={() => togglePref(p)} style={{
                          padding: '16px',
                          borderRadius: '16px',
                          textAlign: 'left',
                          background: userPrefs.includes(p) ? 'rgba(211, 47, 47, 0.1)' : '#111',
                          border: userPrefs.includes(p) ? '1.5px solid #d32f2f' : '1.5px solid #222',
                          color: userPrefs.includes(p) ? '#fff' : '#888',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <span style={{ fontSize: '15px', fontWeight: 'bold' }}>
                            {t(`onboarding.preferences.${i}.title`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 健康信息内容 */}
                {showContent === 'medical' && (
                  <div style={{ width: '100%' }}>
                    <label style={{
                      color: '#eee',
                      fontSize: '1rem',
                      display: 'block',
                      marginBottom: '20px',
                      textAlign: 'center',
                      fontWeight: '300'
                    }}>
                      {t('onboarding.medicalTitle')}
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* 月经周期选择 */}
                      <div>
                        <span style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '8px' }}>{t('onboarding.cycleLabel')}</span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {t('onboarding.cycleOptions').map(item => (
                            <button key={item} onClick={() => setCycleDay(cycleDay === item ? '' : item)}
                              style={{
                                padding: '8px 14px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
                                background: cycleDay === item ? 'rgba(211, 47, 47, 0.1)' : '#111', color: cycleDay === item ? '#fff' : '#888',
                                border: cycleDay === item ? '1.5px solid #d32f2f' : '1.5px solid #222',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}>
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 既往诊断与过敏史 */}
                      <select value={medicalBackground.diagnosed} onChange={(e) => setMedicalBackground({ ...medicalBackground, diagnosed: e.target.value })} style={{ width: '100%', padding: '12px', background: '#111', color: '#fff', border: '1.5px solid #222', borderRadius: '12px', fontSize: '13px', outline: 'none' }}>
                        {Object.entries(t('onboarding.diagnosisOptions')).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>

                      <select value={medicalBackground.allergies} onChange={(e) => setMedicalBackground({ ...medicalBackground, allergies: e.target.value })} style={{ width: '100%', padding: '12px', background: '#111', color: '#fff', border: '1.5px solid #222', borderRadius: '12px', fontSize: '13px', outline: 'none' }}>
                        {Object.entries(t('onboarding.allergyOptions')).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>

                      {/* 语气偏好 */}
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setTonePreference('gentle')} style={{
                          flex: 1, padding: '14px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer',
                          background: tonePreference === 'gentle' ? 'rgba(76, 175, 80, 0.1)' : '#111', color: tonePreference === 'gentle' ? '#fff' : '#888',
                          border: tonePreference === 'gentle' ? '1.5px solid #4caf50' : '1.5px solid #222',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>{t('onboarding.toneGentle')}</button>
                        <button onClick={() => setTonePreference('direct')} style={{
                          flex: 1, padding: '14px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer',
                          background: tonePreference === 'direct' ? 'rgba(33, 150, 243, 0.1)' : '#111', color: tonePreference === 'direct' ? '#fff' : '#888',
                          border: tonePreference === 'direct' ? '1.5px solid #2196f3' : '1.5px solid #222',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>{t('onboarding.toneDirect')}</button>
                      </div>
                      <span style={{ color: '#666', fontSize: '11px', opacity: 0.6 }}>{t('onboarding.toneHint')}</span>
                    </div>
                  </div>
                )}

                {/* 切换按钮 - 放入卡片底部 */}
                <button onClick={() => setShowContent(showContent === 'preference' ? 'medical' : 'preference')}
                  style={{
                    background: 'transparent', border: '1px solid #222', color: '#888',
                    padding: '12px 16px', borderRadius: '16px', fontSize: '12px',
                    marginTop: '20px', width: '100%',
                    cursor: 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px'
                  }}>
                  {showContent === 'preference' ? t('onboarding.switchToMedical') : t('onboarding.switchToPreference')}
                  <span style={{ transition: 'transform 0.3s', transform: showContent === 'medical' ? 'rotate(180deg)' : 'rotate(0deg)' }}>↑</span>
                </button>
              </div>

              {/* 主动作区 */}
              <button
                onClick={() => {
                  setShowContent('preference');
                  setPage("canvas");
                }}
                style={{ marginTop: '30px', width: '200px', padding: '16px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 15px rgba(211, 47, 47, 0.3)' }}
              >
                {t('onboarding.startDrawing')}
              </button>

              {/* 快速记录入口 */}
              <button onClick={() => setPage("quickLog")} style={{
                marginTop: '15px',
                width: '320px',
                padding: '12px',
                background: 'transparent',
                border: '1px solid #222',
                color: '#666',
                borderRadius: '30px',
                fontSize: '13px',
                cursor: 'pointer'
              }}>
                {t('onboarding.quickLog')}
              </button>

              {/* 底部功能导航 */}
              <footer style={{
                marginTop: '30px',
                display: 'flex',
                gap: '30px',
                borderTop: '1px solid #222',
                paddingTop: '20px',
                width: '320px',
                justifyContent: 'center'
              }}>
                <button
                  style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}
                  onClick={() => setPage("community")}
                >
                  {t('onboarding.exploreCommunity')}
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}
                  onClick={() => setPage("history")}
                >
                  {t('onboarding.painDiary')}
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}
                  onClick={() => {
                    const newLang = targetLanguage === 'zh' ? 'en' : 'zh';
                    setTargetLanguage(newLang);
                  }}
                >
                  {targetLanguage === 'zh' ? 'English' : '中文'}
                </button>
              </footer>
            </div>
          )}



          {/* === Canvas 绘画页面 === */}
          {page === "canvas" && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10, pointerEvents: 'auto' }}>
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
                  {/* 声音开关按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                    style={{
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                      border: `1px solid ${isMuted ? '#666' : '#4caf50'}`,
                      borderRadius: '50%', width: '36px', height: '36px',
                      fontSize: '16px', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: isMuted ? '#666' : '#4caf50'
                    }}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                  <button style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '6px 18px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }} onClick={handleFinish}>
                    {t('canvas.generate')}
                  </button>
                </div>

                <div style={{ display: 'flex', background: 'rgba(30,30,30,0.8)', borderRadius: '20px', padding: '4px', backdropFilter: 'blur(10px)' }}>
                  <button style={{ padding: '6px 15px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: bodyMode === 'front' ? '#4caf50' : 'transparent', color: bodyMode === 'front' ? '#fff' : '#888' }} onClick={(e) => { e.stopPropagation(); setBodyMode('front'); }}>
                    {t('canvas.bodyFront')}
                  </button>
                  <button style={{ padding: '6px 15px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: bodyMode === 'back' ? '#4caf50' : 'transparent', color: bodyMode === 'back' ? '#fff' : '#888' }} onClick={(e) => { e.stopPropagation(); setBodyMode('back'); }}>
                    {t('canvas.bodyBack')}
                  </button>
                  <button style={{ padding: '6px 15px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: bodyMode === 'none' ? '#d32f2f' : 'transparent', color: bodyMode === 'none' ? '#fff' : '#888' }} onClick={(e) => { e.stopPropagation(); setBodyMode('none'); }}>
                    {t('canvas.bodyNone')}
                  </button>
                </div>
              </div>
              <div style={{ pointerEvents: 'auto', position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>

                {/* 情绪负荷温度计 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '180px', width: '30px', position: 'relative', justifyContent: 'flex-end' }}>
                  <div style={{ color: '#888', fontSize: '9px', marginBottom: '4px', writingMode: 'vertical-rl' }}>
                    {t('canvas.emotionLoad')}
                  </div>
                  <div style={{ width: '6px', height: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', bottom: 0, width: '100%',
                      height: `${calcEmotionLoad()}%`,
                      background: `linear-gradient(to top, #4caf50, #ff9800, #d32f2f)`,
                      borderRadius: '3px',
                      transition: 'height 0.3s ease-out'
                    }} />
                  </div>
                  <div style={{ color: calcEmotionLoad() > 70 ? '#d32f2f' : '#fff', fontSize: '12px', fontWeight: 'bold', marginTop: '6px' }}>
                    {calcEmotionLoad()}
                  </div>
                </div>

                <button style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid #444', borderRadius: '30px', width: '50px', height: '50px', fontSize: '24px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleUndo(); }}>↩️</button>
                <button style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid #444', borderRadius: '30px', width: '50px', height: '50px', fontSize: '24px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleRedo(); }}>↪️</button>
                <button style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid #444', borderRadius: '30px', width: '50px', height: '50px', fontSize: '24px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleClear(); }}>🗑️</button>
              </div>

              <div style={{ pointerEvents: 'auto', position: 'absolute', bottom: '20px', paddingBottom: '8px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '380px', maxHeight: '38vh', overflowY: 'visible', background: 'rgba(20,20,20,0.9)', padding: '15px', borderRadius: '24px', backdropFilter: 'blur(10px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  {Object.keys(BRUSHES).map(k => (
                    <button key={k} style={{ flex: 1, background: activeBrush === k ? '#444' : 'transparent', border: 'none', color: activeBrush === k ? '#fff' : '#888', padding: '8px 0', borderRadius: '10px', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => setActiveBrush(activeBrush === k ? null : k)}>
                      <span style={{ fontSize: '20px', marginBottom: '4px' }}>{BRUSHES[k].icon}</span>
                      <span>{t(`brushes.${k}.label`).split(" ")[1] || t(`brushes.${k}.label`)}</span>
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
                    {activeColor === 'crimson' ? t('colorDescriptions.crimson') :
                      activeColor === 'dark' ? t('colorDescriptions.dark') :
                        activeColor === 'purple' ? t('colorDescriptions.purple') :
                          t('colorDescriptions.blue')}
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
                        {t(`result.tabs.${tab}`)}
                      </button>
                    ))}
                  </div>

                  <div style={{ background: 'rgba(28,28,28,0.9)', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '350px', border: '1px solid #444', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    {/* === 伴侣 tab === */}
                    {identity === 'partner' && (
                      <>
                        <h3 style={{ color: '#fff', margin: '0 0 15px 0' }}>{t('result.partner.title')}</h3>
                        <div style={{ background: 'rgba(211,47,47,0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #d32f2f' }}>
                          <p style={{ color: '#ffcdd2', fontSize: '13px', margin: '0 0 6px 0', lineHeight: '1.5' }}>
                            {t('result.partner.experiencing')}<strong>{content.pain}</strong>。
                          </p>
                          <EditableBlock fieldKey="analogy" defaultValue={content.analogy} color="#ffcdd2" />
                        </div>
                        <div style={{ marginTop: '20px' }}>
                          <strong style={{ color: '#fff', fontSize: '14px' }}>{t('result.partner.actionPrompt')}</strong>
                          <EditableBlock fieldKey="action" defaultValue={content.action} color="#ccc" style={{ marginTop: '10px' }} />
                        </div>
                        <button
                          onClick={() => handleCopy(getEditedOrDefault('action', content.action))}
                          style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #d32f2f', color: '#ffcdd2', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          {t('result.partner.copyAction')}
                        </button>
                        {/* AI 继续优化区域 */}
                        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #333' }}>
                          <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px 0' }}>{t('result.refine.prompt')}</p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              placeholder={t('result.refine.placeholder')}
                              value={refineInput}
                              onChange={(e) => setRefineInput(e.target.value)}
                              style={{ flex: 1, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '12px' }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRefine('analogy');
                              }}
                            />
                            <button
                              onClick={() => handleRefine('analogy')}
                              disabled={refiningField === 'analogy'}
                              style={{
                                background: refiningField === 'analogy' ? '#555' : '#d32f2f',
                                color: '#fff', border: 'none', borderRadius: '8px', padding: '0 15px',
                                cursor: refiningField === 'analogy' ? 'not-allowed' : 'pointer',
                                fontSize: '12px', whiteSpace: 'nowrap'
                              }}>
                              {refiningField === 'analogy' ? t('result.refine.optimizing') : t('result.refine.optimize')}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* === 请假 tab === */}
                    {identity === 'work' && (
                      <>
                        <h3 style={{ color: '#ff9800', margin: '0 0 15px 0' }}>{t('result.work.title')}</h3>
                        <p style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>{t('result.work.description')}</p>
                        <div style={{ background: 'rgba(255,152,0,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,152,0,0.3)' }}>
                          <EditableBlock fieldKey="workText" defaultValue={content.workText} color="#ccc" />
                        </div>
                        <button
                          onClick={() => handleCopy(getEditedOrDefault('workText', content.workText))}
                          style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #ff9800', color: '#ffcc80', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          {t('result.work.copyTemplate')}
                        </button>
                        {/* AI 继续优化区域 */}
                        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #333' }}>
                          <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px 0' }}>{t('result.refine.prompt')}</p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              placeholder={t('result.refine.placeholder')}
                              value={refineInput}
                              onChange={(e) => setRefineInput(e.target.value)}
                              style={{ flex: 1, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '12px' }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRefine('work');
                              }}
                            />
                            <button
                              onClick={() => handleRefine('work')}
                              disabled={refiningField === 'work'}
                              style={{
                                background: refiningField === 'work' ? '#555' : '#d32f2f',
                                color: '#fff', border: 'none', borderRadius: '8px', padding: '0 15px',
                                cursor: refiningField === 'work' ? 'not-allowed' : 'pointer',
                                fontSize: '12px', whiteSpace: 'nowrap'
                              }}>
                              {refiningField === 'work' ? t('result.refine.optimizing') : t('result.refine.optimize')}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* === 医生 tab === */}
                    {identity === 'doctor' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>
                          <h3 style={{ color: '#2196f3', margin: 0 }}>{t('result.doctor.title')}</h3>
                          <span style={{ color: '#666', fontSize: '10px', background: '#111', padding: '2px 8px', borderRadius: '10px' }}>{t('result.doctor.disclaimer')}</span>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                          <h4 style={{ color: '#90caf9', margin: '0 0 5px 0', fontSize: '13px' }}>{t('result.doctor.clinicalAdvice')}</h4>
                          <EditableBlock fieldKey="med_complaint" defaultValue={content.med_complaint} color="#fff" />
                        </div>
                        {/* 针对性检查提醒框 */}
                        {getExamReminders(content.med).map(exam => (
                          <div key={exam} style={{ marginTop: '15px', padding: '12px', marginBottom: '12px', background: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33,150,243,0.3)', borderRadius: '10px' }}>
                            <p style={{ color: '#90caf9', fontSize: '13px', fontWeight: 'bold', margin: '0 0 5px 0' }}>{t('result.doctor.examNotice')}{exam}</p>
                            <p style={{ color: '#aaa', fontSize: '12px', margin: 0 }}><strong>{t('result.doctor.preparation')}</strong>{EXAM_DATABASE[exam]?.prep || ''}</p>
                            <p style={{ color: '#888', fontSize: '11px', margin: 0 }}>
                              <strong>{t('result.doctor.purpose')}</strong>{EXAM_DATABASE[exam]?.purpose || ''}
                            </p>
                          </div>
                        ))}
                        <div style={{ marginTop: '8px', marginBottom: '12px', padding: '10px', background: 'rgba(33,150,243,0.08)', borderLeft: '3px solid #2196f3', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img src={imgUrl} style={{ width: '30px', height: '30px', borderRadius: '4px', objectFit: 'cover' }} alt="thumb" />
                          <p style={{ color: '#90caf9', fontSize: '12px', margin: 0 }}>{t('result.doctor.attachedMap')}</p>
                        </div>
                        <div style={{ padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid #333' }}>
                          <h4 style={{ color: '#e0e0e0', fontSize: '13px', margin: '0 0 10px 0' }}>{t('result.doctor.discussReference')}</h4>
                          <EditableBlock fieldKey="med_reference" defaultValue={content.med_reference} color="#aaa" />
                        </div>
                        <button
                          onClick={() => handleCopy(
                            `${t('result.doctor.clinicalAdvice')}：${getEditedOrDefault('med_complaint', content.med_complaint)}\n\n${t('result.doctor.discussReference')}\n${getEditedOrDefault('med_reference', content.med_reference)}`
                          )}
                          style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #2196f3', color: '#90caf9', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          {t('result.doctor.copyReport')}
                        </button>
                        {/* 医生报告 AI 持续优化区域 */}
                        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #333' }}>
                          <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px 0' }}>{t('result.refine.prompt')}</p>

                          {/* 目标字段切换器 */}
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                            <button
                              onClick={() => setRefineTargetField('med_complaint')}
                              style={{
                                flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                                background: refineTargetField === 'med_complaint' ? 'rgba(33, 150, 243, 0.2)' : '#1a1a1a',
                                color: refineTargetField === 'med_complaint' ? '#90caf9' : '#666',
                                border: `1px solid ${refineTargetField === 'med_complaint' ? '#2196f3' : '#333'}`
                              }}
                            >
                              {t('result.refine.optimizeComplaint')}
                            </button>
                            <button
                              onClick={() => setRefineTargetField('med_reference')}
                              style={{
                                flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                                background: refineTargetField === 'med_reference' ? 'rgba(33, 150, 243, 0.2)' : '#1a1a1a',
                                color: refineTargetField === 'med_reference' ? '#90caf9' : '#666',
                                border: `1px solid ${refineTargetField === 'med_reference' ? '#2196f3' : '#333'}`
                              }}
                            >
                              {t('result.refine.optimizeReference')}
                            </button>
                          </div>
                          {/* 指令输入框 */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              list="refine-options-doctor"
                              placeholder={t('result.refine.placeholder')}
                              value={refineInput}
                              onChange={(e) => setRefineInput(e.target.value)}
                              style={{ flex: 1, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '12px' }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRefine(refineTargetField);
                              }}
                            />
                            <button
                              onClick={() => handleRefine(refineTargetField)}
                              disabled={refiningField === refineTargetField}
                              style={{
                                background: refiningField === refineTargetField ? '#555' : '#2196f3',
                                color: '#fff', border: 'none', borderRadius: '8px', padding: '0 15px',
                                cursor: refiningField === refineTargetField ? 'not-allowed' : 'pointer',
                                fontSize: '12px', whiteSpace: 'nowrap'
                              }}
                            >
                              {refiningField === refineTargetField ? t('result.refine.optimizing') : t('result.refine.optimize')}
                            </button>
                          </div>
                          {/* 医疗场景专属快捷指令 */}
                          <datalist id="refine-options-doctor">
                            <option value="更严肃地描述疼痛严重程度" />
                            <option value="加上关于月经周期的描述" />
                            <option value="用更通俗的语言解释专业术语" />
                            <option value="语气更客观，减少主观色彩" />
                          </datalist>
                        </div>
                      </>
                    )}

                    {/* === 自愈 tab === */}
                    {identity === 'self' && (
                      <>
                        <h3 style={{ color: '#9c27b0', margin: '0 0 15px 0' }}>{t('result.self.title')}</h3>
                        <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.5', marginBottom: '15px' }}>
                          {t('result.self.comfort')}
                        </p>
                        <div style={{ background: 'rgba(156,39,176,0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #9c27b0' }}>
                          <EditableBlock fieldKey="selfCare" defaultValue={content.selfCare} color="#e1bee7" />
                        </div>
                        <button
                          onClick={() => handleCopy(getEditedOrDefault('selfCare', content.selfCare))}
                          style={{ marginTop: '15px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #9c27b0', color: '#e1bee7', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          {t('result.self.copyAdvice')}
                        </button>
                        {/* AI 继续优化区域 */}
                        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #333' }}>
                          <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px 0' }}>{t('result.refine.prompt')}</p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              placeholder={t('result.refine.placeholder')}
                              value={refineInput}
                              onChange={(e) => setRefineInput(e.target.value)}
                              style={{ flex: 1, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '12px' }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRefine('selfcare');
                              }}
                            />
                            <button
                              onClick={() => handleRefine('selfcare')}
                              disabled={refiningField === 'selfcare'}
                              style={{
                                background: refiningField === 'selfcare' ? '#555' : '#d32f2f',
                                color: '#fff', border: 'none', borderRadius: '8px', padding: '0 15px',
                                cursor: refiningField === 'selfcare' ? 'not-allowed' : 'pointer',
                                fontSize: '12px', whiteSpace: 'nowrap'
                              }}>
                              {refiningField === 'selfcare' ? t('result.refine.optimizing') : t('result.refine.optimize')}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '350px', marginTop: '30px', marginBottom: '40px' }}>
                    <button style={{ flex: 2, padding: '14px', borderRadius: '20px', background: '#4caf50', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => prepareSharePreview(content)}>
                      {t('result.shareCard')}
                    </button>
                    <button style={{ flex: 1.5, padding: '14px', borderRadius: '20px', background: '#2196f3', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setShowPostModal(true)}>
                      {t('result.publish')}
                    </button>
                    <button style={{ flex: 1, padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', border: '1px solid #555', color: '#fff', cursor: 'pointer' }} onClick={() => { setPage("onboarding"); }}>
                      {t('result.backHome')}
                    </button>
                  </div>
                </div>
              );
            } catch (e) {
              console.error("Result 渲染出错:", e);
              return (
                <div style={{ pointerEvents: 'auto', position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 20, background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <p>{t('result.reportError')}</p>
                  <button onClick={() => setPage("onboarding")} style={{ marginTop: '20px', padding: '12px 24px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>
                    {t('result.backToHome')}
                  </button>
                </div>
              );
            }
          })()}
          {/* === Community 广场页面 === */}
          {page === "community" && (
            <div style={{ pointerEvents: 'auto', background: '#0a0a0a', width: '100vw', height: '100vh', overflowY: 'auto', padding: '15px', boxSizing: 'border-box' }}>
              {/* 头部固定 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10, paddingBottom: '10px' }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>{t('community.title')}</h2>
                <button className="retry-btn" style={{ margin: 0, padding: '6px 15px', width: 'auto' }} onClick={() => setPage('onboarding')}>{t('community.back')}</button>
              </div>

              {/* 筛选区域 */}
              <div style={{ marginBottom: '15px' }}>
                {/* 第一排：群组筛选 */}
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
                      {f === 'all' ? t('community.filterAll') :
                        f === 'family' ? t('community.filterFamily') :
                          t('community.filterFriend')}
                    </button>
                  ))}
                  <button
                    style={{ padding: '6px 15px', borderRadius: '15px', border: '1px dashed #666', background: 'none', color: '#666', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    onClick={handleCreateGroup}
                  >
                    {t('community.createGroup')}
                  </button>
                </div>

                {/* 第二排：痛感标签筛选 */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                  {[t('community.filterAll'), ...Object.values(PAIN_NAME_MAP)].map(tag => (
                    <button
                      key={tag}
                      onClick={() => setPainFilter(tag === t('community.filterAll') ? 'all' : tag)}
                      style={{
                        padding: '5px 12px', borderRadius: '15px', border: 'none', whiteSpace: 'nowrap',
                        background: (tag === t('community.filterAll') ? painFilter === 'all' : painFilter === tag) ? '#d32f2f' : '#222',
                        color: '#fff', cursor: 'pointer', fontSize: '12px'
                      }}
                    >
                      {tag === t('community.filterAll') ? t('community.filterAll') : `${tag} (${posts.filter(p => p.painTags?.includes(tag)).length})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 共鸣统计横幅 */}
              {(() => {
                const stats = getPainTagStats();  // 现在统计的是 key 而不是中文
                const sortedPains = Object.entries(stats).sort((a, b) => b[1] - a[1]);
                const topPain = sortedPains.length > 0 ? sortedPains[0][0] : 'twist';
                // 阶段一：完全没有数据时的空状态
                if (!topPain) {
                  return (
                    <div style={{
                      background: 'rgba(255, 171, 64, 0.06)',
                      border: '1px solid rgba(255, 171, 64, 0.15)',
                      borderRadius: '10px',
                      padding: '15px',
                      marginBottom: '15px'
                    }}>
                      <p style={{ color: '#ffe0b2', fontSize: '13px', margin: 0, textAlign: 'center', lineHeight: '1.6' }}>
                        {t('community.emptyState')}
                      </p>
                      <p style={{ color: '#888', fontSize: '12px', margin: '8px 0 0 0', textAlign: 'center', lineHeight: '1.6' }}>
                        {t('community.emptyStateSub')}
                      </p>
                      <p style={{ color: '#5d4037', fontSize: '11px', margin: '10px 0 0 0', textAlign: 'center', fontStyle: 'italic' }}>
                        {t('community.emptyStateHint')}
                      </p>
                    </div>
                  );
                }

                // 阶段二：有数据时的正常显示
                const realTotalCount = Object.values(stats).reduce((sum, count) => sum + count, 0);
                const displayCount = realTotalCount < 5 ? 8 : realTotalCount;
                // 显示时翻译
                const displayPain = t(`painNames.${topPain}`);

                return (
                  <div style={{ background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '15px' }}>
                    <p style={{ color: '#ffcdd2', fontSize: '12px', margin: 0, textAlign: 'center' }}>
                      {t('community.weeklyStats', { count: displayCount, pain: displayPain })}
                    </p>
                    <p style={{ color: '#888', fontSize: '11px', margin: '4px 0 0 0', textAlign: 'center' }}>
                      {t('community.statsSub')}
                    </p>
                  </div>
                );
              })()}

              {/* 帖子网格 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '80px' }}>
                {posts.filter(p => {
                  const matchGroup = groupFilter === 'all' || p.group === groupFilter;
                  // 修改 painFilter 筛选逻辑，支持中英文标签
                  const matchPain = painFilter === 'all' ||
                    (p.painTags || []).includes(painFilter) ||
                    (p.painTags || []).includes(t(`painNames.${Object.keys(PAIN_NAME_MAP).find(key => t(`painNames.${key}`) === painFilter)}`));
                  return matchGroup && matchPain;
                }).map((post) => (
                  <div key={post.id}
                    style={{ background: '#1c1c1c', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>

                    <img src={post.img} onClick={() => setViewingPost(post)}
                      style={{ width: '100%', height: '110px', objectFit: 'cover', cursor: 'pointer', background: '#000' }} />

                    <div style={{ padding: '10px', flex: 1 }}>
                      <p style={{ color: '#fff', fontSize: '12px', margin: '0 0 8px 0', fontWeight: 'bold', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {post.text}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <span style={{ color: '#d32f2f', fontSize: '10px', background: 'rgba(211,47,47,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          {post.painTags?.[0] || t('painNames.twist')}
                        </span>

                        <button style={{ background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); alert(t('community.sentResonance')); }}>
                          ❤️ {post.likes}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* === 快速记录页面 === */}
          {page === "quickLog" && (
            <div style={{ pointerEvents: 'auto', background: '#0a0a0a', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
              <h2 style={{ color: '#fff', marginBottom: '5px' }}>{t('quickLog.title')}</h2>
              <p style={{ color: '#666', fontSize: '12px', marginBottom: '30px' }}>{t('quickLog.subtitle')}</p>

              {/* 痛感类型选择 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.keys(BRUSHES).filter(k => k !== 'eraser').map(key => (
                  <button key={key} onClick={() => setQuickPainType(key)}
                    style={{
                      padding: '12px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: quickPainType === key ? '#d32f2f' : '#1e1e1e',
                      color: quickPainType === key ? '#fff' : '#888',
                      border: quickPainType === key ? '2px solid #d32f2f' : '1px solid #444',
                      fontSize: '14px'
                    }}
                  >
                    {BRUSHES[key].icon} {t(`painNames.${key}`)}
                  </button>
                ))}
              </div>

              {/* 疼痛评分滑块 */}
              <div style={{ width: '100%', maxWidth: '300px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '12px', marginBottom: '8px' }}>
                  <span>{t('quickLog.painSlider1')}</span>
                  <span style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '16px' }}>{quickPainScore}/10</span>
                  <span>{t('quickLog.painSlider2')}</span>
                </div>
                <input type="range" min="1" max="10" value={quickPainScore}
                  onChange={(e) => setQuickPainScore(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#d32f2f' }}
                />
              </div>

              {/* 提交按钮 */}
              <button style={{ width: '200px', padding: '14px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
                onClick={handleQuickLogSubmit}
              >
                {t('quickLog.generate')}
              </button>
              <button style={{ marginTop: '15px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px' }}
                onClick={() => setPage('onboarding')}
              >
                {t('quickLog.back')}
              </button>
            </div>
          )}

          {/* --- History (疼痛日记：分类折叠) --- */}
          {page === "history" && (
            <div style={{
              pointerEvents: 'auto',
              background: '#0a0a0a',
              width: '100vw',
              height: '100vh',
              overflowY: 'auto',
              padding: '20px',
              boxSizing: 'border-box',
              WebkitOverflowScrolling: 'touch'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10, paddingBottom: '10px' }}>
                <h2 style={{ color: '#fff', margin: 0 }}>{t('history.title')}</h2>
                <button style={{ margin: 0, padding: '6px 12px', width: 'auto', background: '#2196f3', borderColor: '#2196f3', fontSize: '12px' }} onClick={exportHistoryPDF}>
                  {t('history.export')}
                </button>
                <button className="retry-btn" style={{ margin: 0, padding: '6px 15px', width: 'auto' }} onClick={() => setPage('onboarding')}>
                  {t('history.back')}
                </button>
              </div>

              {/* 趋势概览 */}
              <TrendSummary history={history} />

              {history.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#666', marginTop: '100px' }}>
                  {t('history.empty')}
                </div>
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
                        {t('history.records', { count: records.length })} {collapsedMonths[month] ? '▼' : '▲'}
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
                                {t(`brushes.${h.type}.label`)}
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
          {/* 查看日记详情弹窗*/}
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
                overflow: 'hidden'
              }}
              onClick={() => setViewingDiary(null)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  '&::-webkit-scrollbar': {
                    display: 'none'
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
                        {viewingDiary.meta.colorPalette === 'crimson' ? t('colorDescriptions.crimson').split('：')[0] :
                          viewingDiary.meta.colorPalette === 'dark' ? t('colorDescriptions.dark').split('：')[0] :
                            viewingDiary.meta.colorPalette === 'purple' ? t('colorDescriptions.purple').split('：')[0] :
                              t('colorDescriptions.blue').split('：')[0]}
                      </span>
                    )}
                    {/* 涂抹强度 */}
                    {viewingDiary.meta.painScore > 0 && (
                      <span style={{
                        background: 'rgba(211,47,47,0.15)', borderRadius: '12px',
                        padding: '3px 10px', fontSize: '11px', color: '#ffcdd2'
                      }}>
                        {t('diary.brushCount', { count: viewingDiary.meta.painScore })}
                      </span>
                    )}
                    {/* 部位 */}
                    {viewingDiary.meta.bodyMode && viewingDiary.meta.bodyMode !== 'none' && (
                      <span style={{
                        background: 'rgba(76,175,80,0.12)', borderRadius: '12px',
                        padding: '3px 10px', fontSize: '11px', color: '#a5d6a7'
                      }}>
                        {viewingDiary.meta.bodyMode === 'front' ? t('diary.bodyFront') :
                          viewingDiary.meta.bodyMode === 'back' ? t('diary.bodyBack') : t('diary.bodyBoth')}
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
                          {t('diary.dominantBrush')} {BRUSHES[top]?.icon} {t(`brushes.${top}.label`).split(' ')[1]}
                        </span>
                      );
                    })()}
                  </div>
                )}
                {/* 绘制时段徽章 */}
                {viewingDiary.meta?.dominantPeriod && (
                  <span style={{ background: 'rgba(156, 39, 176, 0.12)', borderRadius: '12px', padding: '3px 10px', fontSize: '11px', color: '#ce93d8' }}>
                    ⏱️ {viewingDiary.meta.dominantPeriod === 'morning' ? t('diary.periodMorning') :
                      viewingDiary.meta.dominantPeriod === 'afternoon' ? t('diary.periodAfternoon') :
                        t('diary.periodNight')}
                  </span>
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

                {/* 用户补充信息 */}
                <div style={{
                  background: 'rgba(28,28,28,0.9)',
                  padding: '18px',
                  borderRadius: '12px',
                  marginTop: '15px',
                  border: '1px solid #444'
                }}>
                  <h4 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '14px' }}>
                    {t('diary.recordFeelings')}
                  </h4>
                  <p style={{ color: '#888', fontSize: '11px', marginBottom: '15px', fontStyle: 'italic' }}>
                    {t('diary.feelingHint')}
                  </p>

                  {/* 持续时间 */}
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                      {t('diary.durationLabel')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('diary.durationPlaceholder')}
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

                  {/* 缓解方式 */}
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                      {t('diary.reliefLabel')}
                    </label>
                    <input
                      type="text"
                      list="relief-options"
                      placeholder={t('diary.reliefPlaceholder')}
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
                      {t('diary.durationOptions').map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>

                  {/* 自由备注 */}
                  <div>
                    <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                      {t('diary.notesLabel')}
                    </label>
                    <textarea
                      placeholder={t('diary.notesPlaceholder')}
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

                {/* 操作按钮区 */}
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
                    <p style={{ color: '#888', fontSize: '12px', marginBottom: '12px' }}>{t('diary.shareContext')}</p>
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
                          {t(`result.tabs.${tab}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 与上次对比视图 */}
                  {history.length > 1 && (
                    <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                      <button
                        onClick={() => setShowCompare(!showCompare)}
                        style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #ff9800', color: '#ff9800', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        {showCompare ? t('diary.compareHide') : t('diary.compareToggle')}
                      </button>

                      {showCompare && (() => {
                        const currentIndex = history.findIndex(h => h.id === viewingDiary.id);
                        const previousRecord = currentIndex < history.length - 1 ? history[currentIndex + 1] : null;

                        if (!previousRecord) {
                          return <p style={{ color: '#666', fontSize: '12px', textAlign: 'center', marginTop: '10px' }}>{t('diary.compareNoData')}</p>;
                        }

                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px' }}>
                            {[viewingDiary, previousRecord].map((record, i) => (
                              <div key={i} style={{ background: '#111', borderRadius: '8px', padding: '10px' }}>
                                <div style={{ color: i === 0 ? '#ef9a9a' : '#90caf9', fontSize: '11px', marginBottom: '6px', fontWeight: 'bold' }}>
                                  {i === 0 ? t('diary.compareThis') : t('diary.compareLast')} · {record.date}
                                </div>
                                <img src={record.img} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', background: '#000' }} />
                                <div style={{ color: '#fff', fontSize: '12px', marginTop: '6px', fontWeight: 'bold' }}>{record.painName}</div>
                                <div style={{ color: '#888', fontSize: '10px', marginTop: '4px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {record.content?.med_complaint}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

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
                      {t('diary.share')}
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
                      {t('diary.publish')}
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
                    {t('diary.close')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* 帖子详情弹窗 (Modal) */}
          {viewingPost && (
            <div style={{ position: 'fixed', zIndex: 1000, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.98)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }} onClick={() => setViewingPost(null)}>
              <div style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', scrollbarWidth: 'none', margin: '0 auto', paddingBottom: '40px' }} onClick={(e) => e.stopPropagation()}>
                {/* 顶部操作 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>{t('post.title')}</span>
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
                    <h4 style={{ color: '#d32f2f', margin: '0 0 8px 0', fontSize: '13px' }}>{t('post.aiAnalysis')}</h4>
                    <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6' }}>
                      {viewingPost.analogy || t('post.aiDefault')}
                    </p>
                  </div>

                  {/* 她的自愈经验 / 亲历经验 区块 */}
                  <div style={{ background: 'rgba(76, 175, 80, 0.05)', padding: '15px', borderRadius: '12px', marginTop: '15px', borderLeft: '4px solid #4caf50' }}>
                    <h4 style={{ color: '#4caf50', margin: '0 0 8px 0', fontSize: '13px' }}>{t('post.selfExperience')}</h4>

                    {/* 如果有亲历经验，优先展示亲历经验 */}
                    {viewingPost.userExperience ? (
                      <div style={{ background: 'rgba(76,175,80,0.1)', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #4caf50' }}>
                        <p style={{ color: '#a5d6a7', fontSize: '12px', fontWeight: 'bold', margin: '0 0 6px 0' }}>
                          {t('post.experienceTitle')}
                        </p>
                        <p style={{ color: '#ccc', fontSize: '12px', margin: 0 }}>{viewingPost.userExperience}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                          {(viewingPost.experienceTags || []).map(tag => (
                            <span key={tag} style={{ background: 'rgba(76,175,80,0.2)', color: '#4caf50', padding: '2px 8px', borderRadius: '10px', fontSize: '10px' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ color: '#888', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                          {viewingPost.reliefExperience || t('post.noExperience')}
                        </p>
                        <button
                          style={{ marginTop: '12px', width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #4caf50', color: '#4caf50', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
                          onClick={() => setShowExpInput(true)}
                        >
                          {t('post.addExperience')}
                        </button>
                      </>
                    )}
                  </div>

                  {/* 内联经验输入框 */}
                  {showExpInput && (
                    <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '12px', marginTop: '12px', border: '1px solid #333' }}>
                      <textarea
                        placeholder={t('post.experiencePlaceholder')}
                        style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '8px', padding: '10px', fontSize: '13px', minHeight: '80px', resize: 'none' }}
                        value={expText}
                        onChange={e => setExpText(e.target.value)}
                      />
                      <input
                        placeholder={t('post.tagsPlaceholder')}
                        style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '8px', padding: '10px', fontSize: '13px', marginTop: '8px' }}
                        value={expTags}
                        onChange={e => setExpTags(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button
                          style={{ flex: 1, padding: '8px', background: '#333', color: '#aaa', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                          onClick={() => setShowExpInput(false)}
                        >{t('post.cancel')}</button>
                        <button
                          style={{ flex: 1, padding: '8px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                          onClick={() => handleSaveExperience(viewingPost)}
                        >{t('post.publishExperience')}</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 底部互动按钮区 */}
                <div style={{
                  marginTop: '25px',
                  paddingTop: '20px',
                  borderTop: '1px solid #222',
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const isHugged = viewingPost.hasUserHugged;

                      setPosts(prev => prev.map(p =>
                        p.id === viewingPost.id
                          ? { ...p, hugs: p.hugs + (isHugged ? -1 : 1), hasUserHugged: !isHugged }
                          : p
                      ));

                      setViewingPost(vp => ({
                        ...vp,
                        hugs: vp.hugs + (isHugged ? -1 : 1),
                        hasUserHugged: !isHugged
                      }));

                      showToast(isHugged ? "hugRetracted" : "hugSent");
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: viewingPost.hasUserHugged
                        ? 'rgba(211, 47, 47, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${viewingPost.hasUserHugged ? '#d32f2f' : '#333'}`,
                      borderRadius: '25px',
                      padding: '12px 30px',
                      color: viewingPost.hasUserHugged ? '#ff5252' : '#888',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: viewingPost.hasUserHugged ? '0 0 15px rgba(211, 47, 47, 0.3)' : 'none',
                      animation: viewingPost.hasUserHugged ? 'pulse 0.5s ease-in-out' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>
                      {viewingPost.hasUserHugged ? '❤️' : '🤍'}
                    </span>
                    <span>{viewingPost.hasUserHugged ? t('post.hugged') : t('post.giveHug')}</span>
                    <span style={{
                      fontSize: '13px',
                      color: viewingPost.hasUserHugged ? '#ef9a9a' : '#666',
                      fontWeight: 'normal'
                    }}>
                      {viewingPost.hugs}
                    </span>
                  </button>
                </div>

              </div>
            </div>
          )}
          {/* 帖子发布弹窗 */}
          {showPostModal && (
            <div style={{
              position: 'fixed', zIndex: 500, top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box'
            }}>
              <div style={{
                background: '#1c1c1c', padding: '24px', borderRadius: '20px', width: '100%',
                maxWidth: '380px', border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                wordBreak: 'break-all',
              }}>

                {/* 标题区 */}
                <h3 style={{ color: '#fff', marginTop: 0, fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
                  {t('publishModal.title')}
                </h3>

                {/* 引导语 */}
                <div style={{
                  background: 'rgba(255, 152, 0, 0.06)',
                  border: '1px solid rgba(255, 152, 0, 0.15)',
                  borderRadius: '12px', padding: '12px 14px', marginBottom: '16px'
                }}>
                  <p style={{ color: '#ffcc80', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                    {t('publishModal.hint')}
                  </p>
                </div>

                {/* 图片预览区 */}
                {imgUrl && (
                  <div style={{ marginBottom: '15px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
                    <img src={imgUrl} style={{ width: '100%', display: 'block' }} alt="preview" />
                  </div>
                )}

                {/* 输入框 */}
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder={t('publishModal.placeholder')}
                  style={{
                    width: '100%', height: '100px', background: '#111', color: '#fff',
                    border: '1px solid #333', borderRadius: '12px', padding: '14px',
                    boxSizing: 'border-box', marginBottom: '20px', fontSize: '14px',
                    lineHeight: '1.5', resize: 'none',
                    outline: 'none'
                  }}
                />

                {/* 按钮组 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    style={{
                      flex: 1, padding: '12px', background: '#2a2a2a', color: '#999',
                      border: 'none', borderRadius: '12px', cursor: 'pointer',
                      fontSize: '14px', fontWeight: 'bold'
                    }}
                    onClick={() => setShowPostModal(false)}
                  >
                    {t('publishModal.cancel')}
                  </button>
                  <button
                    style={{
                      flex: 1, padding: '12px', background: 'linear-gradient(135deg, #ff9800, #f44336)',
                      color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer',
                      fontSize: '14px', fontWeight: 'bold',
                      boxShadow: '0 4px 15px rgba(244, 67, 54, 0.3)'
                    }}
                    onClick={handlePublishPost}
                  >
                    {t('publishModal.submit')}
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
                  {t('sharePreview.title')}
                </h3>

                {/* 预览说明 */}
                <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', marginBottom: '15px' }}>
                  {shareContent.historyImg ? t('sharePreview.archiveReview') : (
                    (!pgFrontRef.current) ? t('sharePreview.loading') :
                      (isSideEmpty('front') && isSideEmpty('back') ? t('sharePreview.noContent') : t('sharePreview.livePreview'))
                  )}
                </p>

                {/* 缩略图显示 */}
                <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                  <img
                    src={shareContent.historyImg || imgUrl}
                    style={{ width: '100%', maxWidth: '300px', borderRadius: '8px', border: '1px solid #444' }}
                    alt="preview"
                  />
                </div>

                {/* 文字预览 - 根据身份显示 */}
                {(() => {
                  const getPreviewText = () => {
                    switch (shareContent.identity) {
                      case 'partner':
                        return {
                          title: t('shareCard.titles.partner'),
                          content: shareContent.analogy?.slice(0, 80) + '...'
                        };
                      case 'work':
                        return {
                          title: t('shareCard.titles.work'),
                          content: shareContent.workText?.slice(0, 80) + '...'
                        };
                      case 'doctor':
                        return {
                          title: t('shareCard.titles.doctor'),
                          content: (shareContent.med_complaint || t('sharePreview.defaultDoctorContent'))?.slice(0, 80) + '...'
                        };
                      case 'self':
                        return {
                          title: t('shareCard.titles.self'),
                          content: shareContent.selfCare?.slice(0, 80) + '...'
                        };
                      default:
                        return {
                          title: t('sharePreview.defaultTitle'),
                          content: t('sharePreview.defaultContent', { pain: shareContent.pain || '' })
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
                    {t('sharePreview.cancel')}
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
                    {t('sharePreview.confirm')}
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
                animation: 'spin 1s linear infinite'
              }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <p style={{ color: '#fff', marginTop: '20px', letterSpacing: '2px' }}>{t('app.loading')}</p>
              <p style={{ color: '#666', fontSize: '12px' }}>{t('app.loadingSub')}</p>
              <p style={{ color: '#666', fontSize: '12px' }}>
                {t('app.loadingHint')}
              </p>
            </div>
          )}
        </div>
      </>
    );
  } catch (error) {
    console.error("AppContent 渲染错误详情:", error);
    return (
      <div style={{ color: 'red', padding: '20px' }}>
        <h2>渲染错误</h2>
        <pre>{error.message}</pre>
        <pre>{error.stack}</pre>
      </div>
    );
  }
}
export default function App() {
  const [targetLanguage, setTargetLanguage] = useState("zh");

  return (
    <ErrorBoundary>
      <I18nProvider lang={targetLanguage}>
        <AppContent
          targetLanguage={targetLanguage}
          setTargetLanguage={setTargetLanguage}
        />
      </I18nProvider>
    </ErrorBoundary>
  );
}