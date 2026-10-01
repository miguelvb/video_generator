import os

from dotenv import load_dotenv
from openai import OpenAI


load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise RuntimeError("OPENAI_API_KEY no está configurada")


client = OpenAI(
    api_key=api_key
)


response = client.responses.create(
    model="gpt-5",
    input="Di solamente: CONEXION OPENAI OK"
)


print(response.output_text)
