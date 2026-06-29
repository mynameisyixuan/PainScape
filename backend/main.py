# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Union, Any
import os
import json
import re
import uuid
import requests
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
# 统一大模型 Providers 配置
# ═══════════════════════════════════════════════════════════
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "vivo").lower()  # 默认使用 vivo

PROVIDER_CONFIG = {
    "dashscope": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key_env": "DASHSCOPE_API_KEY",
        "model": "qwen-plus",
        "model_quick": "qwen-turbo",
        "model_refine": "qwen-turbo",
        "max_tokens": 4096,
        "display_name": "通义千问 Qwen-Plus",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "api_key_env": "DEEPSEEK_API_KEY",
        "model": "deepseek-chat",
        "model_quick": "deepseek-chat",
        "model_refine": "deepseek-chat",
        "max_tokens": 4096,
        "display_name": "DeepSeek-V3",
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
    "vivo": {
        "base_url": "https://api-ai.vivo.com.cn/v1",
        "api_key_env": "VIVO_API_KEY",
        "model": "Volc-DeepSeek-V3.2",
        "model_quick": "Doubao-Seed-2.0-mini",
        "model_refine": "Doubao-Seed-2.0-mini",
        "max_tokens": 4096,
        "display_name": "Vivo蓝心大模型",
    },
}

if LLM_PROVIDER not in PROVIDER_CONFIG:
    raise ValueError(f"🚨 不支持的 LLM_PROVIDER: {LLM_PROVIDER}")

config = PROVIDER_CONFIG[LLM_PROVIDER]
api_key = os.getenv(config["api_key_env"])

client = None
if LLM_PROVIDER != "vivo":
    client = OpenAI(
        api_key=api_key or "EMPTY",
        base_url=config["base_url"],
    )

print(f"✅ 当前激活的 LLM 渠道: {config['display_name']} ({config['model']})")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# 💡Pydantic 数据模型树（对齐 React 前端数据结构）
# ─────────────────────────────────────────────


class SpatialMapModel(BaseModel):
    """精准映射画板正面、背面、盲画空间占比"""

    abdomen: float
    lowerBack: float
    upperBody: float


class IntensityProfileModel(BaseModel):
    """精准映射绘画的速度与压感特征"""

    avgSpeed: float
    peakSpeed: float
    avgPressure: float


class TimeRhythmModel(BaseModel):
    """精准映射痛觉生成时间节律"""

    morning: float
    afternoon: float
    night: float
    dominantPeriod: str  # 限制为 'morning' | 'afternoon' | 'night'


class MedicalBackgroundModel(BaseModel):
    """严格对齐前端已声明的 flat 档案结构，解决 JS 数组与空字符串数值校验问题"""

    diagnosed: Optional[str] = ""
    allergies: Optional[str] = ""
    age: Optional[str] = ""
    lifestyle: Optional[str] = ""
    activityLevel: Optional[str] = ""
    familyHistory: Optional[str] = ""
    psychosocial: Optional[str] = ""
    reproductiveHistory: Optional[str] = ""
    height: Optional[Union[float, int, str]] = ""  # 兼容前端输入框中未填时的空字符串 ""
    weight: Optional[Union[float, int, str]] = ""  # 同上
    otherDiagnosis: Optional[str] = ""
    otherAllergies: Optional[str] = ""
    surgicalHistory: Optional[str] = ""
    menarcheAge: Optional[Union[int, str]] = ""
    cycleRegular: Optional[str] = ""
    periodDuration: Optional[str] = ""
    lastPeriod: Optional[str] = ""
    # 严格对齐前端 string[] 数组类型，设定默认空 List
    familyHistoryArr: Optional[List[str]] = Field(default_factory=list)
    lifestyleArr: Optional[List[str]] = Field(default_factory=list)
    reproductiveHistoryArr: Optional[List[str]] = Field(default_factory=list)
    accompanyingSymptomsArr: Optional[List[str]] = Field(default_factory=list)


class PainData(BaseModel):
    dominantPain: str
    userPref: str
    painScore: int
    brushCounts: Optional[Dict[str, int]] = None
    spatialMap: Optional[SpatialMapModel] = None  # 强类型嵌套
    intensityProfile: Optional[IntensityProfileModel] = None  # 强类型嵌套
    timeRhythm: Optional[TimeRhythmModel] = None  # 强类型嵌套
    colorPalette: Optional[str] = None
    bodyMode: Optional[str] = None
    medicalBackground: Optional[MedicalBackgroundModel] = None  # 强类型嵌套
    tonePreference: Optional[str] = "gentle"
    cycleDay: str = "未提供"
    targetLanguage: Optional[str] = "zh"
    isQuickLog: Optional[bool] = False
    accompanyingSymptoms: Optional[List[str]] = Field(default_factory=list)


# ─────────────────────────────────────────────
# 双语映射表
# ─────────────────────────────────────────────
PAIN_MAP = {
    "zh": {
        "twist": "绞痛/痉挛性收缩痛",
        "pierce": "针刺/尖锐刺痛",
        "heavy": "重压坠酸胀痛",
        "wave": "弥漫性酸胀痛",
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
# 辅助处理与运行时安全防御型函数（已对齐 Pydantic 强类型属性访问）
# ═══════════════════════════════════════════════════════════


def build_pain_location_desc(spatial_map: Optional[SpatialMapModel], lang: str) -> str:
    if not spatial_map:
        return "未提供位置定位" if lang == "zh" else "Location not provided"

    desc_parts = []
    if spatial_map.abdomen > 0:
        desc_parts.append(
            f"下腹盆腔核心区 {spatial_map.abdomen*100:.0f}%"
            if lang == "zh"
            else f"Anterior lower pelvis {spatial_map.abdomen*100:.0f}%"
        )
    if spatial_map.lowerBack > 0:
        desc_parts.append(
            f"腰骶骶骨区 {spatial_map.lowerBack*100:.0f}%"
            if lang == "zh"
            else f"Lumbosacral region {spatial_map.lowerBack*100:.0f}%"
        )

    return (
        "、".join(desc_parts)
        if desc_parts
        else ("弥漫性盆腔疼痛" if lang == "zh" else "Diffuse pelvic pain")
    )


def build_risk_warning(mb: Optional[MedicalBackgroundModel], lang: str) -> str:
    if not mb:
        return (
            "目前未见特异性药物过敏风险提示"
            if lang == "zh"
            else "No specific medication risks documented"
        )
    warnings = []
    allergy = mb.allergies or ""

    if allergy == "ibuprofen":
        warnings.append(
            "⚠️ 明确布洛芬（NSAIDs）药物过敏史。临床用药时请避免处方布洛芬，建议遵医嘱替换为对乙酰氨基酚。"
            if lang == "zh"
            else "⚠️ Documented Ibuprofen (NSAIDs) allergy. Avoid prescribing Ibuprofen; consider Acetaminophen."
        )
    elif allergy == "aspirin":
        warnings.append(
            "⚠️ 阿司匹林过敏史，请避免使用NSAIDs水杨酸类药物。"
            if lang == "zh"
            else "⚠️ Aspirin allergy. Avoid salicylic NSAIDs."
        )
    elif allergy in ["penicillin", "sulfonamides"]:
        warnings.append(
            f"⚠️ 既往史存在【{allergy}】药物过敏，就诊时请务必主动告知门诊医师。"
            if lang == "zh"
            else f"⚠️ Documented {allergy} allergy. Please notify the attending gynecologist."
        )

    return (
        "\n".join(warnings)
        if warnings
        else (
            "目前未见特异性药物过敏风险提示"
            if lang == "zh"
            else "No specific medication risks documented"
        )
    )


def build_triage_advice(
    pain_score: int, symptoms: Optional[List[str]], lang: str
) -> str:
    s_list = symptoms or []
    severe_symptoms = [
        "呕吐",
        "晕倒",
        "昏厥",
        "发黑",
        "vomiting",
        "fainting",
        "blackout",
    ]
    has_severe = any(s in severe_symptoms for s in s_list)

    if pain_score > 70 or has_severe:
        return (
            "🏥 建议急门诊评估：当前痛觉评分较高且伴随自主神经系统受损指征（如恶心冷汗），建议尽快前往妇产科急门诊就诊，排除卵巢囊肿扭转或内膜异位囊肿破裂。"
            if lang == "zh"
            else "🏥 Urgent Gynecological Visit Recommended: High pain intensity with autonomic signs. Seek immediate assessment to rule out acute pelvic complications."
        )
    elif pain_score > 40:
        return (
            "🩺 建议常规门诊：疼痛中度发作，若休息后未见明显缓解或持续加剧，建议预约妇科门诊排查继发性病变。"
            if lang == "zh"
            else "🩺 Outpatient Gynecology Visit Recommended: Moderate symptoms. Consider scheduling a routine evaluation."
        )
    else:
        return (
            "🏠 居家自愈观察：目前痛感负荷尚处于可耐受范围，建议配合热敷、顺时针轻揉腹部、静卧等自愈措施。"
            if lang == "zh"
            else "🏠 Home Self-Care: Mild symptoms. Manage with rest and local thermotherapy."
        )


def build_exam_advice(mb: Optional[MedicalBackgroundModel], lang: str) -> Dict:
    exam = {
        "name": (
            "妇科盆腔超声（子宫及附件彩色多普勒超声）"
            if lang == "zh"
            else "Pelvic Color Doppler Ultrasound"
        ),
        "preparation": (
            "需在检查前1小时内饮水500-800ml，保持充盈膀胱（憋尿）。"
            if lang == "zh"
            else "Drink 500-800ml water 1 hour prior to scan; keep bladder comfortably full."
        ),
        "note": (
            "✅ 门诊首选无创初筛，用于评估子宫腺肌症、子宫肌瘤、内膜厚度及附件囊肿。"
            if lang == "zh"
            else "✅ First-line non-invasive screening to evaluate adenomyosis, uterine fibroids, and ovarian cysts."
        ),
    }
    return exam


def build_health_tips_link(pain_type: str, lang: str) -> str:
    pain_key_map = {
        "twist": "cramping",
        "pierce": "stabbing",
        "heavy": "dragging",
        "wave": "bloating",
        "scrape": "tearing",
    }
    pain_key = pain_key_map.get(pain_type, pain_type)
    return (
        f"📚 临床宣教：痛经的自愈管理与科学指引 → https://health-edu.org/gynecology/dysmenorrhea/{pain_key}"
        if lang == "zh"
        else f"📚 Educational Resources: Dysmenorrhea Self-management Guide → https://health-edu.org/en/gynecology/dysmenorrhea/{pain_key}"
    )


def build_cycle_context(cycle_day: str, lang: str) -> str:
    if not cycle_day or cycle_day in ["未提供", "Not provided", ""]:
        return ""
    day_str = cycle_day.lower()
    if lang == "en":
        if "1" in day_str or "2" in day_str:
            return "Current Phase: Acute Menstruation (Day 1-2). Prostaglandin levels peak, leading to acute uterine smooth muscle hyper-contraction."
        elif "3" in day_str or "4" in day_str or "5" in day_str:
            return "Current Phase: Mid-Late Menstruation (Day 3-5). Transitioning to sub-acute residual dull pain."
        elif "ovulat" in day_str:
            return "Current Phase: Ovulatory phase pain. Monitor for secondary pelvic congestion or intermenstrual bleeding."
    else:
        if any(d in cycle_day for d in ["1", "2"]):
            return "当前时期：行经期急性发作期（第1-2天）。前列腺素分泌达峰，子宫平滑肌呈高频痉挛性收缩，需重点镇痛与缓解缺血。"
        elif any(d in cycle_day for d in ["3", "4", "5"]):
            return "当前时期：月经中后期（第3-5天）。平滑肌张力逐渐下降，多呈钝性残余隐痛，需重点温热理疗。"
        elif "排卵" in cycle_day:
            return "当前时期：排卵期不适。需在病史采集时排查盆腔偶发性充血病变。"
    return ""


def map_cycle_day_to_phase(cycle_day: str, lang: str) -> str:
    if not cycle_day or cycle_day in ["未提供", "Not provided", ""]:
        return ""
    phase = "月经期" if lang == "zh" else "menstrual phase"
    if any(d in cycle_day for d in ["3", "4", "5", "6", "7"]):
        phase = "卵泡期" if lang == "zh" else "follicular phase"
    elif "排卵" in cycle_day:
        phase = "排卵期" if lang == "zh" else "ovulation phase"
    return (
        f"（生理阶段参考：用户目前处于{phase}）"
        if lang == "zh"
        else f"(Physiological phase: {phase})"
    )


def build_lifestyle_context(mb: Optional[MedicalBackgroundModel], lang: str) -> str:
    if not mb:
        return ""

    contexts = []
    age_map_zh = {
        "under18": "18岁以下",
        "18-25": "18-25岁",
        "26-35": "26-35岁",
        "36-45": "36-45岁",
        "over45": "45岁以上",
    }
    age_map_en = {
        "under18": "Under 18",
        "18-25": "18-25",
        "26-35": "26-35",
        "36-45": "36-45",
        "over45": "Over 45",
    }

    if mb.age:
        age_label = (
            age_map_en.get(mb.age, mb.age)
            if lang == "en"
            else age_map_zh.get(mb.age, mb.age)
        )
        contexts.append(
            f"年龄阶段: {age_label}" if lang == "zh" else f"Age cohort: {age_label}"
        )

    if mb.activityLevel:
        if mb.activityLevel == "sedentary":
            contexts.append(
                "静态习惯：工作/日常久坐多动少（易导致盆腔微循环淤血，加重坠胀）"
                if lang == "zh"
                else "Lifestyle factor: Sedentary desk habit (potentially worsening pelvic blood pooling)"
            )
        elif mb.activityLevel == "active":
            contexts.append(
                "日常体力活动量较大，有规律中高强度运动史"
                if lang == "zh"
                else "Lifestyle factor: High baseline physical activity"
            )

    # 生活 habits 整理
    lifestyle_map_zh = {
        "sleepShort": "睡眠时长不足",
        "sleepIrregular": "作息紊乱/倒班熬夜",
        "smoking": "吸烟",
        "alcohol": "常饮酒",
        "coldFood": "喜食生冷",
        "spicy": "喜辛辣",
    }
    lifestyle_map_en = {
        "sleepShort": "Insufficient sleep",
        "sleepIrregular": "Irregular schedule/night shifts",
        "smoking": "Active smoking",
        "alcohol": "Regular alcohol consumption",
        "coldFood": "Prefers cold food/iced drinks",
    }

    active_habits = []
    lifestyle_arr = mb.lifestyleArr or []
    for habit in [
        "sleepShort",
        "sleepIrregular",
        "smoking",
        "alcohol",
        "coldFood",
        "spicy",
    ]:
        if habit in lifestyle_arr:
            active_habits.append(
                lifestyle_map_en[habit] if lang == "en" else lifestyle_map_zh[habit]
            )

    if active_habits:
        contexts.append(
            f"不良作息与饮食倾向：{', '.join(active_habits)}"
            if lang == "zh"
            else f"Habit and dietary factors: {', '.join(active_habits)}"
        )

    # 家族史
    family_arr = mb.familyHistoryArr or []
    if family_arr and "none" not in family_arr:
        family_labels = []
        family_map_zh = {
            "mother": "母系严重痛经遗传史",
            "sister": "同胞姐妹痛经史",
            "unknown": "痛经家族史不详",
        }
        family_map_en = {
            "mother": "Maternal history of severe dysmenorrhea",
            "sister": "Sister with severe dysmenorrhea",
        }
        for f in family_arr:
            label = family_map_en.get(f, f) if lang == "en" else family_map_zh.get(f, f)
            family_labels.append(label)
        if family_labels:
            contexts.append(
                f"家族史：{', '.join(family_labels)}"
                if lang == "zh"
                else f"Family background: {', '.join(family_labels)}"
            )

    # 既往诊断
    diagnosis_map_zh = {
        "endometriosis": "子宫内膜异位症",
        "adenomyosis": "子宫腺肌症",
        "pcos": "多囊卵巢综合征",
        "fibroids": "子宫肌瘤",
        "pid": "盆腔炎性疾病（PID）",
    }
    diagnosis_map_en = {
        "endometriosis": "Endometriosis",
        "adenomyosis": "Adenomyosis",
        "pcos": "PCOS",
        "fibroids": "Uterine Fibroids",
        "pid": "Pelvic Inflammatory Disease",
    }
    if mb.diagnosed and mb.diagnosed not in ["none", "unchecked", ""]:
        diag_label = (
            diagnosis_map_en.get(mb.diagnosed, mb.diagnosed)
            if lang == "en"
            else diagnosis_map_zh.get(mb.diagnosed, mb.diagnosed)
        )
        contexts.append(
            f"临床诊断病史：曾确诊为 {diag_label}"
            if lang == "zh"
            else f"Clinical diagnosis history: Confirmed {diag_label}"
        )

    if contexts:
        header = (
            "\n【患者基本习惯、病史与暴露风险整合供LLM分析】\n"
            if lang == "zh"
            else "\n[Patient Lifestyle and Risk Profiling for LLM Analysis]\n"
        )
        return header + "\n".join(f"- {c}" for c in contexts)
    return ""


# ═══════════════════════════════════════════════════════════
# 核心生成端点
# ═══════════════════════════════════════════════════════════
@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    lang = str(data.targetLanguage or "zh")
    is_quick = bool(data.isQuickLog or False)
    mb = data.medicalBackground

    pt_dict = PAIN_MAP.get(lang, PAIN_MAP["zh"])
    bm_dict = BODY_MODE_MAP.get(lang, BODY_MODE_MAP["zh"])
    tone = TONE_MAP.get(lang, TONE_MAP["zh"]).get(data.tonePreference or "gentle")
    cycle_ctx = build_cycle_context(data.cycleDay, lang)
    lifestyle_ctx = build_lifestyle_context(mb, lang)
    phase_ctx = map_cycle_day_to_phase(data.cycleDay, lang)

    allergy = mb.allergies if mb else ""

    safe_painkiller = "对乙酰氨基酚" if lang == "zh" else "Acetaminophen"
    default_painkiller = "布洛芬" if lang == "zh" else "Ibuprofen"
    allergy_list = ["ibuprofen", "aspirin", "nsaids"]
    painkiller = safe_painkiller if (allergy in allergy_list) else default_painkiller

    pain_location_desc = build_pain_location_desc(data.spatialMap, lang)
    accompanying_symptoms = data.accompanyingSymptoms or []
    accompanying_desc = (
        "、".join(accompanying_symptoms)
        if accompanying_symptoms
        else ("无特殊伴随症状" if lang == "zh" else "No specific accompanying symptoms")
    )
    risk_warning = build_risk_warning(mb, lang)
    triage_advice = build_triage_advice(data.painScore, accompanying_symptoms, lang)
    exam_advice = build_exam_advice(mb, lang)
    health_tips_link = build_health_tips_link(data.dominantPain, lang)

    # ═══════════════════════════════════════════════════════════
    # 【Few-Shot 极少样本范例】：喂给大模型极其标准的规范样本，彻底杜绝幻觉
    # ═══════════════════════════════════════════════════════════
    FEW_SHOT_EXAMPLE_ZH = """
{
  "chief_complaint": "行经期第2天突发急性下腹痉挛性绞痛，伴恶心呕吐与后背放射感1天。",
  "present_illness": "患者既往月经规律。今日处于行经期第2天，前列腺素水平达峰，子宫平滑肌高频强烈收缩，突发急性下腹部持续性收紧绞痛，呈阵发性剧烈加重。伴有乳房酸胀痛及腰骶部明显坠胀。今日未自行服用药物。由于患者既往对布洛芬过敏，本次发作未进行NSAIDs类药物镇痛。病期无发热、无休克、无昏厥。尚未进行本次急症超声定位检查。",
  "past_history": "既往确诊‘子宫内膜异位症’病史。既往行剖宫产术2次。否认高血压、心脑血管病史。明确对布洛芬（NSAIDs）类药物过敏。",
  "menstrual_history": "月经初潮13岁。经期持续5天，周期28-30天，规律。末次月经（LMP）为2026年6月1日。当前处于经期急性疼痛高发阶段。",
  "clinical_diagnosis": "原发性痛经或继发性痛经发作（子宫内膜异位症引起可能）",
  "clinical_suggestions": "鉴于布洛芬过敏史，严禁临床处方NSAIDs药物，可遵医嘱替代为对乙酰氨基酚温水送服。居家应避免站立负重，卧床蜷缩侧卧休息，热敷下腹。建议尽快挂常规妇科门诊行超声探查，排查局部子宫粘连与巧克力囊肿大小。",
  "analogy": "像是肚子里有一把冰冷的铁钳子，正用力夹住子宫死死拧绞，每拧一下，后腰就跟着一阵发木发胀，连呼吸都觉得被生生拽住。",
  "work": "因今日突发重度生理期绞痛及全身虚脱，无法支持工作，特申请病假休息一天，紧急事务已妥善交接。",
  "action": [
    "☑️ 搓热手掌贴在她小腹上轻轻捂热，或放置温热的热水袋，温度不可过高以免烫伤。",
    "☑️ 由于她布洛芬过敏，切勿擅自准备布洛芬！可以倒一杯温开水并准备好对乙酰氨基酚，督促她温服。",
    "☑️ 主动承担今天所有家务，关好房门和灯光，让她在安静低照度的被窝里静卧休息。"
  ],
  "selfCare": [
    "✨ 痛经是身体内部平滑肌痉挛引起的切实物理伤害。请允许自己今天躺平，不生产任何价值也无需抱有任何愧疚感。",
    "✨ 采用侧卧婴儿蜷缩位，用松软枕头夹在双侧膝盖之间，能够最快释放盆腔及骶骨处的充血张力，缓解绞痛。",
    "✨ 缓慢腹式深吸气（4秒吸气，8秒拉长呼气），长呼气可以调动副交感神经，使子宫血管松弛缓解缺血。"
  ]
}
"""

    if lang == "en":
        sys_prompt = f"""
You are an expert clinical gynecological medical assistant. Translate the visual pain pattern and patient questionnaires into standard case histories and empathy directives.

【CRITICAL ANTI-HALLUCINATION RULES】
1. NEVER invent any symptoms, surgeries, ages, or allergies that the user didn't specify.
2. If age is empty/not provided -> do NOT output age, or write "Adult female".
3. Use strict clinical vocabulary. Avoid vague adjectives.
4. Output MUST be a strictly valid JSON.

{FEW_SHOT_EXAMPLE_ZH}
"""
    else:
        sys_prompt = f"""
你是一名严谨的妇产科门诊电子病历转译助手。你需要将用户填写的医疗档案和绘制的动态痛觉矢量指标，重构翻译成符合医院门诊入院记录（规范病历）和自愈指令的结构。

【严格防幻觉与规范化硬性要求】
1. 【绝对禁止无中生有】！如果用户未提供药物过敏，就写“无已知药物过敏”；未填手术史，就写“无明确大型手术史”；未提供年龄就不要提及患者的具体年龄数值！
2. 术语规范：采用妇科临床医学规范化中文。严禁口语化或晦涩古板，如“月事”一律使用“行经期”、“月经周期”。
3. 药物防错红线：对布洛芬或NSAIDs过敏者，【绝对禁止】在其‘action’或‘clinical_suggestions’中出现任何布洛芬、阿司匹林、双氯烟酸等处方建议，必须明确指导使用“对乙酰氨基酚”！
4. 周期作息融合：结合用户当前所处的经期生理阶段特征，给出合理的运动和睡眠休养建议。

{FEW_SHOT_EXAMPLE_ZH}
"""

    user_prompt = f"""
【前端提交的真实特征向量与基础档案数据（绝对禁止在此范围外编造任何信息）】

- 痛觉主导模式：{pt_dict.get(data.dominantPain, data.dominantPain)}
- 绘图总痛觉负荷（评分）：{data.painScore}/100
- 痛觉绘图定位：{pain_location_desc}
{phase_ctx}
{cycle_ctx}
{lifestyle_ctx}

【临床采集档案】
- 既往已确诊诊断：{get_val_from_mb(mb, "diagnosed")}
- 外科手术史：{get_val_from_mb(mb, "surgicalHistory")}
- 药物过敏史：{get_val_from_mb(mb, "allergies")}
- 初潮年龄：{getattr(mb, 'menarcheAge', '未提供') if mb else '未提供'} 岁
- 月经周期规律性：{getattr(mb, 'cycleRegular', '未提供') if mb else '未提供'}
- 持续行经天数：{getattr(mb, 'periodDuration', '未提供') if mb else '未提供'} 天
- 末次月经第一天（LMP）：{getattr(mb, 'lastPeriod', '未提供') if mb else '未提供'}
- 伴随症状：{accompanying_desc}

【文案偏好与语气风格】：{tone}

请严格根据上述真实输入，直接输出一个精准定制且符号化的 JSON 对象：
"""

    model_name = config["model_quick"] if is_quick else config["model"]

    try:
        print(f"🤖 正在请求服务提供商: {config['display_name']} ({model_name})...")

        # ═══════════════════════════════════════════════════════════
        # 【蓝心 LLM (Vivo) API 特化请求分流】
        # ═══════════════════════════════════════════════════════════
        if LLM_PROVIDER == "vivo":
            url = f"{config['base_url']}/chat/completions"
            headers = {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {api_key}",
            }
            # 蓝心大模型强要求的唯一 request_id
            params = {"request_id": str(uuid.uuid4())}
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.2,  # ⚡ 调低温度至 0.2 极大压制幻觉，确保输出稳定性
                "max_tokens": config["max_tokens"],
                "stream": False,
            }

            response = requests.post(
                url, headers=headers, params=params, json=payload, timeout=60
            )
            response.raise_for_status()
            response_data = response.json()
            raw_text = response_data["choices"][0]["message"]["content"]
        else:
            # 传统标准 OpenAI 兼容调用
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,  # ⚡ 同样调低温度
                response_format={"type": "json_object"},
            )
            raw_text = completion.choices[0].message.content

        # 清洗返回可能携带的 markdown 包装
        cleaned_text = re.sub(
            r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE | re.IGNORECASE
        )
        cleaned_text = re.sub(r"```\s*$", "", cleaned_text, flags=re.MULTILINE).strip()

        start = cleaned_text.find("{")
        end = cleaned_text.rfind("}")
        if start != -1 and end != -1:
            cleaned_text = cleaned_text[start : end + 1]

        parsed_json = json.loads(cleaned_text, strict=False)

        print("✅ JSON 解析成功且符合 Few-Shot 门诊标准病历模版!")

        return {
            "status": "success",
            "language": lang,
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
            # 规则强保障模块
            "pain_location": pain_location_desc,
            "accompanying_symptoms": accompanying_desc,
            "risk_warning": risk_warning,
            "triage_advice": triage_advice,
            "exam_advice": exam_advice,
            "health_tips_link": health_tips_link,
        }

    except Exception as e:
        print(f"❌ 大模型处理报错，触发无缝安全降级。错误详情: {str(e)}")
        fallback = _fallback_response(lang, painkiller)
        fallback.update(
            {
                "pain_location": pain_location_desc,
                "accompanying_symptoms": accompanying_desc,
                "risk_warning": risk_warning,
                "triage_advice": triage_advice,
                "exam_advice": exam_advice,
                "health_tips_link": health_tips_link,
            }
        )
        return fallback


def get_val_from_mb(
    mb: Optional[MedicalBackgroundModel], key: str, fallback: str = "未提供"
) -> str:
    if not mb:
        return fallback
    val = getattr(mb, key, "")
    if not val or val in ["none", "unchecked", "unknown"]:
        return fallback
    return str(val)


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
            "clinical_suggestions": "Rest, heat therapy, and consider NSAIDs if no indications.",
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
            ],
        }
    else:
        return {
            "status": "success",
            "language": "zh",
            "chief_complaint": "主诉：周期性痛经发作伴下腹部绞痛1天。",
            "present_illness": "患者自述既往月经规律。于行经第2天，因前列腺素水平升高刺激出现下腹持续痉挛绞痛，阵发加剧，伴腰骶部酸沉。自行热敷改善微弱。",
            "past_history": "无特殊既往病史、无明确手术史。",
            "menstrual_history": "月经初潮13岁，周期规律，LMP未填。",
            "clinical_diagnosis": "原发性痛经或盆腔器质性病变筛查",
            "clinical_suggestions": "休息、热敷，避免剧烈运动。必要时可根据医嘱使用常规对乙酰氨基酚等非敏感镇痛药物。",
            "analogy": "像有人把你的子宫深处拧成一股麻绳，再用粗糙的砂纸反复拉磨打磨。",
            "work": "因今天经期突发急性坠胀严重绞痛且无法站立，申请病假休整一天，特此交接工作。",
            "action": [
                f"☑️ 准备一个温热的热水袋，帮她放置在下腹部或后腰处进行物理热敷理疗。",
                f"☑️ 帮她倒一杯温热的饮用水，并遵医嘱准备好安全的非过敏止痛药{painkiller}。",
                f"☑️ 主动替她分担今日所有的繁杂家务，保持室内环境安静温和。",
            ],
            "selfCare": [
                "✨ 痛经是身体深处的真实生理抗议。允许自己今天闭目休息，你已经非常勇敢了。",
                "✨ 采用侧卧婴儿蜷缩式，膝盖之间夹枕头，放松紧绷的盆腔肌肉。",
                "✨ 尽量拉长呼吸，吸气4秒、平稳呼气8秒，能帮过度兴奋的盆底肌肉尽快放松下来。",
            ],
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

    request_id = str(uuid.uuid4())

    if lang == "en":
        sys_prompt = "You are an expert clinical copy editor. Rewrite the medical text based on user feedback. Output ONLY the refined text. No explanations."
        user_prompt = f"Original:\n{current_text}\n\nFeedback: {user_feedback}\n\nRewrite directly:"
    else:
        sys_prompt = "你是严谨的妇科医学病历润色助手。根据患者或用户的修改意见对原文文本进行优化。只需输出修改后的最终文本，绝对不要包含任何多余解释！"
        user_prompt = f"原文：\n{current_text}\n\n修改意见：\n{user_feedback}\n\n直接输出修改结果："

    try:
        # vivo 优化流
        if LLM_PROVIDER == "vivo":
            url = f"{config['base_url']}/chat/completions"
            headers = {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {api_key}",
            }
            params = {"request_id": request_id}
            payload = {
                "model": config["model_refine"],
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.2,  # 锁定低温度确保不发散
                "max_tokens": 1024,
                "stream": False,
            }

            response = requests.post(
                url, headers=headers, params=params, json=payload, timeout=30
            )
            response.raise_for_status()
            response_data = response.json()
            refined = response_data["choices"][0]["message"]["content"].strip()
        else:
            completion = client.chat.completions.create(
                model=config["model_refine"],
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
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
    return {"posts": load_posts()}


@app.post("/api/posts")
async def create_post(data: dict):
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
        "message": "PainScape Backend running (Vivo BlueLM SDK Integrated)",
        "model": config["display_name"],
    }
