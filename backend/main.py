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
你是一个专业的女性健康共情转译专家兼医疗助理。
请根据患者提供的【痛觉类型】、【画笔行为数据】和【病史信息】，生成一段【医疗主诉报告】和一段给伴侣的【实操照顾指令】。

要求：
1. 医疗主诉（med字段）必须按照以下三部分结构组织：
   【临床主诉】：专业、客观地描述痛觉性质和可能的排查方向。1-2句话，简洁直接。
   【供您参考——请与医生讨论】：基于患者提供的病史信息，列出个性化的辅助信息。包括：药物注意（如有过敏史）、检查建议（如有既往诊断）、疼痛性质参考。每条单独一行，以"•"开头。语气为“供您参考”，不构成医疗建议。
   【免责声明】：以“*以上为基于您提供信息的通用参考，不构成医疗建议。具体诊断和治疗方案请咨询执业医师。*”结尾。

2. 伴侣实操指令（action字段）必须极度务实、不带有任何情感鸡汤，直接给出3-5条动作建议（如：独处、揉腰、备药、关灯、热敷等）。如果患者有药物过敏史，不要建议具体药物名称，而是用“止痛药”替代，让用户自己选择已知安全的药物。

3. 必须以严格的 JSON 格式输出，只能包含 "med" 和 "action" 两个键，不要输出任何额外的 Markdown 标记。

示例格式：
{
  "med": "【临床主诉】下腹部持续性绞痛，呈阵发性螺旋状收缩，建议排查子宫痉挛。\n\n【供您参考——请与医生讨论】\n• 药物注意：用户布洛芬过敏，建议使用对乙酰氨基酚作为替代止痛方案。\n• 病史关联：已确诊子宫内膜异位症，本次疼痛可能与内异症病灶周期性出血有关。\n• 疼痛性质参考：绞痛多与平滑肌痉挛有关，热敷下腹部和腰骶部可能有助于缓解。\n\n*以上为基于您提供信息的通用参考，不构成医疗建议。具体诊断和治疗方案请咨询执业医师。*",
  "action": "把手掌搓热，捂在她小腹或后腰上。暖宝宝贴在后腰，热水袋放在脚边。止痛药和温水一起放在床头。包揽今天的家务，让她安心平躺。如果她蜷起来了，帮她掖一下毯子。"
}
"""

    # 构建病史信息
    medical_info = ""
    if data.medicalBackground:
        diagnosed = data.medicalBackground.get("diagnosed", "")
        allergies = data.medicalBackground.get("allergies", "")
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

    user_prompt = f"""{pain_data_info}
{medical_info}
照顾偏好：{data.userPref}（alone=需要独处，care=需要物理照顾，comfort=需要情绪陪伴）。

请按照系统提示中规定的三部分结构生成医疗主诉（med），并生成务实的伴侣实操指令（action）。注意不要建议对患者过敏的药物。请以JSON格式输出。"""

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