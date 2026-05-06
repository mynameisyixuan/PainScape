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
    try:
        # 增加安全检查：确保数据存在
        mb = data.medicalBackground or {}
        intensity = data.intensityProfile or {"avgSpeed": 0}
        spatial = data.spatialMap or {}
        
        pain_map = {
            "twist": "严重绞痛", "pierce": "针刺/钻痛", "heavy": "重压下坠感", 
            "wave": "弥漫性胀痛", "scrape": "刀刮撕裂痛"
        }
        pain_ch = pain_map.get(data.dominantPain, "严重痛经")

        # 【核心修正】：统一使用字段名 'diagnosed'
        diagnosed = mb.get("diagnosed", "未提供")
        allergies = mb.get("allergies", "无")
        
        system_prompt = """你是一个专业的疼痛管理顾问。请根据用户提供的疼痛绘图数据和病史生成建议。
        必须以 JSON 格式输出，包含 med_profile, med_complaint, med_reference, action 四个字段。
        严禁建议过敏药物！"""

        user_prompt = f"""
        痛觉类型：{pain_ch}
        涂抹强度：{intensity.get('avgSpeed')}
        既往病史：{diagnosed}
        药物过敏：{allergies}
        社交偏好：{data.userPref}
        """

        print("🤖 正在请求通义千问...")
        completion = client.chat.completions.create(
            model="qwen-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )

        llm_reply = json.loads(completion.choices[0].message.content)
        return {"status": "success", **llm_reply}

    except Exception as e:
        print(f"🚨 后端崩溃详情: {e}")
        # 即使报错也要返回结构化数据，防止前端解析失败
        return {
            "status": "error",
            "med_profile": "AI 诊断系统临时离线",
            "med_complaint": f"患者自述{pain_ch}，建议临床排查。",
            "med_reference": "• 建议复查盆腔超声。",
            "action": "☑️ 遵循患者偏好进行物理护理。"
        }
    
@app.get("/")
def read_root():
    return {"Message": "PainScape Backend (Powered by Qwen AI) is Running!"}