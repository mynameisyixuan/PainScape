from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# 加载环境变量
load_dotenv()
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
if not DASHSCOPE_API_KEY:
    raise ValueError("🚨 未找到 DASHSCOPE_API_KEY，请检查 .env 文件！")

# 初始化 OpenAI 客户端
client = OpenAI(
    api_key=DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

app = FastAPI()

# 配置 CORS
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


@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    print(f"📥 收到前端数据：痛觉类型={data.dominantPain}, 沟通偏好={data.userPref}")

    pain_map = {
        "twist": "严重绞痛",
        "pierce": "针刺/钻痛",
        "heavy": "重压下坠感",
        "wave": "弥漫性胀痛",
        "scrape": "刀刮撕裂痛",
    }
    pain_ch = pain_map.get(data.dominantPain, "不明阵痛")

    system_prompt = """
    你是一个专业的妇产科医疗助理兼共情转译专家。
    请基于前端传来的 JSON 数据（包含空间分布、涂抹强度、颜色、病史）进行深度解析。

    输出必须严格遵守以下 JSON 格式，不要有任何多余的 Markdown 标记：
    {
      "med_profile": "【疼痛画像】用50字概括：根据空间分布(spatialMap)、颜色和涂抹强度，客观描述患者的疼痛表现（如：患者呈现弥散性分布的深红色重压痛，高强度涂抹反映其生理处于高度烦躁状态）。",
      "med_complaint": "【临床主诉】用40字概括：将画笔类型转译为医学术语（如：下腹部持续性绞痛/阵发性锐痛/弥散性胀痛）。",
      "med_reference": "【诊疗参考清单】用80字列举：必须结合 medicalBackground 里的既往诊断和过敏史！给出 1-2 条具体的检查建议（如盆腔超声、激素六项）和药物交互风险提示（如果对布洛芬过敏，必须明确标注禁用 NSAIDs 类，建议使用对乙酰氨基酚）。请分点列出，使用 bullet points。",
      "action": "结合 userPref 偏好，给出 2 条极其冷酷、务实的伴侣实操动作指令。严禁空洞安慰。每条指令一行且带 ☑️。"
    }

    逻辑约束：
    1. 严禁对过敏药物提供建议！
    2. 如果 spatialMap 中 lowerBack(后腰) 占比高，请在主诉中明确‘伴随腰骶部放射痛’。
    """

    # 构建病史信息
    medical_info = ""
    if data.medicalBackground:
        diagnosed = data.medicalBackground.get("diagnosed", "")
        allergies = data.medicalBackground.get("allergies", "无")
        pain_data_info = f"行为数据：平均速度{data.intensityProfile.get('avgSpeed')}（反映痛感强度），最高占比区域{data.spatialMap}。"
        if diagnosed and diagnosed != "none":
            diagnosis_map = {
                "endometriosis": "子宫内膜异位症",
                "adenomyosis": "子宫腺肌症",
                "pcos": "多囊卵巢综合征",
                "unchecked": "未做过相关检查",
            }
            medical_info += f"既往诊断：{diagnosis_map.get(diagnosed, diagnosed)}。"
        if allergies and allergies != "none" and allergies != "unknown":
            allergy_map = {
                "aspirin": "阿司匹林过敏",
                "ibuprofen": "布洛芬过敏",
                "nsaids": "多种NSAIDs过敏",
            }
            medical_info += f"药物过敏：{allergy_map.get(allergies, allergies)}。"

    # 构建画笔行为数据
    pain_data_info = f"痛觉类型：{pain_ch}。"
    if data.brushCounts:
        brush_desc = ", ".join(
            [f"{k}画笔调用{v}次" for k, v in data.brushCounts.items() if v > 0]
        )
        pain_data_info += f"画笔使用情况：{brush_desc}。"
    if data.spatialMap:
        spatial_desc = ", ".join(
            [f"{k}区域占比{v*100:.0f}%" for k, v in data.spatialMap.items() if v > 0]
        )
        pain_data_info += f"疼痛空间分布：{spatial_desc}。"
    if data.intensityProfile:
        avg_speed = data.intensityProfile.get("avgSpeed", 0)
        pain_data_info += f"涂抹强度：{'剧烈' if avg_speed > 1.0 else '中等' if avg_speed > 0.5 else '轻微'}。"
    if data.colorPalette:
        color_map = {
            "crimson": "猩红色（锐痛偏好）",
            "dark": "暗灰色（钝痛偏好）",
            "purple": "紫色（神经痛偏好）",
            "blue": "蓝色（冷痛偏好）",
        }
        pain_data_info += f"颜色选择：{color_map.get(data.colorPalette, data.colorPalette)}。"
    if data.bodyMode:
        body_desc = "正面为主" if data.bodyMode == "front" else "背面为主"
        pain_data_info += f"疼痛位置：{body_desc}。"

    user_prompt = f"""【原始数据】
疼痛画像：{pain_data_info}
分布模式：{data.bodyMode}
颜色性质：{data.colorPalette}
【病史】
既往诊断：{data.medicalBackground.get('diagnosis')}
药物过敏史：{allergies} (！！！重要：严禁建议过敏药物)
照顾偏好：{data.userPref}

请生成内容。注意：如果强度高，请假声明中要体现'体力透支'。"""

    try:
        print("🤖 正在请求通义千问大模型...")
        completion = client.chat.completions.create(
            model="qwen-plus",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )

        llm_reply_text = completion.choices[0].message.content
        print(f"✅ 大模型原始回复:\n{llm_reply_text}")

        llm_json = json.loads(llm_reply_text)

        return {
            "status": "success",
            "med": llm_json.get("med", "大模型未生成医疗建议"),
            "action": llm_json.get("action", "大模型未生成行动指令"),
        }

    except Exception as e:
        print(f"❌ 大模型请求出错: {e}")
        return {
            "status": "error",
            "med": f"系统离线模式主诉：患者出现强烈的{pain_ch}，建议结合临床检查排查器质性病变。",
            "action": f"系统离线模式指令：请根据患者 {data.userPref} 的意愿，提供布洛芬或热水袋，并给予足够的空间。",
        }


@app.get("/")
def read_root():
    return {"Message": "PainScape Backend (Powered by Qwen AI) is Running!"}