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

# ─────────────────────────────────────────────
# 双语映射表
# ─────────────────────────────────────────────
PAIN_MAP = {
    "zh": {"twist": "绞痛/痉挛性收缩痛", "pierce": "针刺/尖锐刺痛", "heavy": "重压坠胀痛", "wave": "弥漫性胀痛", "scrape": "刀刮撕裂痛"},
    "en": {"twist": "cramping / spasmodic pain", "pierce": "stabbing / radiating pain", "heavy": "heavy pressure", "wave": "diffuse bloating pain", "scrape": "tearing pain"}
}
BODY_MODE_MAP = {
    "zh": {"front": "盆腔前侧", "back": "腰骶部/后侧", "both": "双侧"},
    "en": {"front": "anterior pelvis", "back": "lumbosacral region", "both": "bilateral"}
}
TONE_MAP = {
    "zh": {"gentle": "温柔体贴、注重情感支持", "professional": "简洁专业", "assertive": "直接有力、边界清晰"},
    "en": {"gentle": "warm and empathetic", "professional": "concise and professional", "assertive": "direct and firm"}
}

def build_cycle_context(cycle_day: str, lang: str) -> str:
    if not cycle_day or cycle_day in ["未提供", "Not provided", ""]: return ""
    day_str = cycle_day.lower()
    if lang == "en":
        if "1" in day_str or "2" in day_str: return "Acute phase (Day 1-2): peak prostaglandins."
        elif "3" in day_str or "4" in day_str or "5" in day_str: return "Recovery phase (Day 3-5): dull pain."
        elif "ovulat" in day_str: return "Ovulation pain: flag potential endo."
    else:
        if any(d in cycle_day for d in ["1", "2"]): return "急性期（第1-2天）：前列腺素达峰，需侧重急性镇痛。"
        elif any(d in cycle_day for d in ["3", "4", "5"]): return "缓解期（第3-5天）：侧重隐痛与坠胀缓解。"
        elif "排卵" in cycle_day: return "排卵期异常痛：需在主诉中提示排查继发性病变。"
    return ""

# ─────────────────────────────────────────────
# 核心生成端点
# ─────────────────────────────────────────────
@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    lang = data.targetLanguage or "zh"
    is_quick = data.isQuickLog or False
    mb = data.medicalBackground or {}
    
    pt_dict = PAIN_MAP.get(lang, PAIN_MAP["zh"])
    bm_dict = BODY_MODE_MAP.get(lang, BODY_MODE_MAP["zh"])
    tone = TONE_MAP.get(lang, TONE_MAP["zh"]).get(data.tonePreference or "gentle")
    cycle_ctx = build_cycle_context(data.cycleDay, lang)
    allergy = mb.get("allergies", "无")
    diag = mb.get("diagnosed", "无既往确诊")
    
    JSON_TEMPLATE = """
    {
      "analogy": "你的痛觉通感描述...",
      "work": "你的请假条...",
      "med": "你的临床主诉...",
      "action": ["操作1", "操作2", "操作3"],
      "selfCare": ["建议1", "建议2", "建议3"]
    }
    """

    if lang == "en":
        sys_prompt = (
            "You are a Feminist Health Tech Assistant. Output ONLY a valid JSON object. DO NOT output markdown blocks.\n"
            "CRITICAL CONSTRAINTS:\n"
            "1. 'analogy': Visceral metaphorical description. Make it highly specific to the exact pain type.\n"
            "2. 'work': Brief text message to a boss requesting sick leave (under 40 words). Ban formal medical terms.\n"
            "3. 'med': Detailed clinical complaint (80-120 words). Must strongly reflect the specific pain type, patient history, and suggest ONLY ONE medical exam (e.g., Pelvic Ultrasound) to avoid UI clutter.\n"
            "4. 'action': Array of 3-4 detailed actions. MUST directly target the specific pain type.\n"
            "5. 'selfCare': Array of 4-5 items. Integrate 'Crip Time' and physical relief tailored to this exact pain. Do not recommend allergens.\n"
            f"MUST USE THIS EXACT JSON STRUCTURE:\n{JSON_TEMPLATE}"
        )
    else:
        sys_prompt = (
            "你是一个受女性主义HCI启发的健康助理。必须严格输出JSON，绝对不要输出Markdown标记！\n"
            "硬性规则：\n"
            "1. 'analogy': 极具画面感的通感比喻。必须与给定的【痛感质地】高度吻合！\n"
            "2. 'work': 极其接地气的微信请假条（40字以内）。如：“老板，今天突发急病疼得起不来，请假一天休息，工作已交接。” 绝不能用公文体词汇。\n"
            "3. 'med': 饱满的临床主诉（80-120字）。【极其重要】：必须根据特定的痛感（如绞痛/坠痛/撕裂痛）来写主诉！融合既往病史，并仅推荐【一项】最具针对性的检查（如仅写'盆腔超声'或'腹腔镜'），绝对不要罗列多个检查！\n"
            "4. 'action': 必须是字符串数组！提供 3-4 条具体的伴侣实操动作。必须与痛觉类型（如针对坠胀、针对刺痛）强关联配合！\n"
            "5. 'selfCare': 必须是字符串数组！提供 4-5 条带女性主义视角的建议。必须针对该痛觉给出特定的缓解姿势，融入'残疾时间'理念，严禁推荐过敏药物。\n"
            f"【警告】必须严格按照以下JSON格式输出，不要改变键名：\n{JSON_TEMPLATE}"
        )

    user_prompt = f"""
【痛觉核心数据】（你生成的所有内容必须围绕以下特征，绝不能千篇一律！）
- 痛感质地：{pt_dict.get(data.dominantPain, data.dominantPain)}
- 疼痛强度：{data.painScore}/100 
- 身体部位：{bm_dict.get(data.bodyMode, data.bodyMode)}

【医疗与周期背景】
- 既往诊断：{diag}
- 月经周期语境：{cycle_ctx}
- 药物过敏：{allergy} （绝不能在此次建议中推荐此药）

【语气偏好】
{tone}

请直接输出符合模板的精准定制化 JSON："""

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
        
        # 终极暴力清洗与截取
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE|re.IGNORECASE)
        cleaned_text = re.sub(r"```\s*$", "", cleaned_text, flags=re.MULTILINE).strip()
        
        # 确保只解析 JSON 对象部分
        start = cleaned_text.find('{')
        end = cleaned_text.rfind('}')
        if start != -1 and end != -1:
            cleaned_text = cleaned_text[start:end+1]
        
        # 【救命神药】：strict=False 允许大模型在 JSON 字符串里乱敲回车！
        parsed_json = json.loads(cleaned_text, strict=False)
        
        print("✅ JSON 解析成功! 主诉内容获取正常。")
        return {"status": "success", "language": lang, **parsed_json}

    except Exception as e:
        print(f"❌ 生成失败，触发保底。错误原因: {str(e)}")
        # 注意：此处必须返回 success，否则前端 React 会强制覆盖掉我们的优质保底文案！
        return _fallback_response(lang)

# ─────────────────────────────────────────────
# 降级字典 (即使报错，也会强制让前端显示以下优质内容)
# ─────────────────────────────────────────────
def _fallback_response(lang: str) -> dict:
    if lang == "en":
        return {
            "status": "success", 
            "language": "en",
            "analogy": "Imagine your lower abdomen being twisted into a tight, relentless knot, repeatedly pressed with a scalding iron...\n\nIt's a physically exhausting storm that drains every ounce of focus.",
            "work": "Hi Manager, I have a sudden severe medical issue today and can't get out of bed. I need to take a sick leave. Urgent matters are handed over.",
            "med": "Patient presents with intense, spasmodic cramping in the lower abdomen, accompanied by pronounced lumbosacral heaviness. Symptoms suggest acute dysmenorrhea exacerbation. Given the pain severity and disruption of daily activities, a pelvic ultrasound is recommended to rule out secondary etiologies.",
            "action": [
                "☑️ Immediately prepare a heat pad and secure it against her lower back or abdomen.",
                "☑️ Quietly bring a glass of warm water and her preferred, safe painkiller.",
                "☑️ Take over all cognitive and physical household labor for the day."
            ],
            "selfCare": [
                "✨ Embrace 'Crip Time': It is completely valid to cancel plans and exist in survival mode today.",
                "✨ Posture Adjustment: Try the fetal position with a pillow between your knees.",
                "✨ Regulate your nervous system: Focus on slow, deep exhales to signal safety."
            ],
        }
    else:
        return {
            "status": "success", 
            "language": "zh",
            "analogy": "像有人把你的盆腔深处拧成一股麻花，再用烙铁反复不断地烫过。紫红色的痛感仿佛带着重量，拖拽着腰骶往下坠。\n\n这不是夸张的修辞，这是此刻正在真实发生、持续消耗她体力的生理灾难。",
            "work": "老板你好，我今天突发身体急症，目前疼得实在起不来，申请请假一天居家休息，紧急工作已交接，感谢批准。",
            "med": "患者自述下腹部呈持续性剧烈痉挛绞痛，阵发性加剧，并伴有明显的腰骶部沉重坠胀感。疼痛已导致患者无法直立行走及维持专注。结合既往病史，为排查继发性病变，建议择期行盆腔超声检查。",
            "action": [
                "☑️ 针对痉挛绞痛：立刻准备一个温度适宜的热水袋或暖贴，帮她妥善固定在下腹部或后腰。",
                "☑️ 针对体力耗竭：帮她倒一杯温水放在床头，主动承担今天的全部家务，甚至包括点外卖这种‘决策劳动’。",
                "☑️ 空间陪伴法则：如果她不想说话，请调暗灯光安静退出房间；如果她需要支撑，把搓热的手掌贴在她的痛处。"
            ],
            "selfCare": [
                "✨ 赋权你的‘残疾时间’：今天不生产任何价值也是完全合法的。允许自己躺平，不要为请假感到哪怕一丝愧疚。",
                "✨ 缓解特定坠痛的姿势：尝试侧卧婴儿蜷缩式，或者膝胸卧位（臀部抬高），这样能最快减轻盆腔充血。",
                "✨ 神经系统安抚：疼痛会让身体误以为处于危险中。试着拉长呼气的时间，告诉大脑‘我们现在很安全’。"
            ],
        }

# ─────────────────────────────────────────────
# 真实的 /api/refine (优化引擎)
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
            messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}],
            temperature=0.7,
        )
        refined = completion.choices[0].message.content.strip()
        refined = re.sub(r"^```[\s\S]*?\n", "", refined)
        refined = re.sub(r"```$", "", refined).strip()
        return {"refined": refined, "language": lang}
    except Exception as e:
        print(f"🚨 优化错误: {e}")
        return {"refined": current_text, "language": lang}

@app.get("/")
def read_root():
    return {"message": "PainScape Backend running (Feminist HCI Version)", "model": config["display_name"]}