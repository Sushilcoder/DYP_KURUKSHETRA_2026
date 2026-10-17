from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field

Language = Literal["python", "java"]

class GenerateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=240)
    student_level: Literal["beginner", "intermediate", "advanced"] = "beginner"
    duration_minutes: int = Field(default=60, ge=15, le=480)
    source_text: str | None = Field(default=None, max_length=30000)
    programming_language: Language = "java"
    framework: str = Field(default="Spring Boot", max_length=100)
    framework_version: str = Field(default="3.x (must be pinned before release)", max_length=100)
    brand_name: str = Field(default="TechSummitTrainers", max_length=100)
    brand_primary_color: str = Field(default="#1D4ED8", pattern=r"^#[0-9A-Fa-f]{6}$")

class CodeBlock(BaseModel):
    title: str = "Example"
    language: str = "text"
    code: str

class Slide(BaseModel):
    title: str
    bullets: list[str] = Field(default_factory=list)
    code_blocks: list[CodeBlock] = Field(default_factory=list)
    diagram_mermaid: str | None = None
    notes: str = ""

class Exercise(BaseModel):
    title: str
    prompt: str
    language: Language = "python"
    reference_solution: str
    naive_solution: str
    tests: str
    test_main_class: str | None = None

class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0)
    explanation: str

class CourseContent(BaseModel):
    title: str
    summary: str
    learning_objectives: list[str] = Field(default_factory=list)
    slides: list[Slide] = Field(min_length=1, max_length=40)
    exercises: list[Exercise] = Field(default_factory=list)
    quiz: list[QuizQuestion] = Field(default_factory=list)
    cheat_sheet: list[str] = Field(default_factory=list)

class ExecuteRequest(BaseModel):
    snippet_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    language: Language
    code: str = Field(min_length=1, max_length=50000)
    tests_code: str | None = Field(default=None, max_length=50000)
    test_main_class: str | None = Field(default=None, pattern=r"^[A-Za-z_][A-Za-z0-9_]{0,80}$")
    timeout_seconds: int = Field(default=10, ge=1, le=30)

class RegenerateSlideRequest(BaseModel):
    trainer_instruction: str = Field(min_length=3, max_length=4000)
