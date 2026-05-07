from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
if not DASHSCOPE_API_KEY:
    raise ValueError("🚨 未找到 DASHSCOPE_API_KEY，请检查 .env 文件！")

client = OpenAI(
    api_key=DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PainData(BaseModel):
    dominantPain: str
    userPref: str
    painScore: int
    brushCounts: Optional[Dict[str, int]] = None
    spatialMap: Optional[Dict[str, float]] = None
    intensityProfile: Optional[Dict[str, float]] = None
    colorPalette: Optional[str] = None
    bodyMode: Optional[str] = None
    medicalBackground: Optional[Dict[str, str]] = None
    tonePreference: Optional[str] = "gentle"


PAIN_MAP = {
    "twist": "绞痛/痉挛性收缩痛",
    "pierce": "针刺/钻痛/放射痛",
    "heavy": "重压坠胀感",
    "wave": "弥漫性阵发性胀痛",
    "scrape": "刀刮撕裂痛"
}

BODY_MODE_MAP = {
    "front": "腹部/盆腔前侧",
    "back": "腰骶部/后侧",
    "both": "腹部与腰骶部双侧"
}

BRUSH_LABEL_MAP = {
    "twist": "绞/拧",
    "pierce": "荆/刺",
    "heavy": "坠/压",
    "wave": "胀/扩",
    "scrape": "刮/撕"
}


@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    mb = data.medicalBackground or {}
    intensity = data.intensityProfile or {}
    spatial = data.spatialMap or {}
    brush_counts = data.brushCounts or {}

    pain_type = PAIN_MAP.get(data.dominantPain, "复合性痛经")
    body_location = BODY_MODE_MAP.get(data.bodyMode or "front", "腹部/盆腔")
    diagnosed = mb.get("diagnosed", "无既往病史记录")
    allergies = mb.get("allergies", "无已知过敏")

    # 组装笔触分布描述
    brush_desc_parts = []
    for k, v in brush_counts.items():
        if v > 0 and k in BRUSH_LABEL_MAP:
            brush_desc_parts.append(f"{BRUSH_LABEL_MAP[k]}({v}次)")
    brush_desc = "、".join(brush_desc_parts) if brush_desc_parts else "单一笔触"

    # 组装空间分布
    spatial_desc = "分布均匀"
    if spatial:
        top_regions = sorted(spatial.items(), key=lambda x: x[1], reverse=True)[:3]
        spatial_desc = "集中于" + "、".join([r[0] for r in top_regions])

    # 涂抹强度
    avg_speed = intensity.get("avgSpeed", 0)
    if avg_speed > 15:
        intensity_desc = "高强度急促涂抹（提示剧烈疼痛）"
    elif avg_speed > 7:
        intensity_desc = "中等强度涂抹（提示持续性疼痛）"
    else:
        intensity_desc = "低强度缓慢涂抹（提示钝痛或隐痛）"

    # 受众语气
    tone_map = {
        "gentle": "温柔体贴、注重情感支持",
        "professional": "简洁专业、以事实为主",
        "assertive": "直接有力、边界清晰"
    }
    tone_desc = tone_map.get(data.tonePreference or "gentle", "温柔体贴")

    system_prompt = """你是一个专业的痛经疼痛管理顾问，擅长将具身化的疼痛感知数据转译为不同社会场景下的语言表达。

你必须严格按照以下 JSON schema 输出，不得添加任何额外字段或解释性文字：

{
  "analogy": "（面向伴侣）用生动的通感比喻描述这种痛觉，帮助没有痛经经验的人感同身受，语气温柔真实，60-80字",
  "work": "（面向职场/HR）一段正式简洁的请假或居家申请说明，避免情绪化表达，突出生理客观性，40-60字",
  "med": "（面向医生）规范医疗语言的主诉描述，包含疼痛性质、部位、强度、伴随症状推测，60-100字",
  "selfCare": "（面向自身）3条具体可操作的当下自愈建议，分行列出，每条20字以内，避免建议过敏药物"
}

规则：
1. selfCare 中严禁推荐患者过敏的药物（过敏信息会在数据中提供）
2. analogy 必须包含至少一个具体的感官比喻
3. med 必须使用"患者自述"开头
4. 所有内容必须基于提供的疼痛数据，不得虚构症状
5. 输出必须是合法 JSON，不含 markdown 代码块
6. 如果建议患者进行检查，请务必在 'med' 字段中使用以下精确术语之一：盆腔超声、经阴道超声、激素六项、腹腔镜。"""

    user_prompt = f"""以下是患者的痛觉绘图数据，请据此生成四场景转译报告：

【疼痛基本信息】
- 主导痛觉类型：{pain_type}
- 疼痛部位：{body_location}
- 疼痛自评分：{data.painScore}/10
- 色彩选择：{data.colorPalette or '深红'}（反映情绪状态）

【绘图行为数据】
- 笔触分布：{brush_desc}
- 涂抹强度：{intensity_desc}
- 空间分布：{spatial_desc}

【既往病史】
- 已确诊疾病：{diagnosed}
- 药物过敏：{allergies}（selfCare 中严禁推荐此类药物）

【语气偏好】{tone_desc}

请生成 JSON 报告："""

    try:
        print("🤖 正在请求通义千问...")
        completion = client.chat.completions.create(
            model="qwen-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.6,
            response_format={"type": "json_object"},
        )

        raw = completion.choices[0].message.content
        llm_reply = json.loads(raw)

        # 字段校验：确保前端所需字段都存在
        required_fields = ["analogy", "work", "med", "selfCare"]
        for field in required_fields:
            if field not in llm_reply:
                llm_reply[field] = f"[{field} 数据生成失败，请重试]"

        return {"status": "success", **llm_reply}

    except Exception as e:
        print(f"🚨 后端错误: {e}")
        return {
            "status": "error",
            "analogy": "像有人把你的腹部拧成麻花，又用烙铁烫过——这不是夸张，这是真实发生的事。",
            "work": "因严重原发性痛经，本人今日无法正常出勤，预计需居家休息一天，特此说明。",
            "med": "患者自述下腹部痉挛性绞痛，程度较重，伴腰骶部坠胀，今日为月经周期第一天，症状影响日常功能。",
            "selfCare": "• 热水袋敷于下腹部15-20分钟\n• 膝胸卧位缓解盆腔充血\n• 补充镁元素（如坚果）有助于缓解痉挛"
        }


@app.get("/")
def read_root():
    return {"Message": "PainScape Backend (Powered by Qwen AI) is Running!"}