import os

from dotenv import load_dotenv
from openai import OpenAI


load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")

if not api_key:
    raise RuntimeError(
        "OPENROUTER_API_KEY no está configurada"
    )


client = OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
)


response = client.chat.completions.create(
    model="openai/gpt-5",
    messages=[
        {
            "role": "user",
            "content": "Di solamente: CONEXION OPENROUTER OK"
        }
    ],
)


print(response.choices[0].message.content)
