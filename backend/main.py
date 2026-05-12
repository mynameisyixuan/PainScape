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


# ─────────────────────────────────────────────
# 数据模型
# ─────────────────────────────────────────────

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
    cycleDay: str = "未提供"
    targetLanguage: Optional[str] = "zh"
    isQuickLog: Optional[bool] = False


# ─────────────────────────────────────────────
# 双语映射表
# ─────────────────────────────────────────────

PAIN_MAP = {
    "zh": {
        "twist": "绞痛/痉挛性收缩痛",
        "pierce": "针刺/钻痛/放射痛",
        "heavy": "重压坠胀感",
        "wave": "弥漫性阵发性胀痛",
        "scrape": "刀刮撕裂痛",
    },
    "en": {
        "twist": "cramping / spasmodic colicky pain",
        "pierce": "stabbing / drilling / radiating pain",
        "heavy": "heavy pressure / dragging sensation",
        "wave": "diffuse intermittent bloating pain",
        "scrape": "scraping / tearing pain",
    },
}

BODY_MODE_MAP = {
    "zh": {
        "front": "腹部/盆腔前侧",
        "back": "腰骶部/后侧",
        "both": "腹部与腰骶部双侧",
    },
    "en": {
        "front": "anterior abdomen / pelvis",
        "back": "lumbosacral region / posterior",
        "both": "bilateral abdomen and lumbosacral region",
    },
}

BRUSH_LABEL_MAP = {
    "zh": {
        "twist": "绞/拧",
        "pierce": "荆/刺",
        "heavy": "坠/压",
        "wave": "胀/扩",
        "scrape": "刮/撕",
    },
    "en": {
        "twist": "Cramp/Twist",
        "pierce": "Pierce/Stab",
        "heavy": "Press/Weight",
        "wave": "Bloat/Spread",
        "scrape": "Scrape/Tear",
    },
}

TONE_MAP = {
    "zh": {
        "gentle": "温柔体贴、注重情感支持",
        "professional": "简洁专业、以事实为主",
        "assertive": "直接有力、边界清晰",
    },
    "en": {
        "gentle": "warm and empathetic, emotionally supportive",
        "professional": "concise and professional, fact-based",
        "assertive": "direct and firm, clear boundaries",
    },
}

DIAGNOSED_MAP = {
    "zh": {
        "endometriosis": "子宫内膜异位症",
        "adenomyosis": "子宫腺肌病",
        "fibroids": "子宫肌瘤",
        "pcos": "多囊卵巢综合征（PCOS）",
        "pid": "盆腔炎（PID）",
        "ovariancyst": "卵巢囊肿",
        "cervicalstenosis": "宫颈狭窄",
        "unchecked": "未做过相关妇科检查",
        "none": "无既往病史记录",
        "": "无既往病史记录",
    },
    "en": {
        "endometriosis": "Endometriosis",
        "adenomyosis": "Adenomyosis",
        "fibroids": "Uterine Fibroids",
        "pcos": "Polycystic Ovary Syndrome (PCOS)",
        "pid": "Pelvic Inflammatory Disease (PID)",
        "ovariancyst": "Ovarian Cyst",
        "cervicalstenosis": "Cervical Stenosis",
        "unchecked": "No gynecological examination performed",
        "none": "No previous diagnosis on record",
        "": "No previous diagnosis on record",
    },
}

ALLERGY_FALLBACK = {
    "zh": "无已知过敏记录",
    "en": "No known drug allergies",
}

ALLERGY_NONE_KEYS = ["unknown", "none", "", None]


# ─────────────────────────────────────────────
# 辅助函数：根据语言构建描述文本
# ─────────────────────────────────────────────

def build_brush_desc(brush_counts: Dict[str, int], lang: str) -> str:
    label_map = BRUSH_LABEL_MAP.get(lang, BRUSH_LABEL_MAP["zh"])
    parts = [
        f"{label_map[k]}({v})" for k, v in brush_counts.items() if v > 0 and k in label_map
    ]
    if not parts:
        return "single stroke type" if lang == "en" else "单一笔触"
    sep = ", " if lang == "en" else "、"
    return sep.join(parts)


def build_spatial_desc(spatial: Dict[str, float], lang: str) -> str:
    if not spatial:
        return "evenly distributed" if lang == "en" else "分布均匀"
    top_regions = sorted(spatial.items(), key=lambda x: x[1], reverse=True)[:3]
    names = ", ".join(r[0] for r in top_regions)
    return f"concentrated at: {names}" if lang == "en" else f"集中于{names.replace(', ', '、')}"


def build_intensity_desc(avg_speed: float, lang: str) -> str:
    if lang == "en":
        if avg_speed > 15:
            return "high-intensity rapid strokes (suggests severe pain)"
        elif avg_speed > 7:
            return "moderate-intensity strokes (suggests persistent pain)"
        else:
            return "low-intensity slow strokes (suggests dull or achy pain)"
    else:
        if avg_speed > 15:
            return "高强度急促涂抹（提示剧烈疼痛）"
        elif avg_speed > 7:
            return "中等强度涂抹（提示持续性疼痛）"
        else:
            return "低强度缓慢涂抹（提示钝痛或隐痛）"


def build_cycle_context(cycle_day: str, lang: str) -> str:
    """根据月经周期天数生成临床指导语境描述（双语）"""
    if not cycle_day or cycle_day in ["未提供", "Not provided", ""]:
        return ""

    # 标准化：支持中英文周期描述
    day_str = cycle_day.lower()

    if lang == "en":
        if "day 1" in day_str or "day 2" in day_str or "第1天" in cycle_day or "第2天" in cycle_day:
            return (
                "Patient is in the acute phase (Day 1-2): prostaglandin secretion peaks, pain is most severe. "
                "selfCare must focus on acute pain management (e.g., emergency relief postures, rapid heat therapy). "
                "analogy should reflect the sudden and intense onset of pain."
            )
        elif any(d in cycle_day for d in ["第3", "第4", "第5"]) or any(d in day_str for d in ["day 3", "day 4", "day 5"]):
            return (
                "Patient is in the recovery phase (Day 3-5): acute pain subsiding but fatigue and heaviness remain. "
                "selfCare must focus on recovery and nutrition (e.g., iron-rich diet, gentle stretching). "
                "Note any persistent dull pain that may warrant follow-up."
            )
        elif "排卵" in cycle_day or "ovulat" in day_str:
            return (
                "Patient is experiencing mid-cycle / ovulation pain (non-menstrual): this may indicate endometriosis or pelvic adhesions. "
                "med must flag potential association and recommend evaluation. "
                "selfCare should emphasize keeping a pain diary for non-menstrual pain episodes."
            )
    else:
        if cycle_day in ["第1天", "第2天"]:
            return (
                "患者处于月经第1-2天（急性期），此时前列腺素分泌达峰，疼痛最为剧烈。"
                "selfCare 必须侧重急性疼痛管理（如紧急止痛姿势、快速热敷法），"
                "analogy 需体现痛感的急性发作与猛烈程度。"
            )
        elif any(d in cycle_day for d in ["第3", "第4", "第5"]):
            return (
                "患者处于月经第3-5天（缓解期），急性疼痛开始消退但伴随疲劳与坠胀。"
                "selfCare 必须侧重修复与营养补充（如补铁饮食、温和拉伸），"
                "建议关注是否有需要复查的持续隐痛。"
            )
        elif "排卵" in cycle_day:
            return (
                "患者处于排卵期疼痛（非经期痛），这属于异常疼痛。"
                "med 必须提示其与子宫内膜异位症或盆腔粘连的潜在关联，建议排查，"
                "selfCare 需强调非经期痛的观察记录。"
            )
    return ""


def resolve_diagnosed(raw: Optional[str], lang: str) -> str:
    key = raw or ""
    d_map = DIAGNOSED_MAP.get(lang, DIAGNOSED_MAP["zh"])
    # 尝试精确匹配
    if key in d_map:
        return d_map[key]
    # 未命中：返回原始值（用户自填内容），如果为空则用默认
    return raw if raw else d_map.get("none", "")


def resolve_allergies(raw: Optional[str], lang: str) -> str:
    if raw in ALLERGY_NONE_KEYS:
        return ALLERGY_FALLBACK.get(lang, ALLERGY_FALLBACK["zh"])
    return raw or ALLERGY_FALLBACK.get(lang, ALLERGY_FALLBACK["zh"])


def resolve_color(color: Optional[str], lang: str) -> str:
    if not color:
        return "Crimson" if lang == "en" else "深红"
    return color


def resolve_cycle_label(cycle_day: str, lang: str) -> str:
    """用于 prompt 中的周期文字"""
    if not cycle_day or cycle_day in ["未提供", ""]:
        return "Not provided" if lang == "en" else "未提供"
    return cycle_day


# ─────────────────────────────────────────────
# System Prompts（双语）
# ─────────────────────────────────────────────

SYSTEM_PROMPT_ZH = """你是一个专业的痛经疼痛管理顾问，擅长将具身化的疼痛感知数据转译为不同社会场景下的语言表达。

你必须严格按照以下 JSON schema 输出，不得添加任何额外字段或解释性文字：

{
  "analogy": "（面向伴侣）用生动的通感比喻描述这种痛觉，帮助没有痛经经验的人感同身受，语气温柔真实，120-160字",
  "work": "（面向职场/HR）一段正式简洁的请假或居家申请说明，避免情绪化表达，突出生理客观性，80-120字",
  "med": "（面向医生）规范医疗语言的主诉描述，包含疼痛性质、部位、强度、伴随症状推测，60-100字",
  "selfCare": "（面向自身）5条具体可操作的当下自愈建议，分行列出，每条30字以内，涵盖姿势、热敷、饮食、呼吸、心理5个维度，避免建议过敏药物"
}

规则：
1. selfCare 中严禁推荐患者过敏的药物（过敏信息会在数据中提供）
2. analogy 必须包含至少一个具体的感官比喻，语言要丰富，用通用器官的痛感转译让大多数人能够想象。参考：强烈的刺钻神经性痛感可描述为"不打麻药做根管治疗"，"用脚碾小腿骨"等。
3. med 必须以"患者自述"开头
4. 所有内容必须基于提供的疼痛数据，不得虚构症状
5. 输出必须是合法 JSON，不含 markdown 代码块
6. 如需建议检查，在 med 字段使用精确术语：盆腔超声、经阴道超声、激素六项、腹腔镜，并附简要解释
7. 重要：所有输出文字必须使用简体中文"""

SYSTEM_PROMPT_ZH_QUICK = SYSTEM_PROMPT_ZH + (
    "\n\n特别注意：用户处于剧烈疼痛的快速记录模式，数据颗粒度较粗。"
    "请基于提供的疼痛类型和评分直接给出最核心、最急需的缓解建议，语气要更加安抚和直接，减少长篇大论的比喻。"
)

SYSTEM_PROMPT_EN = """You are a professional menstrual pain management consultant, skilled at translating embodied pain perception data into language expressions for different social scenarios.

You must output strictly according to the following JSON schema, without adding any extra fields or explanatory text:

{
  "analogy": "(For partner) A vivid synesthetic metaphor describing this pain, helping those without period pain experience it empathetically, in a warm and authentic tone, 100-150 words",
  "work": "(For workplace/HR) A formal, concise leave or work-from-home request, avoiding emotional language, emphasizing physiological objectivity, 60-100 words",
  "med": "(For doctor) A standardized medical chief complaint, including pain nature, location, intensity, and suspected accompanying symptoms, 50-80 words",
  "selfCare": "(For self) 5 specific, immediately actionable self-care suggestions, listed separately, each within 20 words, covering posture, heat therapy, diet, breathing, and psychological dimensions; avoid recommending allergen medications"
}

Rules:
1. selfCare must NEVER recommend medications the patient is allergic to (allergy info provided in the data)
2. analogy must include at least one specific sensory metaphor using common bodily pain references most people can imagine (e.g., intense nerve pain: "like a root canal without anesthesia", "someone pressing a heel into your shin bone")
3. med must start with "Patient reports"
4. All content must be grounded in the provided pain data; do not fabricate symptoms
5. Output must be valid JSON with no markdown code blocks
6. When recommending examinations, use precise terms in med: pelvic ultrasound, transvaginal ultrasound, hormone panel, laparoscopy — with a brief plain-language explanation for each
7. IMPORTANT: All output text must be in English only"""

SYSTEM_PROMPT_EN_QUICK = SYSTEM_PROMPT_EN + (
    "\n\nSpecial note: The user is in quick-log mode due to severe pain and data granularity is low. "
    "Prioritize the most essential and immediately actionable relief suggestions. "
    "Keep the tone calm, reassuring, and direct. Minimize lengthy analogies."
)


# ─────────────────────────────────────────────
# /api/generate 端点
# ─────────────────────────────────────────────

@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    mb = data.medicalBackground or {}
    intensity = data.intensityProfile or {}
    spatial = data.spatialMap or {}
    brush_counts = data.brushCounts or {}
    lang = data.targetLanguage or "zh"
    is_quick = data.isQuickLog or False

    # ── 解析映射值（双语）──
    pain_type = PAIN_MAP.get(lang, PAIN_MAP["zh"]).get(data.dominantPain, "complex dysmenorrhea" if lang == "en" else "复合性痛经")
    body_location = BODY_MODE_MAP.get(lang, BODY_MODE_MAP["zh"]).get(data.bodyMode or "front", "anterior abdomen/pelvis" if lang == "en" else "腹部/盆腔")
    diagnosed = resolve_diagnosed(mb.get("diagnosed"), lang)
    allergies = resolve_allergies(mb.get("allergies"), lang)
    tone_desc = TONE_MAP.get(lang, TONE_MAP["zh"]).get(data.tonePreference or "gentle", "warm and empathetic" if lang == "en" else "温柔体贴")
    color = resolve_color(data.colorPalette, lang)
    cycle_label = resolve_cycle_label(data.cycleDay, lang)

    # ── 构建描述性文本（双语）──
    brush_desc = build_brush_desc(brush_counts, lang)
    spatial_desc = build_spatial_desc(spatial, lang)
    avg_speed = intensity.get("avgSpeed", 0)
    intensity_desc = build_intensity_desc(avg_speed, lang)
    cycle_context = build_cycle_context(data.cycleDay, lang)

    # ── 选择 System Prompt ──
    if lang == "en":
        system_prompt = SYSTEM_PROMPT_EN_QUICK if is_quick else SYSTEM_PROMPT_EN
    else:
        system_prompt = SYSTEM_PROMPT_ZH_QUICK if is_quick else SYSTEM_PROMPT_ZH

    # ── 构建 User Prompt（双语）──
    if lang == "en":
        cycle_section = f"Menstrual cycle: {cycle_label}"
        if cycle_context:
            cycle_section += f"\nClinical context: {cycle_context}"

        user_prompt = f"""Based on the following patient pain mapping data, generate a four-scenario translation report:

[Basic Pain Information]
- Dominant pain type: {pain_type}
- Pain location: {body_location}
- Self-rated pain score: {data.painScore}/100
- Color choice: {color} (reflects emotional state)

[Drawing Behavior Data]
- Brush distribution: {brush_desc}
- Stroke intensity: {intensity_desc}
- Spatial distribution: {spatial_desc}

[Medical History]
- Diagnosed condition: {diagnosed}
- Drug allergies: {allergies} (DO NOT recommend these in selfCare)

[{cycle_section}]

[Tone Preference] {tone_desc}

Please generate the JSON report:"""

    else:
        cycle_section = f"月经周期：{cycle_label}"
        if cycle_context:
            cycle_section += f"\n临床语境：{cycle_context}"

        user_prompt = f"""以下是患者的痛觉绘图数据，请据此生成四场景转译报告：

【疼痛基本信息】
- 主导痛觉类型：{pain_type}
- 疼痛部位：{body_location}
- 疼痛自评分：{data.painScore}/100
- 色彩选择：{color}（反映情绪状态）

【绘图行为数据】
- 笔触分布：{brush_desc}
- 涂抹强度：{intensity_desc}
- 空间分布：{spatial_desc}

【既往病史】
- 已确诊疾病：{diagnosed}
- 药物过敏：{allergies}（selfCare 中严禁推荐此类药物）

【{cycle_section}】

【语气偏好】{tone_desc}

请生成 JSON 报告："""

    # ── 调用 AI ──
    try:
        print(f"🤖 正在请求通义千问... (目标语言: {lang}, 快速模式: {is_quick})")
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

        # 字段校验
        required_fields = ["analogy", "work", "med", "selfCare"]
        missing_label = "[generation failed, please retry]" if lang == "en" else "[生成失败，请重试]"
        for field in required_fields:
            if field not in llm_reply:
                llm_reply[field] = missing_label

        return {"status": "success", "language": lang, **llm_reply}

    except Exception as e:
        print(f"🚨 后端错误: {e}")
        return _fallback_response(lang)


# ─────────────────────────────────────────────
# 降级内容（双语）
# ─────────────────────────────────────────────

def _fallback_response(lang: str) -> dict:
    if lang == "en":
        return {
            "status": "error",
            "language": "en",
            "analogy": (
                "Imagine someone has twisted your lower abdomen into a tight knot, then pressed a scalding iron against it—"
                "over and over, without letting up. That's not an exaggeration. That is what is actually happening right now."
            ),
            "work": (
                "Due to severe primary dysmenorrhea causing significant physiological impairment, "
                "I am unable to attend or perform work duties today and require rest at home. "
                "I appreciate your understanding and will provide a medical note if needed."
            ),
            "med": (
                "Patient reports spasmodic cramping pain in the lower abdomen, rated severe in intensity, "
                "accompanied by lumbosacral heaviness and dragging sensation. "
                "Symptoms began with onset of the current menstrual cycle and significantly impair daily functioning."
            ),
            "selfCare": (
                "• Apply a heat pad to your lower abdomen for 15–20 minutes to ease muscle spasms\n"
                "• Try the knee-chest (child's pose) position to reduce pelvic pressure\n"
                "• Eat magnesium-rich foods (e.g., nuts, dark chocolate) to help relax muscle contractions\n"
                "• Practice slow diaphragmatic breathing: 4 counts in, hold 4, out 6\n"
                "• Give yourself permission to rest — your pain is real and you deserve care"
            ),
        }
    else:
        return {
            "status": "error",
            "language": "zh",
            "analogy": (
                "像有人把你的腹部拧成麻花，再用烙铁反复烫过——"
                "一阵一阵，没有间歇。这不是夸张，这是此刻真实发生的事。"
            ),
            "work": (
                "因严重原发性痛经引发明显生理功能障碍，本人今日无法正常出勤或完成工作任务，"
                "需居家休息一天，特此说明，如需提供医疗证明可另行安排。感谢理解。"
            ),
            "med": (
                "患者自述下腹部痉挛性绞痛，程度较重，伴腰骶部坠胀感，"
                "症状于本次月经来潮时出现，显著影响日常活动能力，建议评估是否需进一步妇科检查。"
            ),
            "selfCare": (
                "• 热水袋/暖贴敷于下腹部15-20分钟，缓解子宫痉挛\n"
                "• 尝试膝胸卧位（跪趴姿势），减轻盆腔充血压力\n"
                "• 补充富含镁的食物（坚果、黑巧克力），有助于放松肌肉收缩\n"
                "• 练习腹式深呼吸：吸气4拍，屏息4拍，呼气6拍\n"
                "• 允许自己休息，痛经不是矫情，你值得被好好照顾"
            ),
        }


# ─────────────────────────────────────────────
# /api/refine 端点
# ─────────────────────────────────────────────

REFINE_FIELD_CONTEXT = {
    "zh": {
        "analogy": "这是给伴侣看的痛觉通感描述",
        "action": "这是给伴侣列出的实际照护行动清单",
        "work": "这是给领导/HR看的请假申请",
        "workText": "这是给领导/HR看的请假申请",
        "med_complaint": "这是给医生看的临床主诉",
        "med_reference": "这是供与医生讨论的参考清单",
        "selfCare": "这是给患者自己的自愈建议",
        "selfcare": "这是给患者自己的自愈建议",
    },
    "en": {
        "analogy": "This is a synesthetic pain description written for a partner to understand the pain experience.",
        "action": "This is a list of practical care actions for a partner to take.",
        "work": "This is a formal leave request addressed to workplace management or HR.",
        "workText": "This is a formal leave request addressed to workplace management or HR.",
        "med_complaint": "This is a clinical chief complaint written for a doctor.",
        "med_reference": "This is a reference checklist for discussion with a doctor.",
        "selfCare": "These are personal self-care suggestions for pain relief.",
        "selfcare": "These are personal self-care suggestions for pain relief.",
    },
}

REFINE_SYSTEM_PROMPT = {
    "zh": (
        "你是一个专业的医疗内容编辑。根据用户的反馈重写以下文字，保持原意但调整风格/语气。"
        "只输出优化后的文字，不要添加任何解释或前缀。重要：回复必须使用简体中文。"
    ),
    "en": (
        "You are a professional medical content editor. Rewrite the following text based on user feedback, "
        "preserving the original meaning while adjusting style or tone as requested. "
        "Output ONLY the refined text — no explanations, no labels, no preamble. "
        "IMPORTANT: Your response must be in English only."
    ),
}


@app.post("/api/refine")
async def refine_content(data: dict):
    field = data.get("field", "")
    current_text = data.get("currentText", "")
    user_feedback = data.get("userFeedback", "")
    lang = data.get("targetLanguage", "zh")

    if not current_text or not user_feedback:
        return {"refined": current_text}

    system_prompt = REFINE_SYSTEM_PROMPT.get(lang, REFINE_SYSTEM_PROMPT["zh"])
    field_contexts = REFINE_FIELD_CONTEXT.get(lang, REFINE_FIELD_CONTEXT["zh"])
    field_context = field_contexts.get(field, "general content" if lang == "en" else "通用内容")

    if lang == "en":
        user_prompt = (
            f"Context: {field_context}\n\n"
            f"Original text:\n{current_text}\n\n"
            f"User feedback: {user_feedback}\n\n"
            f"Please output only the refined text in English:"
        )
    else:
        user_prompt = (
            f"内容类型：{field_context}\n\n"
            f"原文：\n{current_text}\n\n"
            f"用户反馈：{user_feedback}\n\n"
            f"请直接输出优化后的中文文字："
        )

    try:
        print(f"🤖 正在优化内容... (字段: {field}, 语言: {lang})")
        completion = client.chat.completions.create(
            model="qwen-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        refined = completion.choices[0].message.content.strip()
        return {"refined": refined, "language": lang}

    except Exception as e:
        print(f"🚨 优化错误: {e}")
        return {"refined": current_text, "language": lang}


# ─────────────────────────────────────────────
# 健康检查
# ─────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "PainScape Backend (Powered by Qwen AI) is running!", "version": "2.0-bilingual"}