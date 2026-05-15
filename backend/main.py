from zhipuai import ZhipuAI
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
import os
import json
import re
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# ═══════════════════════════════════════════════════════════
# 多 API Provider 配置（通过 .env 中的 LLM_PROVIDER 切换）
# ═══════════════════════════════════════════════════════════
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "dashscope").lower()

PROVIDER_CONFIG = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "model": "gpt-4o",
        "model_quick": "gpt-4o-mini",
        "model_refine": "gpt-4o-mini",
        "max_tokens": 4096,
        "display_name": "OpenAI GPT-4o",
    },
    "zhipu": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "api_key_env": "ZHIPU_API_KEY",
        "model": "glm-4-plus",
        "model_quick": "glm-4-flash",
        "model_refine": "glm-4-flash",
        "max_tokens": 4096,
        "display_name": "智谱 GLM-4-Plus",
    },
    "dashscope": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key_env": "DASHSCOPE_API_KEY",
        "model": "qwen-plus",
        "model_quick": "qwen-turbo",
        "model_refine": "qwen-turbo",
        "max_tokens": 4096,
        "display_name": "通义千问 Qwen-Plus",
    },
}

if LLM_PROVIDER not in PROVIDER_CONFIG:
    raise ValueError(
        f"🚨 不支持的 LLM_PROVIDER: {LLM_PROVIDER}，"
        f"可选值: {list(PROVIDER_CONFIG.keys())}"
    )

config = PROVIDER_CONFIG[LLM_PROVIDER]
api_key = os.getenv(config["api_key_env"])

if not api_key:
    raise ValueError(
        f"🚨 未找到 {config['api_key_env']}，请检查 .env 文件！\n"
        f"当前 Provider: {LLM_PROVIDER}"
    )

client = OpenAI(
    api_key=api_key,
    base_url=config["base_url"],
)

print(f"✅ LLM Provider: {config['display_name']} ({config['model']})")

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

# 中文确诊名 → 英文确诊名 反向映射
DIAGNOSED_ZH_TO_EN = {
    v: DIAGNOSED_MAP["en"][k]
    for k, v in DIAGNOSED_MAP["zh"].items()
    if k in DIAGNOSED_MAP["en"]
}

ALLERGY_FALLBACK = {
    "zh": "无已知过敏记录",
    "en": "No known drug allergies",
}

ALLERGY_NONE_KEYS = ["unknown", "none", "", None]

# 常见过敏药中文 → 英文映射
ALLERGY_ZH_TO_EN = {
    "无已知过敏记录": "No known drug allergies",
    "青霉素": "Penicillin",
    "磺胺类": "Sulfonamides",
    "阿司匹林": "Aspirin",
    "布洛芬": "Ibuprofen",
    "对乙酰氨基酚": "Acetaminophen",
    "头孢类": "Cephalosporins",
    "止痛药": "Painkillers (general)",
    "NSAIDs": "NSAIDs",
}

# 色彩双语映射
COLOR_MAP = {
    "深红": "Crimson",
    "暗紫": "Dark Purple",
    "火红": "Flame Red",
    "暗蓝": "Dark Blue",
    "灰黑": "Charcoal",
    "橙黄": "Amber",
    "苍白": "Pale White",
    "暗红": "Dark Red",
    "紫红": "Magenta",
    "crimson": "Crimson",
    "darkPurple": "Dark Purple",
    "flameRed": "Flame Red",
    "darkBlue": "Dark Blue",
    "charcoal": "Charcoal",
    "amber": "Amber",
}

# 空间区域名称双语映射
SPATIAL_REGION_MAP_EN = {
    "下腹部": "lower abdomen",
    "上腹部": "upper abdomen",
    "腰骶部": "lumbosacral region",
    "后腰": "lower back",
    "左侧": "left side",
    "右侧": "right side",
    "盆腔": "pelvic cavity",
    "腹股沟": "groin",
    "大腿内侧": "inner thigh",
    "肚脐周围": "periumbilical area",
    "全腹": "entire abdomen",
    "lower abdomen": "lower abdomen",
    "upper abdomen": "upper abdomen",
    "lumbosacral": "lumbosacral region",
    "lower back": "lower back",
    "left side": "left side",
    "right side": "right side",
    "pelvis": "pelvic cavity",
    "groin": "groin",
    "inner thigh": "inner thigh",
}

# 周期天数中文 → 英文映射
CYCLE_DAY_MAP_EN = {
    "第1天": "Day 1",
    "第2天": "Day 2",
    "第3天": "Day 3",
    "第4天": "Day 4",
    "第5天": "Day 5",
    "第6天": "Day 6",
    "第7天": "Day 7",
    "排卵期": "Ovulation day",
    "排卵痛": "Ovulation pain",
    "未提供": "Not provided",
}

# ─────────────────────────────────────────────
# 辅助函数
# ─────────────────────────────────────────────

def build_brush_desc(brush_counts: Dict[str, int], lang: str) -> str:
    label_map = BRUSH_LABEL_MAP.get(lang, BRUSH_LABEL_MAP["zh"])
    parts = [
        f"{label_map[k]}({v})"
        for k, v in brush_counts.items()
        if v > 0 and k in label_map
    ]
    if not parts:
        return "single stroke type" if lang == "en" else "单一笔触"
    sep = ", " if lang == "en" else "、"
    return sep.join(parts)


def build_spatial_desc(spatial: Dict[str, float], lang: str) -> str:
    if not spatial:
        return "evenly distributed" if lang == "en" else "分布均匀"
    top_regions = sorted(spatial.items(), key=lambda x: x[1], reverse=True)[:3]
    if lang == "en":
        translated = []
        for r in top_regions:
            en_name = SPATIAL_REGION_MAP_EN.get(r[0])
            if en_name is None:
                if any(ord(c) > 127 for c in r[0]):
                    en_name = "unspecified region"
                else:
                    en_name = r[0]
            translated.append(en_name)
        return "concentrated at: " + ", ".join(translated)
    else:
        return "集中于" + "、".join(r[0] for r in top_regions)


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
    if not cycle_day or cycle_day in ["未提供", "Not provided", ""]:
        return ""
    day_str = cycle_day.lower()
    if lang == "en":
        if "day 1" in day_str or "day 2" in day_str or "第1天" in cycle_day or "第2天" in cycle_day:
            return (
                "Patient is in the acute phase (Day 1-2): prostaglandin secretion peaks, pain is most severe. "
                "selfCare must focus on acute pain management. "
                "analogy should reflect the sudden and intense onset of pain."
            )
        elif any(d in cycle_day for d in ["第3", "第4", "第5"]) or any(d in day_str for d in ["day 3", "day 4", "day 5"]):
            return (
                "Patient is in the recovery phase (Day 3-5): acute pain subsiding but fatigue and heaviness remain. "
                "selfCare must focus on recovery and nutrition. "
                "Note any persistent dull pain that may warrant follow-up."
            )
        elif "排卵" in cycle_day or "ovulat" in day_str:
            return (
                "Patient is experiencing mid-cycle / ovulation pain: this may indicate endometriosis or pelvic adhesions. "
                "med must flag potential association and recommend evaluation."
            )
    else:
        if cycle_day in ["第1天", "第2天"]:
            return (
                "患者处于月经第1-2天（急性期），前列腺素分泌达峰，疼痛最为剧烈。"
                "selfCare 必须侧重急性疼痛管理，analogy 需体现痛感的急性发作与猛烈程度。"
            )
        elif any(d in cycle_day for d in ["第3", "第4", "第5"]):
            return (
                "患者处于月经第3-5天（缓解期），急性疼痛开始消退但伴随疲劳与坠胀。"
                "selfCare 必须侧重修复与营养补充，建议关注是否需要复查的持续隐痛。"
            )
        elif "排卵" in cycle_day:
            return (
                "患者处于排卵期疼痛（非经期痛），这属于异常疼痛。"
                "med 必须提示其与子宫内膜异位症或盆腔粘连的潜在关联，建议排查。"
            )
    return ""


def resolve_diagnosed(raw: Optional[str], lang: str) -> str:
    key = raw or ""
    d_map = DIAGNOSED_MAP.get(lang, DIAGNOSED_MAP["zh"])
    if key in d_map:
        return d_map[key]
    if lang == "en" and key in DIAGNOSED_ZH_TO_EN:
        return DIAGNOSED_ZH_TO_EN[key]
    if lang == "en":
        return raw if raw and all(ord(c) < 128 for c in raw) else "No previous diagnosis on record"
    return raw if raw else d_map.get("none", "")


def resolve_allergies(raw: Optional[str], lang: str) -> str:
    if raw in ALLERGY_NONE_KEYS:
        return ALLERGY_FALLBACK.get(lang, ALLERGY_FALLBACK["zh"])
    result = raw or ALLERGY_FALLBACK.get(lang, ALLERGY_FALLBACK["zh"])
    if lang == "en" and result in ALLERGY_ZH_TO_EN:
        return ALLERGY_ZH_TO_EN[result]
    if lang == "en" and any(ord(c) > 127 for c in result):
        return "specific drug allergies (see patient records)"
    return result


def resolve_color(color: Optional[str], lang: str) -> str:
    if not color:
        return "Crimson" if lang == "en" else "深红"
    if lang == "en":
        mapped = COLOR_MAP.get(color, COLOR_MAP.get(color.lower(), None))
        if mapped:
            return mapped
        if any(ord(c) > 127 for c in color):
            return "Crimson"
        return color
    return color


def resolve_cycle_label(cycle_day: str, lang: str) -> str:
    if not cycle_day or cycle_day in ["未提供", ""]:
        return "Not provided" if lang == "en" else "未提供"
    if lang == "en":
        if cycle_day in CYCLE_DAY_MAP_EN:
            return CYCLE_DAY_MAP_EN[cycle_day]
        m = re.search(r"第(\d+)天", cycle_day)
        if m:
            return f"Day {m.group(1)}"
        if "排卵" in cycle_day:
            return "Ovulation"
        if any(ord(c) > 127 for c in cycle_day):
            return "Day not specified"
        return cycle_day
    return cycle_day


# ─────────────────────────────────────────────
# /api/generate 端点
# ─────────────────────────────────────────────
@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    lang = data.targetLanguage or "zh"
    is_quick = data.isQuickLog or False

    mb = data.medicalBackground or {}
    intensity = data.intensityProfile or {}
    spatial = data.spatialMap or {}
    brush_counts = data.brushCounts or {}
    avg_speed = intensity.get("avgSpeed", 0)

    # 全量本地预翻译
    pain_type_dict = PAIN_MAP.get(lang, PAIN_MAP["zh"])
    body_mode_dict = BODY_MODE_MAP.get(lang, BODY_MODE_MAP["zh"])

    processed_input = {
        "pain_type": pain_type_dict.get(data.dominantPain, "complex pain" if lang == "en" else "复合性痛经"),
        "location": body_mode_dict.get(data.bodyMode or "front", "pelvic region" if lang == "en" else "盆腔区域"),
        "diagnosis": resolve_diagnosed(mb.get("diagnosed"), lang),
        "allergies": resolve_allergies(mb.get("allergies"), lang),
        "cycle": resolve_cycle_label(data.cycleDay, lang),
        "cycle_context": build_cycle_context(data.cycleDay, lang),
        "tone": TONE_MAP.get(lang, TONE_MAP["zh"]).get(data.tonePreference or "gentle"),
        "brush_desc": build_brush_desc(brush_counts, lang),
        "spatial_desc": build_spatial_desc(spatial, lang),
        "intensity_desc": build_intensity_desc(avg_speed, lang),
        "color": resolve_color(data.colorPalette, lang),
    }

    # 构建 System Prompt（强化约束）
    if lang == "en":
        system_prompt = (
            "You are a senior Menstrual Health & Pain Management Consultant.\n"
            "Your task is to translate somatic pain data into four highly specific support artifacts.\n\n"
            "CRITICAL RULES:\n"
            "1. LANGUAGE: Output MUST be 100% in English. No Chinese characters allowed.\n"
            "2. JSON SCHEMA: Return a valid JSON with keys: \"analogy\", \"work\", \"med\", \"selfCare\".\n"
            "3. DEPTH & LENGTH:\n"
            "   - \"analogy\": (150-200 words) For partners. Use visceral, synesthetic metaphors "
            "(e.g., \"unripe fruit being peeled\", \"electric barbs\"). Focus on the 'texture' of pain "
            "to bridge the empathy gap.\n"
            "   - \"work\": (100-130 words) Professional absence notice. Follow Western workplace norms: "
            "emphasize \"temporary physiological incapacity\" and \"medical necessity\" over descriptive suffering.\n"
            "   - \"med\": (80-120 words) Medical chief complaint. Start with \"Patient reports...\". "
            "Map metaphors to clinical terms (e.g., 'heavy' to 'pelvic congestion').\n"
            "   - \"selfCare\": (150-200 words) Provide EXACTLY 5 detailed, evidence-based steps. "
            "Each step must be on a new line. "
            "MUST cover these 5 dimensions: posture, heat therapy, nutrition, breathing, and psychological support. "
            "Avoid any allergens listed.\n"
            "4. selfCare must NEVER recommend medications the patient is allergic to.\n"
            "5. When recommending examinations, use precise terms: pelvic ultrasound, transvaginal ultrasound, "
            "hormone panel, laparoscopy — with a brief plain-language explanation for each.\n"
            "6. FORMAT: Use \\n for line breaks in selfCare and analogy fields.\n"
            "7. IMPORTANT: If you cannot generate 5 distinct selfCare steps, return an error message instead.\n"
        )
        if is_quick:
            system_prompt += (
                "\nSPECIAL MODE: User is in severe pain quick-log mode. "
                "Prioritize essential, immediately actionable relief. "
                "Be calm, reassuring, direct. Minimize lengthy analogies.\n"
            )
    else:
        system_prompt = (
            "你是一位资深的女性健康转译专家。你需要将具身痛觉数据转化为四种社会语境下的表达。\n\n"
            "硬性规则：\n"
            "1. 格式：必须返回严格的 JSON，包含 \"analogy\", \"work\", \"med\", \"selfCare\" 字段。\n"
            "2. 深度要求：\n"
            "   - \"analogy\": (180-250字) 面向伴侣。用震撼的通感比喻描述痛觉质地，引起生理共鸣。\n"
            "   - \"work\": (100-150字) 职场请假条。语气专业、中性，强调\"生理机能暂时受损\"，符合职业规范。\n"
            "   - \"med\": (80-120字) 医疗主诉。以\"患者自述\"开头，使用专业术语，描述放射区域及排查建议。\n"
            "   - \"selfCare\": (180-250字) 提供 **恰好5条** 深度的自愈建议，每条单独一行。必须涵盖姿势、热敷、营养、呼吸、心理5个维度，避免建议过敏药物。\n"
            "3. selfCare 中严禁推荐患者过敏的药物。\n"
            "4. 如需建议检查，使用精确术语：盆腔超声、经阴道超声、激素六项、腹腔镜，并附简要解释。\n"
            "5. 所有输出文字必须使用简体中文。\n"
            "6. 格式：selfCare 和 analogy 字段使用换行符 \\n 分行。\n"
            "7. 重要：如果无法生成5条不同的建议，返回错误信息。\n"
        )
        if is_quick:
            system_prompt += (
                "\n特别注意：用户处于剧烈疼痛快速记录模式，"
                "请直接给出最核心的缓解建议，语气更安抚直接，减少长篇大论的比喻。\n"
            )

    # 构建 User Prompt
    if lang == "en":
        cycle_section = f"Cycle: {processed_input['cycle']}"
        if processed_input['cycle_context']:
            cycle_section += f"\nClinical context: {processed_input['cycle_context']}"
        user_prompt = f"""Based on the following patient pain mapping data, generate a four-scenario translation report:

[Somatic Data]
- Type: {processed_input['pain_type']}
- Intensity: {data.painScore}/100 ({processed_input['intensity_desc']})
- Mapping: {processed_input['brush_desc']} at {processed_input['location']} ({processed_input['spatial_desc']})
- Color: {processed_input['color']} (emotional indicator)

[Medical Context]
- Diagnosis: {processed_input['diagnosis']}
- {cycle_section}
- Drug Allergies: {processed_input['allergies']} (DO NOT recommend these in selfCare)

[Tone Preference]
{processed_input['tone']}

Generate the structured JSON report now:"""
    else:
        cycle_section = f"周期：{processed_input['cycle']}"
        if processed_input['cycle_context']:
            cycle_section += f"\n临床语境：{processed_input['cycle_context']}"
        user_prompt = f"""以下是患者的痛觉绘图数据，请据此生成四场景转译报告：

【痛觉数据】
- 类型：{processed_input['pain_type']}
- 强度：{data.painScore}/100 ({processed_input['intensity_desc']})
- 绘图特征：{processed_input['brush_desc']}，位置：{processed_input['location']} ({processed_input['spatial_desc']})
- 色彩选择：{processed_input['color']}（反映情绪状态）

【医疗背景】
- 已确诊疾病：{processed_input['diagnosis']}
- {cycle_section}
- 药物过敏：{processed_input['allergies']}（selfCare 中严禁推荐此类药物）

【语气偏好】
{processed_input['tone']}

请生成 JSON 报告："""

    # ── 调用 AI（根据 provider 自动选择模型）──
    model_name = config["model_quick"] if is_quick else config["model"]

    try:
        print(f"🤖 正在请求 {config['display_name']}... (模型: {model_name}, 语言: {lang}, 快速: {is_quick})")

        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
            max_tokens=config["max_tokens"],
        )
        raw_content = completion.choices[0].message.content
        llm_reply = json.loads(raw_content)

        # 字段校验和格式化
        required_fields = ["analogy", "work", "med", "selfCare"]
        missing_label = "[generation failed, please retry]" if lang == "en" else "[生成失败，请重试]"
        
        for field in required_fields:
            if field not in llm_reply:
                llm_reply[field] = missing_label
            else:
                # 确保换行符被正确处理
                if lang == "en":
                    llm_reply[field] = llm_reply[field].replace("\\n", "\n").replace("\n\n", "\n")
                else:
                    llm_reply[field] = llm_reply[field].replace("\\n", "\n").replace("\n\n", "\n")

        # 额外检查：确保 selfCare 有5条建议
        if "selfCare" in llm_reply and lang == "en":
            lines = llm_reply["selfCare"].split("\n")
            if len(lines) < 5:
                llm_reply["selfCare"] = (
                    "• Apply a heat pad to your lower abdomen for 15–20 minutes to ease muscle spasms\n"
                    "• Try the knee-chest (child's pose) position to reduce pelvic pressure\n"
                    "• Eat magnesium-rich foods (e.g., nuts, dark chocolate) to help relax muscle contractions\n"
                    "• Practice slow diaphragmatic breathing: 4 counts in, hold 4, out 6\n"
                    "• Give yourself permission to rest — your pain is real and you deserve care"
                )

        return {"status": "success", "language": lang, "provider": LLM_PROVIDER, **llm_reply}

    except Exception as e:
        print(f"🚨 后端错误 ({config['display_name']}): {e}")
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
                "Imagine someone has twisted your lower abdomen into a tight knot, "
                "then pressed a scalding iron against it—over and over, without letting up. "
                "That's not an exaggeration. That is what is actually happening right now."
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
        "确保每条建议单独一行，使用换行符 \\n 分隔。"
    ),
    "en": (
        "You are a professional medical content editor. Rewrite the following text based on user feedback, "
        "preserving the original meaning while adjusting style or tone as requested. "
        "Output ONLY the refined text — no explanations, no labels, no preamble. "
        "IMPORTANT: Your response must be in English only. "
        "Ensure each suggestion is on a new line using \\n."
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
            f"Please output only the refined text in English with proper line breaks:"
        )
    else:
        user_prompt = (
            f"内容类型：{field_context}\n\n"
            f"原文：\n{current_text}\n\n"
            f"用户反馈：{user_feedback}\n\n"
            f"请直接输出优化后的中文文字，每条建议单独一行："
        )

    try:
        print(f"🤖 正在优化内容... (字段: {field}, 语言: {lang}, 模型: {config['model_refine']})")
        completion = client.chat.completions.create(
            model=config["model_refine"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        refined = completion.choices[0].message.content.strip()
        # 确保换行符正确
        if lang == "en":
            refined = refined.replace("\\n", "\n").replace("\n\n", "\n")
        else:
            refined = refined.replace("\\n", "\n").replace("\n\n", "\n")
        return {"refined": refined, "language": lang}
    except Exception as e:
        print(f"🚨 优化错误: {e}")
        return {"refined": current_text, "language": lang}


# ─────────────────────────────────────────────
# 健康检查（含 Provider 信息）
# ─────────────────────────────────────────────
@app.get("/")
def read_root():
    return {
        "message": "PainScape Backend is running!",
        "version": "3.0-multi-provider",
        "provider": LLM_PROVIDER,
        "model": config["display_name"],
    }
