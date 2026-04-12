from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# 1. 加载 .env 文件中的环境变量
load_dotenv()

# 从环境变量中安全获取 API Key
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
if not DASHSCOPE_API_KEY:
    raise ValueError("🚨 未找到 DASHSCOPE_API_KEY，请检查 .env 文件！")

# 2. 初始化 OpenAI 客户端，但把 base_url 指向阿里云百炼的通义千问服务！
client = OpenAI(
    api_key=DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)

app = FastAPI()

# 3. 配置 CORS，允许你的 React 前端 (比如 localhost:5137) 访问后端
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 4. 定义前端传过来的数据模型
class PainData(BaseModel):
    dominantPain: str
    userPref: str
    painScore: int


# 5. 核心接口：调用通义千问生成医疗主诉与行动指令
@app.post("/api/generate")
async def generate_pain_report(data: PainData):
    print(f"📥 收到前端数据：痛觉类型={data.dominantPain}, 沟通偏好={data.userPref}")

    # 将前端的英文代码转为中文，方便大模型理解
    pain_map = {"twist": "严重绞痛", "pierce": "针刺/钻痛", "heavy": "重压下坠感", "wave": "弥漫性胀痛",
                "scrape": "刀刮撕裂痛"}
    pain_ch = pain_map.get(data.dominantPain, "不明阵痛")

    # 构建高阶 Prompt Engineering (系统提示词)
    system_prompt = """
    你是一个专业的女性健康共情转译专家兼医疗助理。
    请根据患者提供的【痛觉类型】和【社交偏好】，生成一段【医疗主诉报告】和一段给伴侣的【实操照顾指令】。

    要求：
    1. 医疗主诉必须专业、客观，包含痛觉性质和可能的排查方向，字数在60字左右。
    2. 伴侣实操指令必须极度务实、不带有任何情感鸡汤，直接给出1-3条动作建议（如：独处、揉腰、备药等），字数在80字左右。
    3. 必须以严格的 JSON 格式输出，只能包含 "med" 和 "action" 两个键，不要输出任何额外的 Markdown 标记（如 ```json）。
    """

    user_prompt = f"患者当前的生理状态是：{pain_ch}。她的照顾偏好包含：{data.userPref}（注：alone代表需要绝对独处，care代表需要物理照顾，comfort代表需要情绪陪伴）。请生成报告。"

    try:
        print("🤖 正在请求通义千问大模型...")
        # 调用大模型 (使用 qwen-plus 模型，性价比极高且能力强)
        completion = client.chat.completions.create(
            model="qwen-plus",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,  # 适中的发散度
            response_format={"type": "json_object"}  # 强制大模型以 JSON 对象返回！
        )

        # 提取大模型的回复文本
        llm_reply_text = completion.choices[0].message.content
        print(f"✅ 大模型原始回复:\n{llm_reply_text}")

        # 解析返回的 JSON 字符串
        llm_json = json.loads(llm_reply_text)

        # 返回给前端
        return {
            "status": "success",
            "med": llm_json.get("med", "大模型未生成医疗建议"),
            "action": llm_json.get("action", "大模型未生成行动指令")
        }

    except Exception as e:
        print(f"❌ 大模型请求出错: {e}")
        # 【极其重要】：如果在答辩现场网络断了或者 API 欠费，触发 Fallback 降级预案，返回兜底文本，保证前端不崩溃！
        return {
            "status": "error",
            "med": f"系统离线模式主诉：患者出现强烈的{pain_ch}，建议结合临床检查排查器质性病变。",
            "action": f"系统离线模式指令：请根据患者 {data.userPref} 的意愿，提供布洛芬或热水袋，并给予足够的空间。"
        }


@app.get("/")
def read_root():
    return {"Message": "PainScape Backend (Powered by Qwen AI) is Running!"}