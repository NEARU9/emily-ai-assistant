from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import brain

app = FastAPI()

class Turn(BaseModel):
    role: str
    content: str

class ChatReq(BaseModel):
    turns: list[Turn]
    name: str = ""
    style: str = "sweet"

@app.post("/api/chat")
def chat(req: ChatReq):
    turns = [t.model_dump() for t in req.turns]
    return {"text": brain.reply(turns, req.name, req.style)}

app.mount("/", StaticFiles(directory=".", html=True))