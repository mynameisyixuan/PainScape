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
    cycleDay: str = "未提供"
    targetLanguage: Optional[str] = "zh"  # 新增：目标语言
    isQuickLog: Optional[bool] = False  # 新增：快速记录标记

PAIN_MAP = {
    "twist": "绞痛/痉挛性收缩痛",
    "pierce": "针刺/钻痛/放射痛",
    "heavy": "重压坠胀感",
    "wave": "弥漫性阵发性胀痛",
    "scrape": "刀刮撕裂痛",
}

BODY_MODE_MAP = {
    "front": "腹部/盆腔前侧",
    "back": "腰骶部/后侧",
    "both": "腹部与腰骶部双侧",
}

BRUSH_LABEL_MAP = {
    "twist": "绞/拧",
    "pierce": "荆/刺",
    "heavy": "坠/压",
    "wave": "胀/扩",
    "scrape": "刮/撕",
}


@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    mb = data.medicalBackground or {}
    intensity = data.intensityProfile or {}
    spatial = data.spatialMap or {}
    brush_counts = data.brushCounts or {}
    target_lang = data.targetLanguage or "zh"  # 获取目标语言

    pain_type = PAIN_MAP.get(data.dominantPain, "复合性痛经")
    body_location = BODY_MODE_MAP.get(data.bodyMode or "front", "腹部/盆腔")
    
    if mb.get("allergies") in ["unknown", "none", "", None]:
        allergies = "无已知过敏记录"
    else:
        allergies = mb.get("allergies", "无已知过敏")
    
    if mb.get("diagnosed") in ["unchecked", "", None]:
        diagnosed = "未做过相关妇科检查"
    elif mb.get("diagnosed") == "none":
        diagnosed = "无既往病史记录"
    else:
        diagnosed = mb.get("diagnosed", "无既往病史记录")
    
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
        "assertive": "直接有力、边界清晰",
    }
    tone_desc = tone_map.get(data.tonePreference or "gentle", "温柔体贴")
    
    # 【新增】：解析周期天数，生成临床指导语境
    cycle_context = ""
    if data.cycleDay and data.cycleDay != "未提供":
        if data.cycleDay in ["第1天", "第2天"]:
            cycle_context = "患者处于月经第1-2天（急性期），此时前列腺素分泌达峰，疼痛最为剧烈。selfCare 必须侧重急性疼痛管理（如紧急止痛姿势、快速热敷法），analogy 需体现痛感的急性发作与猛烈程度。"
        elif "第3" in data.cycleDay or "第4" in data.cycleDay or "第5" in data.cycleDay:
            cycle_context = "患者处于月经第3-5天（缓解期），急性疼痛开始消退但伴随疲劳与坠胀。selfCare 必须侧重修复与营养补充（如补铁饮食、温和拉伸），建议关注是否有需要复查的持续隐痛。"
        elif "排卵" in data.cycleDay:
            cycle_context = "患者处于排卵期疼痛（非经期痛），这属于异常出血或排卵痛。med 必须提示其与子宫内膜异位症或盆腔粘连的潜在关联，建议排查，selfCare 需强调非经期痛的观察记录。"
    
    is_quick = data.isQuickLog if hasattr(data, 'isQuickLog') else False

    # ============ 多语言 System Prompt ============
    if target_lang == "en":
        system_prompt = """You are a professional menstrual pain management consultant, skilled at translating embodied pain perception data into language expressions for different social scenarios.

You must output strictly according to the following JSON schema, without adding any extra fields or explanatory text:

{
"analogy": "(For partner) A vivid synesthetic metaphor describing this pain, helping those without period pain experience it, in a gentle and authentic tone, 100-150 words",
"work": "(For workplace/HR) A formal and concise leave or work-from-home request explanation, avoiding emotional language, highlighting physiological objectivity, 60-100 words",
"med": "(For doctor) A standardized medical language chief complaint description, including pain nature, location, intensity, accompanying symptom speculation, 50-80 words",
"selfCare": "(For self) 5 specific actionable immediate self-care suggestions, listed separately, each within 20 words, covering posture, hot compress, diet, breathing, psychology dimensions, avoid recommending allergen medications"
}

Rules:
1. SelfCare must not recommend medications the patient is allergic to (allergy info provided in data)
2. Analogy must include at least one specific sensory metaphor, language should be rich, using pain translation from common organs that most people can imagine. Reference examples: intense stabbing/neuropathic pain can be described as "imagine getting a root canal without anesthesia", "like stepping on your shin bone with a heel", etc.
3. Med must start with "Patient reports"
4. All content must be based on provided pain data, no fabricated symptoms
5. Output must be valid JSON, no markdown code blocks
6. If recommending examinations, use precise terms: pelvic ultrasound, transvaginal ultrasound, hormone panel, laparoscopy. Briefly explain each exam to avoid patient confusion.
7. IMPORTANT: All output text must be in English only."""

        # English user prompt
        pain_type_en = {
            "twist": "cramping/spasmodic colicky pain",
            "pierce": "stabbing/drilling/radiating pain",
            "heavy": "heavy pressure/dragging sensation",
            "wave": "diffuse intermittent bloating pain",
            "scrape": "scraping/tearing pain"
        }.get(data.dominantPain, "complex dysmenorrhea")
        
        body_location_en = {
            "front": "anterior abdomen/pelvis",
            "back": "lumbosacral region/posterior",
            "both": "bilateral abdomen and lumbosacral"
        }.get(data.bodyMode or "front", "anterior abdomen/pelvis")
        
        allergy_en = "No known allergies"
        if mb.get("allergies") not in ["unknown", "none", "", None]:
            allergy_en = mb.get("allergies", "No known allergies")
        
        diagnosed_en = {
            "endometriosis": "Endometriosis",
            "adenomyosis": "Adenomyosis",
            "fibroids": "Uterine Fibroids",
            "pcos": "PCOS",
            "pid": "Pelvic Inflammatory Disease (PID)",
            "ovariancyst": "Ovarian Cyst",
            "cervicalstenosis": "Cervical Stenosis",
            "unchecked": "No gynecological examination performed",
            "none": "No previous diagnosis",
            "": "No previous diagnosis"
        }.get(mb.get("diagnosed", ""), mb.get("diagnosed", "No previous diagnosis"))
        
        cycle_info_en = f"Menstrual day: {data.cycleDay}" if data.cycleDay != "未提供" else "Not provided"
        
        user_prompt = f"""Based on the following patient's pain mapping data, please generate a four-scenario translation report:

【Basic Pain Information】
- Dominant pain type: {pain_type_en}
- Pain location: {body_location_en}
- Self-rated pain score: {data.painScore}/10
- Color choice: {data.colorPalette or 'Crimson'} (reflects emotional state)

【Drawing Behavior Data】
- Brush distribution: {brush_desc}
- Stroke intensity: {intensity_desc}
- Spatial distribution: {spatial_desc}

【Medical History】
- Diagnosed condition: {diagnosed_en}
- Drug allergies: {allergy_en} (DO NOT recommend these medications in selfCare)

【Menstrual Cycle】{cycle_info_en}
{cycle_context}

【Tone Preference】{tone_desc}

Please generate the JSON report:"""
        
    else:
        # 中文（默认）
        system_prompt = """你是一个专业的痛经疼痛管理顾问，擅长将具身化的疼痛感知数据转译为不同社会场景下的语言表达。

你必须严格按照以下 JSON schema 输出，不得添加任何额外字段或解释性文字：

{
"analogy": "（面向伴侣）用生动的通感比喻描述这种痛觉，帮助没有痛经经验的人感同身受，语气温柔真实，120-160字",
"work": "（面向职场/HR）一段正式简洁的请假或居家申请说明，避免情绪化表达，突出生理客观性，80-120字",
"med": "（面向医生）规范医疗语言的主诉描述，包含疼痛性质、部位、强度、伴随症状推测，60-100字",
"selfCare": "（面向自身）5条具体可操作的当下自愈建议，分行列出，每条30字以内，涵盖姿势、热敷、饮食、呼吸、心理5个维度，避免建议过敏药物"
}

规则：
1. selfCare 中严禁推荐患者过敏的药物（过敏信息会在数据中提供）
2. analogy 必须包含至少一个具体的感官比喻，语言要丰富，要用到通用器官的痛感转译，让大多数人能够想象。参考示例：强烈的刺钻、神经性痛感可以描述为"想象一下不打麻药做根管治疗"，"用脚碾小腿骨"，"用脚踩住睾丸"等。
3. med 必须使用"患者自述"开头
4. 所有内容必须基于提供的疼痛数据，不得虚构症状
5. 输出必须是合法 JSON，不含 markdown 代码块
6. 如果建议患者进行检查，请务必在 'med' 字段中使用以下精确术语之一：盆腔超声、经阴道超声、激素六项、腹腔镜。并简单给出对应检查的基础解释避免患者感到困惑
7. 重要：所有输出文字必须使用简体中文。"""

        if is_quick:
            system_prompt += "\n特别注意：用户处于剧烈疼痛的快速记录模式，数据颗粒度较粗。请基于提供的疼痛类型和评分直接给出最核心、最急需的缓解建议，语气要更加安抚和直接，减少长篇大论的比喻。"

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

【月经周期】{f"本次为月经第 {data.cycleDay} 天" if data.cycleDay != "未提供" else "未提供"}
{cycle_context}

【语气偏好】{tone_desc}

请生成 JSON 报告："""

    try:
        print(f"🤖 正在请求通义千问... (目标语言: {target_lang})")
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
                llm_reply[field] = f"[{field} generation failed, please retry]"

        return {"status": "success", "language": target_lang, **llm_reply}

    except Exception as e:
        print(f"🚨 后端错误: {e}")
        
        # 根据语言返回不同的降级内容
        if target_lang == "en":
            fallback = {
                "status": "error",
                "language": "en",
                "analogy": "It feels like someone is twisting your abdomen into a tight knot while pressing a hot iron against it—this isn't an exaggeration, this is really happening.",
                "work": "Due to severe primary dysmenorrhea, I am unable to work normally today and expect to need a day of rest at home. Thank you for understanding.",
                "med": "Patient reports spasmodic cramping pain in the lower abdomen, severe in intensity, accompanied by lumbosacral heaviness. Today is day one of the menstrual cycle, and symptoms significantly impact daily function.",
                "selfCare": "• Apply a heating pad to the lower abdomen for 15-20 minutes\n• Try knee-chest position to relieve pelvic congestion\n• Supplement magnesium (e.g., nuts) to help ease cramps\n• Practice slow, deep breathing to reduce muscle tension\n• Allow yourself to rest without guilt—pain is real and valid",
            }
        else:
            fallback = {
                "status": "error",
                "language": "zh",
                "analogy": "像有人把你的腹部拧成麻花，又用烙铁烫过——这不是夸张，这是真实发生的事。",
                "work": "因严重原发性痛经，本人今日无法正常出勤，预计需居家休息一天，特此说明。",
                "med": "患者自述下腹部痉挛性绞痛，程度较重，伴腰骶部坠胀，今日为月经周期第一天，症状影响日常功能。",
                "selfCare": "• 热水袋敷于下腹部15-20分钟\n• 膝胸卧位缓解盆腔充血\n• 补充镁元素（如坚果）有助于缓解痉挛\n• 尝试缓慢腹式呼吸放松肌肉\n• 允许自己休息，痛经不是你的错",
            }
        
        return fallback


@app.post("/api/refine")
async def refine_content(data: dict):
    """优化内容接口"""
    field = data.get("field", "")
    current_text = data.get("currentText", "")
    user_feedback = data.get("userFeedback", "")
    target_lang = data.get("targetLanguage", "zh")  # 获取目标语言
    
    if not current_text or not user_feedback:
        return {"refined": current_text}
    
    # 根据目标语言设置 system prompt
    if target_lang == "en":
        system_prompt = "You are a professional medical content editor. Rewrite the following text based on user feedback. Keep the same meaning but adjust style/tone as requested. Output ONLY the refined text, no explanations. Language must be in English."
        
        lang_instruction = "IMPORTANT: Your response must be in English."
        
        # 字段映射（英文）
        field_contexts = {
            "analogy": "This is a synesthetic pain description for a partner to understand the pain experience.",
            "action": "This is a list of practical care actions for a partner to take.",
            "work": "This is a formal leave request for work/HR.",
            "workText": "This is a formal leave request for work/HR.",
            "med_complaint": "This is a medical chief complaint for a doctor.",
            "med_reference": "This is a medical reference checklist for discussion with a doctor.",
            "selfCare": "These are self-care suggestions for pain relief.",
            "selfcare": "These are self-care suggestions for pain relief.",
        }
    else:
        system_prompt = "你是一个专业的医疗内容编辑。根据用户的反馈重写以下文字，保持原意但调整风格/语气。只输出优化后的文字，不要解释。语言必须是简体中文。"
        
        lang_instruction = "重要：你的回复必须使用简体中文。"
        
        # 字段上下文（中文）
        field_contexts = {
            "analogy": "这是给伴侣看的痛觉通感描述",
            "action": "这是给伴侣列出的实际照护行动清单",
            "work": "这是给领导/HR看的请假申请",
            "workText": "这是给领导/HR看的请假申请",
            "med_complaint": "这是给医生看的临床主诉",
            "med_reference": "这是供与医生讨论的参考清单",
            "selfCare": "这是给患者自己的自愈建议",
            "selfcare": "这是给患者自己的自愈建议",
        }
    
    field_context = field_contexts.get(field, "general content")
    
    user_prompt = f"""Context: {field_context}
Original text: {current_text}
User feedback: {user_feedback}

{lang_instruction}
Please output only the refined text:"""

    try:
        print(f"🤖 正在优化内容... (字段: {field}, 语言: {target_lang})")
        completion = client.chat.completions.create(
            model="qwen-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        
        refined = completion.choices[0].message.content.strip()
        return {"refined": refined}
        
    except Exception as e:
        print(f"🚨 优化错误: {e}")
        return {"refined": current_text}


@app.get("/")
def read_root():
    return {"Message": "PainScape Backend (Powered by Qwen AI) is Running!"}