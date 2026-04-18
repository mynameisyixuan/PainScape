# 🩸 PainScape
**Beyond the Scale: An Embodied Visual Expression and Semantic Translation System for Menstrual Pain**  
*(超越量表：面向女性经期疼痛的具身视觉表达与语义转译系统)*

![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square&logo=react&logoColor=black)
![p5.js](https://img.shields.io/badge/Engine-p5.js-ED225D?style=flat-square&logo=p5.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Status](https://img.shields.io/badge/Status-Beta_Iterating-4CAF50?style=flat-square)

> *"The pain feels like an unripe fruit being peeled by force, with shreds of real flesh still attached and constantly torn."*  
> *"痛经就像一颗未完全成熟的果实被生生剥皮，皮上还连着丝丝缕缕真实的血肉..."* —— 来自 PainScape 用户深度访谈

## 📖 About The Project | 项目简介

原发性痛经困扰着全球超半数育龄女性，但在传统的医疗评估与 FemTech（女性健康科技）应用中，复杂的痛觉体验往往被降维成单一的 **“1-10分数字量表”**。这种“量化霸权”与“粉色温馨”的刻板印象，加剧了女性在医患沟通、职场请假与亲密关系中的失语困境（Medical Gaslighting）。

**PainScape** 是一个基于 **女性主义残疾研究（FDS）** 与 **不适感设计（Designing with Discomfort）** 理论开发的生成式交互系统。我们主张：疼痛不应只是需要被隐藏的“私事”，而是一种需要被表达、被看见的生命体验。

本系统通过前端物理引擎，将患者的“痛觉隐喻”转化为极具破坏力的生成式艺术视觉证据；并结合 AI 大语言模型（LLM），将其动态转译为适用于多社会语境（医疗、职场、伴侣）的结构化文本报告，致力打破认知壁垒，赋权女性夺回身体的叙事权。

---

## ✨ Core Features | 核心创新功能

### 1. 🎨 Embodied Generative Brushes (具身生成式画笔)
彻底抛弃静态贴图与平滑渲染，基于 8000+ 真实 UGC 数据的隐喻提取，自主研发了基于 **p5.js 的动态粒子物理引擎**。通过 **手势动能映射（Kinetic Mapping）**，实时捕捉滑动速度与方向：
*   🌪️ **绞/拧 (Twist):** 带有向心旋转矩阵与高对比度折线的“打结钢丝”。
*   ⚡️ **荆/刺 (Pierce):** 顺应手指滑动方向，带有随机倒刺的锐利穿透线。
*   🪨 **坠/压 (Heavy):** 抛弃圆形，模拟沉重泥块/血液的倒水滴状坠落感。
*   〰️ **胀/扩 (Wave):** 突破静态限制，基于时间轴持续“呼吸”的弥散性水肿。
*   🔪 **刮/撕 (Scrape):** 参差不齐的平行错落直线，概率掉落尖锐碎屑。

### 2. 🧠 Multi-Context Semantic Translation (跨语境语义转译)
打破单一的“健康打卡”孤岛，系统自动解析用户的视觉参数与预设偏好，一键生成四大沟通卡片：
*   🫂 **伴侣说明书：** 摒弃鸡汤，基于大模型生成极度务实的“实操照顾指令”。
*   💼 **职场请假声明：** 生成不卑不亢的“不可见痛苦声明”，助力 DEI 职场建设。
*   🩺 **医疗辅助报告：** 转译为主诉、放射痛及排查建议，辅助医生门诊分诊。
*   ❤️ **自我关怀日记：** 基于痛觉类型，匹配切实有效的真实缓解动作。

### 3. 🛠 Hardcore UX Engineering (极致的交互架构)
*   **离屏双缓冲渲染 (Off-screen Buffer):** 彻底剥离底图与笔触图层，实现无损的移动端画布拖拽与 3 倍缩放。
*   **内存级双栈状态机 (Undo/Redo Stack):** 在 React 与 Canvas 混合生命周期下，实现包含动态呼吸粒子在内的 O(1) 复杂度单步撤销与重做。
*   **正反视角的空间重构：** 引入躯干正面/背面一键切换功能，精准表达放射性转移痛。

---

## ⚙️ Tech Stack | 技术架构

本项目采用标准的前后端分离全栈架构：
*   **Frontend (前端):** React, Vite, p5.js, react-p5
*   **Backend (后端):** Python, FastAPI, Uvicorn
*   **AI Engine (AI 引擎):** Qwen API (通义千问大模型) / OpenAI Compatible API
*   **Data Processing (研究支持):** Pandas, scikit-learn (LDA Modeling), Jieba

---

## 🚀 Quick Start | 本地部署与运行指南

### 1. 克隆项目到本地
```bash
git clone https://github.com/mynameisyixuan/PainScape.git
cd PainScape
```

### 2. 前端部署 (Frontend Setup)
前端代码位于 `frontend` 目录下。
```bash
cd frontend
npm install
npm run dev
```
👉 *启动后，在浏览器中访问 `http://localhost:5173` 即可查看前端界面。*  
> ⚠️ **注意：** 需确保在 `frontend/public/` 目录下放置了 `body_front.png` 和 `body_back.png` 作为人体底图。

### 3. 后端部署与 AI 接入 (Backend Setup)
后端代码位于 `backend` 目录下。建议使用虚拟环境（venv）运行。
```bash
# 新开一个终端窗口，进入后端目录
cd backend

# 创建并激活虚拟环境 (以 Windows 为例，Mac/Linux 请使用 source venv/bin/activate)
python -m venv venv
.\venv\Scripts\activate

# 安装依赖
pip install fastapi uvicorn openai python-dotenv pydantic
```

**🔑 配置环境变量：**
在 `backend` 目录下新建一个 `.env` 文件，并填入你的通义千问 API Key（或替换为其他兼容的 OpenAI API Key）：
```env
DASHSCOPE_API_KEY="sk-你的真实APIKey"
```

**🏃 启动后端服务器：**
```bash
uvicorn main:app --reload
```
👉 *当终端显示 `Application startup complete` 时，说明后端已成功运行在 `http://localhost:8000`。此时在前端点击“生成”，即可体验大模型动态转译功能！*

---

## 🎯 Online Demo | 在线演示

目前前端核心交互已部署上线，欢迎通过手机或电脑浏览器直接体验：

👉 **[点击此处访问 PainScape 在线体验版](https://pain-scape.vercel.app/)** 👈

*(注：线上演示版暂采用前端静态数据进行文本生成。如需体验完整的 LLM 动态转译功能，请参照上方指南进行本地全栈部署。)*

---

## 📅 Roadmap | 后续规划

- [x] 多源社交媒体数据挖掘与隐喻参数模型构建 (N=6800+)
- [x] 基于 140 份定量问卷与深度访谈的痛点需求验证
- [x] 前端 p5.js 物理引擎重构与离屏双缓冲渲染
- [x] 搭建 FastAPI 后端并接入 LLM 实现动态结构化生成
- [ ] 针对医生群体开展临床转译卡片的可用性评估 (Usability Testing)

---

## 🤝 Authors & Acknowledgments | 致谢
特别感谢所有参与本研究问卷填写与深度访谈的女性。是你们勇敢分享的痛觉记忆，赋予了这些冰冷的代码与图形以真实的血肉与灵魂。

> *" We share the pain, and we heal together."*
