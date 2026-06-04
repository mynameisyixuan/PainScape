# xx xx症状多久 
# 现病史：为什么起病，起病症状，伴随症状，有没有自己吃药，
# 什么效果，发展情况，有没有一般检查，有没有家族史，
# 家族有没有妇产科病史
# 供您参考：生活习惯整理
# 自愈建议的分类：


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import json
import re
from dotenv import load_dotenv
from openai import OpenAI
from datetime import datetime

# 帖子存储文件路径
POSTS_FILE = "community_posts.json"

def load_posts():
    """从 JSON 文件加载帖子"""
    if not os.path.exists(POSTS_FILE):
        return []
    try:
        with open(POSTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_posts(posts):
    """保存帖子到 JSON 文件"""
    posts = posts[:200]
    with open(POSTS_FILE, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)

load_dotenv()

# ═══════════════════════════════════════════════════════════
# 多 API Provider 配置
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
    raise ValueError(f"🚨 不支持的 LLM_PROVIDER: {LLM_PROVIDER}")

config = PROVIDER_CONFIG[LLM_PROVIDER]
api_key = os.getenv(config["api_key_env"])

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
    accompanyingSymptoms: Optional[List[str]] = None  # 新增：伴随症状


# ─────────────────────────────────────────────
# 双语映射表
# ─────────────────────────────────────────────
PAIN_MAP = {
    "zh": {
        "twist": "绞痛/痉挛性收缩痛",
        "pierce": "针刺/尖锐刺痛",
        "heavy": "重压坠胀痛",
        "wave": "弥漫性胀痛",
        "scrape": "刀刮撕裂痛",
    },
    "en": {
        "twist": "cramping / spasmodic pain",
        "pierce": "stabbing / radiating pain",
        "heavy": "heavy pressure",
        "wave": "diffuse bloating pain",
        "scrape": "tearing pain",
    },
}

BODY_MODE_MAP = {
    "zh": {"front": "盆腔前侧", "back": "腰骶部/后侧", "both": "双侧"},
    "en": {
        "front": "anterior pelvis",
        "back": "lumbosacral region",
        "both": "bilateral",
    },
}

TONE_MAP = {
    "zh": {
        "gentle": "温柔体贴、注重情感支持",
        "professional": "简洁专业",
        "assertive": "直接有力、边界清晰",
    },
    "en": {
        "gentle": "warm and empathetic",
        "professional": "concise and professional",
        "assertive": "direct and firm",
    },
}


# ═══════════════════════════════════════════════════════════
# 辅助函数：构建各模块内容
# ═══════════════════════════════════════════════════════════

def build_pain_location_desc(spatial_map: Optional[Dict], lang: str) -> str:
    """构建疼痛位置描述"""
    if not spatial_map:
        return "未提供疼痛位置信息" if lang == "zh" else "Pain location not provided"
    
    desc_parts = []
    if spatial_map.get("abdomen", 0) > 0:
        desc_parts.append(f"腹部 {spatial_map['abdomen']*100:.0f}%" if lang == "zh" else f"Abdomen {spatial_map['abdomen']*100:.0f}%")
    if spatial_map.get("lowerBack", 0) > 0:
        desc_parts.append(f"腰骶部 {spatial_map['lowerBack']*100:.0f}%" if lang == "zh" else f"Lower back {spatial_map['lowerBack']*100:.0f}%")
    
    return "、".join(desc_parts) if desc_parts else ("弥漫性疼痛" if lang == "zh" else "Diffuse pain")


def build_risk_warning(mb: Dict, lang: str) -> str:
    """构建风险提示（用药警示）"""
    warnings = []
    allergy = mb.get("allergies", "")
    
    if allergy == "ibuprofen":
        warnings.append("⚠️ 布洛芬过敏史，请避免使用NSAIDs类药物，建议使用对乙酰氨基酚。" if lang == "zh" else "⚠️ Ibuprofen allergy. Avoid NSAIDs, consider acetaminophen.")
    elif allergy == "aspirin":
        warnings.append("⚠️ 阿司匹林过敏史，请避免使用该药物。" if lang == "zh" else "⚠️ Aspirin allergy. Avoid this medication.")
    elif allergy in ["penicillin", "sulfonamides"]:
        warnings.append(f"⚠️ {allergy}过敏史，就医时请务必告知医生。" if lang == "zh" else f"⚠️ {allergy} allergy. Please inform your doctor.")
    
    return "\n".join(warnings) if warnings else ("无特殊用药风险提示" if lang == "zh" else "No specific medication risks")


def build_triage_advice(pain_score: int, symptoms: List[str], lang: str) -> str:
    """构建分诊建议"""
    severe_symptoms = ["呕吐", "晕倒", "昏厥", "发黑", "vomiting", "fainting", "blackout"]
    has_severe = any(s in severe_symptoms for s in symptoms) if symptoms else False
    
    if pain_score > 70 or has_severe:
        return "🏥 建议就医：疼痛程度较重或伴有严重伴随症状，建议尽快前往妇科门诊就诊。" if lang == "zh" else "🏥 Seek medical attention: Severe pain or serious symptoms. Please visit a gynecology clinic."
    elif pain_score > 40:
        return "🩺 可居家观察：如疼痛持续加重或出现新症状，建议就医。" if lang == "zh" else "🩺 Monitor at home: Seek medical attention if pain worsens or new symptoms appear."
    else:
        return "🏠 居家护理：目前疼痛程度较轻，可通过休息、热敷等方式缓解。" if lang == "zh" else "🏠 Home care: Mild pain, can be managed with rest and heat therapy."


def build_exam_advice(mb: Dict, lang: str) -> Dict:
    """构建检查建议（带条件判断）"""
    has_sexual_life = mb.get("hasSexualLife") == "true" or mb.get("hasSexualLife") == True
    
    exam = {
        "name": "子宫及双附件彩色超声" if lang == "zh" else "Pelvic Ultrasound (Transabdominal)",
        "preparation": "检查前1小时饮水500-800ml，保持膀胱充盈（憋尿）。" if lang == "zh" else "Drink 500-800ml water 1 hour before exam. Full bladder required.",
        "note": "✅ 超声检查无辐射，安全、便捷，可重复检查。" if lang == "zh" else "✅ Ultrasound is radiation-free, safe, and convenient."
    }
    
    if has_sexual_life:
        exam["alternative"] = "如需更清晰观察内膜及卵巢，可咨询医生是否适合加做经阴道超声。" if lang == "zh" else "For clearer imaging of endometrium and ovaries, consult your doctor about transvaginal ultrasound."
    
    return exam


def build_health_tips_link(pain_type: str, lang: str) -> str:
    """构建科普链接"""
    pain_key_map = {
        "twist": "cramping",
        "pierce": "stabbing",
        "heavy": "dragging",
        "wave": "bloating",
        "scrape": "tearing"
    }
    pain_key = pain_key_map.get(pain_type, pain_type)
    
    if lang == "zh":
        return f"📚 相关科普：痛经的自我管理 → https://example.com/health/dysmenorrhea/{pain_key}"
    else:
        return f"📚 Health Tips: Self-management for dysmenorrhea → https://example.com/en/health/dysmenorrhea/{pain_key}"


def build_cycle_context(cycle_day: str, lang: str) -> str:
    """构建周期上下文"""
    if not cycle_day or cycle_day in ["未提供", "Not provided", ""]:
        return ""
    day_str = cycle_day.lower()
    if lang == "en":
        if "1" in day_str or "2" in day_str:
            return "Acute phase (Day 1-2): peak prostaglandins, focus on acute pain relief."
        elif "3" in day_str or "4" in day_str or "5" in day_str:
            return "Recovery phase (Day 3-5): dull pain, focus on easing discomfort."
        elif "ovulat" in day_str:
            return "Ovulation pain: potential secondary pathology, recommend further evaluation."
    else:
        if any(d in cycle_day for d in ["1", "2"]):
            return "急性期（第1-2天）：前列腺素达峰，需侧重急性镇痛。"
        elif any(d in cycle_day for d in ["3", "4", "5"]):
            return "缓解期（第3-5天）：侧重隐痛与坠胀缓解。"
        elif "排卵" in cycle_day:
            return "排卵期异常痛：需在主诉中提示排查继发性病变。"
    return ""


def map_cycle_day_to_phase(cycle_day: str, lang: str) -> str:
    """将周期天数映射到生理阶段"""
    if not cycle_day or cycle_day in ["未提供", "Not provided", ""]:
        return ""
    
    phase = ""
    if any(d in cycle_day for d in ["1", "2"]):
        phase = "月经期" if lang == "zh" else "menstrual phase"
    elif any(d in cycle_day for d in ["3", "4", "5", "6", "7"]):
        phase = "卵泡期" if lang == "zh" else "follicular phase"
    elif "排卵" in cycle_day:
        phase = "排卵期" if lang == "zh" else "ovulation phase"
    else:
        phase = "黄体期" if lang == "zh" else "luteal phase"
    
    if lang == "zh":
        return f"（根据周期信息，用户处于{phase}，建议参考对应阶段给出作息/运动建议）"
    else:
        return f"(User is in the {phase}. Adjust lifestyle/sports advice accordingly.)"


def build_lifestyle_context(mb: Dict, lang: str) -> str:
    """构建生活习惯/家族史等上下文"""
    if not mb:
        return ""

    contexts = []

    # 年龄
    age_map_zh = {"under18": "18岁以下", "18-25": "18-25岁", "26-35": "26-35岁", "36-45": "36-45岁", "over45": "45岁以上"}
    age_map_en = {"under18": "Under 18", "18-25": "18-25", "26-35": "26-35", "36-45": "36-45", "over45": "Over 45"}
    if mb.get("age"):
        age_label = age_map_en.get(mb["age"], mb["age"]) if lang == "en" else age_map_zh.get(mb["age"], mb["age"])
        contexts.append(f"年龄范围: {age_label}。" if lang == "zh" else f"Age range: {age_label}.")

    # 体力活动量
    if mb.get("activityLevel"):
        if mb["activityLevel"] == "sedentary":
            contexts.append("用户有久坐习惯。" if lang == "zh" else "User has sedentary lifestyle.")
        elif mb["activityLevel"] == "active":
            contexts.append("用户有高强度运动习惯。" if lang == "zh" else "User has high activity level.")

    # 生活习惯
    lifestyle_map_zh = {"regular": "作息规律", "irregular": "作息不规律/常熬夜", "smoking": "有吸烟习惯", "alcohol": "常饮酒", "coldPref": "喜食生冷"}
    lifestyle_map_en = {"regular": "Regular schedule", "irregular": "Irregular schedule", "smoking": "Smoking", "alcohol": "Alcohol consumption", "coldPref": "Prefers cold food"}
    if mb.get("lifestyle"):
        lifestyle_label = lifestyle_map_en.get(mb["lifestyle"], mb["lifestyle"]) if lang == "en" else lifestyle_map_zh.get(mb["lifestyle"], mb["lifestyle"])
        contexts.append(f"生活习惯: {lifestyle_label}。" if lang == "zh" else f"Lifestyle: {lifestyle_label}.")

    # 家族史（只在有明确信息时添加）
    family_map_zh = {"mother": "母亲有严重痛经", "sister": "姐妹有严重痛经", "both": "多位女性亲属有痛经"}
    family_map_en = {"mother": "Mother has severe dysmenorrhea", "sister": "Sister has severe dysmenorrhea", "both": "Multiple family members affected"}
    if mb.get("familyHistory") and mb["familyHistory"] not in ["none", "unknown", ""]:
        family_label = family_map_en.get(mb["familyHistory"], mb["familyHistory"]) if lang == "en" else family_map_zh.get(mb["familyHistory"], mb["familyHistory"])
        contexts.append(f"家族史: {family_label}。" if lang == "zh" else f"Family history: {family_label}.")

    # 既往诊断
    diagnosis_map_zh = {"endometriosis": "子宫内膜异位症", "adenomyosis": "子宫腺肌症", "pcos": "多囊卵巢综合征", "fibroids": "子宫肌瘤"}
    diagnosis_map_en = {"endometriosis": "Endometriosis", "adenomyosis": "Adenomyosis", "pcos": "PCOS", "fibroids": "Uterine Fibroids"}
    if mb.get("diagnosed") and mb["diagnosed"] not in ["none", "unchecked", ""]:
        diag_label = diagnosis_map_en.get(mb["diagnosed"], mb["diagnosed"]) if lang == "en" else diagnosis_map_zh.get(mb["diagnosed"], mb["diagnosed"])
        contexts.append(f"既往诊断: {diag_label}。" if lang == "zh" else f"Past diagnosis: {diag_label}.")

    # 过敏史
    allergy_map_zh = {"ibuprofen": "布洛芬", "aspirin": "阿司匹林", "penicillin": "青霉素", "sulfonamides": "磺胺类"}
    allergy_map_en = {"ibuprofen": "Ibuprofen", "aspirin": "Aspirin", "penicillin": "Penicillin", "sulfonamides": "Sulfonamides"}
    if mb.get("allergies") and mb["allergies"] not in ["none", "unknown", ""]:
        allergy_label = allergy_map_en.get(mb["allergies"], mb["allergies"]) if lang == "en" else allergy_map_zh.get(mb["allergies"], mb["allergies"])
        contexts.append(f"药物过敏: {allergy_label}。" if lang == "zh" else f"Drug allergy: {allergy_label}.")

    if contexts:
        header = "\n【生活习惯与风险因素】\n" if lang == "zh" else "\n[Lifestyle & Risk Factors]\n"
        return header + "\n".join(f"- {c}" for c in contexts)
    return ""


# ═══════════════════════════════════════════════════════════
# 核心生成端点
# ═══════════════════════════════════════════════════════════
@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    lang = data.targetLanguage or "zh"
    is_quick = data.isQuickLog or False
    mb = data.medicalBackground or {}

    pt_dict = PAIN_MAP.get(lang, PAIN_MAP["zh"])
    bm_dict = BODY_MODE_MAP.get(lang, BODY_MODE_MAP["zh"])
    tone = TONE_MAP.get(lang, TONE_MAP["zh"]).get(data.tonePreference or "gentle")
    cycle_ctx = build_cycle_context(data.cycleDay, lang)
    lifestyle_ctx = build_lifestyle_context(mb, lang)
    phase_ctx = map_cycle_day_to_phase(data.cycleDay, lang)
    
    allergy = mb.get("allergies", "")
    diag = mb.get("diagnosed", "")

    # 根据过敏史确定安全的止痛药名称
    safe_painkiller = "对乙酰氨基酚" if lang == "zh" else "Acetaminophen"
    default_painkiller = "布洛芬" if lang == "zh" else "Ibuprofen"
    allergy_list = ["ibuprofen", "aspirin", "nsaids"]
    painkiller = safe_painkiller if (allergy in allergy_list) else default_painkiller

    # 构建各模块内容（非LLM部分）
    pain_location_desc = build_pain_location_desc(data.spatialMap, lang)
    accompanying_symptoms = data.accompanyingSymptoms or []
    accompanying_desc = "、".join(accompanying_symptoms) if accompanying_symptoms else ("无特殊伴随症状" if lang == "zh" else "No specific accompanying symptoms")
    risk_warning = build_risk_warning(mb, lang)
    triage_advice = build_triage_advice(data.painScore, accompanying_symptoms, lang)
    exam_advice = build_exam_advice(mb, lang)
    health_tips_link = build_health_tips_link(data.dominantPain, lang)

    # 模块化JSON模板
    JSON_TEMPLATE = """
    {
      "chief_complaint": "主诉：症状 + 持续时间，如'间断下腹痛2天余'",
      "present_illness": "现病史：起病情况、主要症状、伴随症状、诊疗经过、转归",
      "past_history": "既往史：仅填写用户真实提供的信息（诊断、手术史等）",
      "menstrual_history": "月经史：初潮年龄、周期规律、经期天数、末次月经等",
      "clinical_diagnosis": "临床诊断：根据症状和体征给出的初步判断",
      "clinical_suggestions": "临床建议：包括用药建议、生活方式建议",
      "analogy": "痛觉通感描述（用于伴侣Tab）",
      "work": "请假条（用于职场Tab）",
      "action": ["伴侣实操建议1", "伴侣实操建议2", "伴侣实操建议3"],
      "selfCare": ["自愈建议1", "自愈建议2", "自愈建议3", "自愈建议4"]
    }
    """

    if lang == "en":
        sys_prompt = f"""
You are a medical assistant for dysmenorrhea. Generate a structured report based ONLY on the provided data.

【CRITICAL RULES - MUST FOLLOW】
1. NEVER fabricate ANY information not provided by the user.
2. If age is not provided → do NOT write "patient is X years old".
3. If family history is "none" or not provided → do NOT write "mother/sister has dysmenorrhea".
4. If a field is empty or "not provided" → SKIP it entirely.
5. Output MUST be valid JSON.

【Period Phase Reference】
- Menstrual phase (Day 1-7): Rest, warmth, avoid strenuous exercise.
- Follicular phase (Day 8-14): High energy, suitable for intense work and exercise.
- Ovulation phase (Day 15-21): High social energy, later energy declines.
- Luteal phase (Day 22-28): PMS common, emotional fluctuations.

【Required JSON Structure】
{JSON_TEMPLATE}
"""
    else:
        sys_prompt = f"""
你是一个痛经辅助诊断助手。请根据【仅限】用户提供的信息，生成结构化报告。

【强制规则 - 必须遵守】
1. 严禁编造任何用户未提供的信息！
2. 年龄未提供 → 禁止写"患者X岁"，可写"成年女性"或不写。
3. 家族史为"无"或未提供 → 禁止写"母亲/姐妹有痛经史"！
4. 字段为空或"未提供" → 完全跳过，不要提及。
5. 输出必须是严格的JSON格式。

【月经周期阶段参考指南】
- 月经期 (Day 1-7): 重点休息、保暖、避免剧烈运动。推荐：热敷、瑜伽、补铁食物。
- 卵泡期 (Day 8-14): 能量回升，适合高效工作和脑力劳动。推荐：高强度运动、补充蛋白质。
- 排卵期 (Day 15-21): 社交高能量期，后期能量下降。推荐：初期HIIT，后期改慢跑。
- 黄体期 (Day 22-28): PMS高发，情绪波动大。推荐：整理类工作、控制碳水欲望、散步/拉伸。

【硬性要求】
- 'action': 提供3-4条具体的伴侣实操动作，必须与痛感类型强关联。如患者有药物过敏，绝对不要推荐该药物。
- 'selfCare': 提供4-5条建议，必须包含至少一个特定的疼痛缓解姿势（如'侧卧蜷缩，膝盖间夹枕头'），【重要】必须简单可行，用户在痛经时能够做到，愿意做到，必须包含一句消除病耻感的心理安慰。
- 'analogy': 极具画面感的通感比喻，必须与痛感质地高度吻合。
- 'work': 接地气的请假条（40字以内）。

【必须严格按照以下JSON格式输出】
{JSON_TEMPLATE}
"""

    user_prompt = f"""
【用户真实数据 - 只能使用以下信息，严禁编造！】

- 主导痛感：{pt_dict.get(data.dominantPain, data.dominantPain)}
- 疼痛强度：{data.painScore}/100
- 疼痛部位：{bm_dict.get(data.bodyMode, data.bodyMode)}
{phase_ctx}
{cycle_ctx}
{lifestyle_ctx}

【医疗信息】（仅使用已提供的，未提供则跳过）
- 既往诊断：{diag if diag else "未提供"}
- 药物过敏：{allergy if allergy else "未提供"}

【语气偏好】：{tone}

请直接输出符合模板的精准定制化 JSON：
"""

    model_name = config["model_quick"] if is_quick else config["model"]

    try:
        print(f"🤖 正在请求 {config['display_name']}... 痛感质地: {pt_dict.get(data.dominantPain)}")
        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.75,
            response_format={"type": "json_object"},
        )

        raw_text = completion.choices[0].message.content

        # 清洗与截取
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE | re.IGNORECASE)
        cleaned_text = re.sub(r"```\s*$", "", cleaned_text, flags=re.MULTILINE).strip()

        start = cleaned_text.find("{")
        end = cleaned_text.rfind("}")
        if start != -1 and end != -1:
            cleaned_text = cleaned_text[start:end + 1]

        parsed_json = json.loads(cleaned_text, strict=False)

        print("✅ JSON 解析成功!")
        
        # 合并返回结果
        return {
            "status": "success",
            "language": lang,
            # LLM生成的模块
            "chief_complaint": parsed_json.get("chief_complaint", ""),
            "present_illness": parsed_json.get("present_illness", ""),
            "past_history": parsed_json.get("past_history", ""),
            "menstrual_history": parsed_json.get("menstrual_history", ""),
            "clinical_diagnosis": parsed_json.get("clinical_diagnosis", ""),
            "clinical_suggestions": parsed_json.get("clinical_suggestions", ""),
            "analogy": parsed_json.get("analogy", ""),
            "work": parsed_json.get("work", ""),
            "action": parsed_json.get("action", []),
            "selfCare": parsed_json.get("selfCare", []),
            # 规则生成的模块
            "pain_location": pain_location_desc,
            "accompanying_symptoms": accompanying_desc,
            "risk_warning": risk_warning,
            "triage_advice": triage_advice,
            "exam_advice": exam_advice,
            "health_tips_link": health_tips_link
        }

    except Exception as e:
        print(f"❌ 生成失败，触发保底。错误原因: {str(e)}")
        fallback = _fallback_response(lang, painkiller)
        # 保底响应也包含新增模块
        fallback.update({
            "pain_location": pain_location_desc,
            "accompanying_symptoms": accompanying_desc,
            "risk_warning": risk_warning,
            "triage_advice": triage_advice,
            "exam_advice": exam_advice,
            "health_tips_link": health_tips_link
        })
        return fallback


# ─────────────────────────────────────────────
# 降级响应
# ─────────────────────────────────────────────
def _fallback_response(lang: str, painkiller: str = "布洛芬") -> dict:
    if lang == "en":
        return {
            "status": "success",
            "language": "en",
            "chief_complaint": "Chief complaint: Severe lower abdominal cramping for 2 days",
            "present_illness": "Patient reports intense spasmodic pain in lower abdomen, aggravated during menstruation.",
            "past_history": "No significant past medical history reported.",
            "menstrual_history": "Menstrual history not provided.",
            "clinical_diagnosis": "Primary dysmenorrhea (suspected)",
            "clinical_suggestions": "Rest, heat therapy, and consider NSAIDs if no contraindications.",
            "analogy": "Imagine your lower abdomen being twisted into a tight, relentless knot.",
            "work": "Hi Manager, I have a sudden severe medical issue today and can't get out of bed. I need to take a sick leave.",
            "action": [
                f"☑️ Prepare a heat pad for her lower back or abdomen.",
                f"☑️ Bring warm water and her safe painkiller (avoid allergens).",
                f"☑️ Take over household chores for the day.",
            ],
            "selfCare": [
                "✨ It's valid to rest today. You don't need to be productive.",
                "✨ Try fetal position with a pillow between your knees.",
                "✨ Practice slow, deep breathing to calm your nervous system.",
            ]
        }
    else:
        return {
            "status": "success",
            "language": "zh",
            "chief_complaint": "主诉：下腹部剧烈绞痛2天",
            "present_illness": "患者自述下腹部呈持续性剧烈痉挛绞痛，阵发性加剧，伴有腰骶部沉重坠胀感。",
            "past_history": "无特殊既往病史。",
            "menstrual_history": "月经史未提供。",
            "clinical_diagnosis": "原发性痛经（疑似）",
            "clinical_suggestions": "建议休息、热敷，如无禁忌可考虑使用止痛药。",
            "analogy": "像有人把你的盆腔深处拧成一股麻花，再用烙铁反复烫过。",
            "work": "老板你好，我今天突发身体急症，目前疼得实在起不来，申请请假一天居家休息。",
            "action": [
                f"☑️ 准备一个温度适宜的热水袋，帮她固定在下腹部或后腰。",
                f"☑️ 帮她倒一杯温水放在床头，备好{painkiller}（确保无过敏）。",
                f"☑️ 主动承担今天的全部家务。",
            ],
            "selfCare": [
                "✨ 今天不生产任何价值也是完全合法的。允许自己躺平，不要为请假感到愧疚。",
                "✨ 尝试侧卧婴儿蜷缩式，膝盖间夹枕头，能最快减轻盆腔充血。",
                "✨ 疼痛会让身体误以为处于危险中。试着拉长呼气的时间，告诉大脑'我们现在很安全'。",
            ]
        }


# ─────────────────────────────────────────────
# /api/refine (优化引擎)
# ─────────────────────────────────────────────
@app.post("/api/refine")
async def refine_content(data: dict):
    field = data.get("field", "")
    current_text = data.get("currentText", "")
    user_feedback = data.get("userFeedback", "")
    lang = data.get("targetLanguage", "zh")

    if not current_text or not user_feedback:
        return {"refined": current_text}

    if lang == "en":
        sys_prompt = "You are an expert copy editor. Rewrite the text based on user feedback. Output ONLY the refined text. No explanations."
        user_prompt = f"Original:\n{current_text}\n\nFeedback: {user_feedback}\n\nRewrite directly:"
    else:
        sys_prompt = "你是文案润色助手。根据修改意见对原文本优化。只需输出修改后的最终文本，【绝对不要】输出解释或 Markdown 标记！"
        user_prompt = f"原文：\n{current_text}\n\n修改意见：\n{user_feedback}\n\n直接输出修改结果："

    try:
        completion = client.chat.completions.create(
            model=config["model_refine"],
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        refined = completion.choices[0].message.content.strip()
        refined = re.sub(r"^```[\s\S]*?\n", "", refined)
        refined = re.sub(r"```$", "", refined).strip()
        return {"refined": refined, "language": lang}
    except Exception as e:
        print(f"🚨 优化错误: {e}")
        return {"refined": current_text, "language": lang}


# ─────────────────────────────────────────────
# 帖子相关 API
# ─────────────────────────────────────────────
@app.get("/api/posts")
async def get_posts():
    """获取所有帖子"""
    return {"posts": load_posts()}


@app.post("/api/posts")
async def create_post(data: dict):
    """发布新帖"""
    posts = load_posts()
    new_post = {
        "id": str(datetime.now().timestamp()),
        "text": data.get("text", ""),
        "img": data.get("img", ""),
        "painTags": data.get("painTags", []),
        "group": data.get("group", "family"),
        "analogy": data.get("analogy", ""),
        "lang": data.get("lang", "zh"),
        "likes": 0,
        "hugs": 0,
        "createdAt": datetime.now().isoformat(),
    }
    posts.insert(0, new_post)
    save_posts(posts)
    return {"status": "success", "post": new_post}


@app.get("/")
def read_root():
    return {
        "message": "PainScape Backend running (Feminist HCI Version)",
        "model": config["display_name"],
    }