"""routers/assistant.py — AI Data Assistant endpoints."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.ai_data_assistant import ask, get_suggestions, get_capabilities

router = APIRouter(prefix="/assistant", tags=["AI Data Assistant"])


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500, description="Natural language question about PulseNova data")


@router.post("/ask", summary="Ask a question about PulseNova datasets and models")
def ask_question(request: QuestionRequest):
    """
    Deterministic question-answering assistant.
    Maps questions to approved analytics operations.
    No LLM required. All answers come from real dataset computations.
    """
    return ask(request.question)


@router.get("/suggestions", summary="Suggested questions the assistant can answer")
def suggestions():
    return {"suggestions": get_suggestions()}


@router.get("/capabilities", summary="Supported question categories and dataset/model status")
def capabilities():
    return get_capabilities()
