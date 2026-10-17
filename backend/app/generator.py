from __future__ import annotations
import json, os
from typing import Any
import httpx
from .models import CourseContent, GenerateRequest

SYSTEM_PROMPT = """You are a careful instructional designer. Return ONLY valid JSON matching this structure:
{
  "title": string, "summary": string, "learning_objectives": [string],
  "slides": [{"title": string, "bullets": [string], "code_blocks": [{"title": string,"language":"python|java|text","code":string}], "diagram_mermaid": string|null, "notes": string}],
  "exercises": [{"title": string,"prompt": string,"language":"python|java","reference_solution": string,"naive_solution": string,"tests": string,"test_main_class": string|null}],
  "quiz": [{"question":string,"options":[string],"correct_index":integer,"explanation":string}],
  "cheat_sheet": [string]
}
Constraints: use the requested language and version. Make code examples self-contained and compile/run-ready where possible. Each runnable slide code block must be a complete, runnable example with at most 12 lines; put larger implementations into exercise/source files rather than truncated slide code. Do not use inline backticks for executable code in slide bullets; place runnable code only in code_blocks or fenced notes. For Java standalone examples, use a public class with a main method and no external dependencies unless a full project is clearly supplied. For Python exercises, tests must be Python unittest tests importing functions from solution.py, and reference/naive functions must implement the same API. For Java exercises, provide a TestMain class in tests that compiles with the reference/naive source and throws AssertionError on failure. Never state that code is verified; execution is handled by an independent sandbox. Generate detailed speaker notes for every slide; any runnable code in notes must be in fenced blocks with language labels. Keep slide text concise, diagrams valid Mermaid when used, include at least 5 slides, 1 exercise and 3 quiz questions. Do not put markdown fences around JSON."""

def _demo_content(req: GenerateRequest) -> CourseContent:
    lang = req.programming_language
    if lang == "python":
        example = 'def greet(name: str) -> str:\n    """Return a greeting for a learner."""\n    return f"Hello, {name}!"\n\nif __name__ == "__main__":\n    print(greet("TechSummitTrainers"))'
        reference = 'def add_numbers(a, b):\n    return a + b'
        naive = 'def add_numbers(a, b):\n    return a - b'
        tests = 'import unittest\nfrom solution import add_numbers\n\nclass TestAddNumbers(unittest.TestCase):\n    def test_positive_numbers(self):\n        self.assertEqual(add_numbers(2, 3), 5)\n    def test_mixed_signs(self):\n        self.assertEqual(add_numbers(-2, 5), 3)\n\nif __name__ == "__main__":\n    unittest.main()'
    else:
        example = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, class!");\n    }\n}'
        reference = 'public class Solution {\n    public static int addNumbers(int a, int b) {\n        return a + b;\n    }\n}'
        naive = 'public class Solution {\n    public static int addNumbers(int a, int b) {\n        return a - b;\n    }\n}'
        tests = 'public class TestMain {\n    public static void main(String[] args) {\n        if (Solution.addNumbers(2, 3) != 5) throw new AssertionError("positive addition");\n        if (Solution.addNumbers(-2, 5) != 3) throw new AssertionError("mixed sign addition");\n        System.out.println("All exercise tests passed");\n    }\n}'
    return CourseContent(
      title=f"{req.topic}: Course Material",
      summary=f"A {req.duration_minutes}-minute {req.student_level} lesson plan for {req.topic}.",
      learning_objectives=[f"Explain the core concepts of {req.topic}", "Run and explain a small code example", "Apply the concept in a tested exercise"],
      slides=[
        {"title":f"Introduction to {req.topic}","bullets":[f"Audience: {req.student_level}",f"Session length: {req.duration_minutes} minutes","Start with the problem this technology solves"],"notes":"Explain why this topic matters, ask learners where they have seen it, and preview the learning outcomes."},
        {"title":"Learning objectives","bullets":["Understand the core vocabulary","Trace the example from input to output","Use a test to validate behavior"],"diagram_mermaid":"flowchart LR\n A[Input] --> B[Processing] --> C[Output] --> D[Tests]","notes":"Walk through the learning path. Ask students to predict the output before revealing it."},
        {"title":"Runnable example","bullets":["Keep the example small enough to explain line by line","The same snippet is saved as a separate source file"],"code_blocks":[{"title":"Hello example","language":lang,"code":example}],"notes":"Run this example in the pinned runtime. Explain the entry point and expected output. The verification engine will independently compile or execute this exact snippet."},
        {"title":"Exercise: add two numbers","bullets":["Implement the required behavior","Run the same test suite against reference and naive solutions","Passing tests alone does not prove every possible behavior"],"code_blocks":[{"title":"Reference function / class","language":lang,"code":reference}],"notes":"Invite learners to predict the results for positive and mixed-sign inputs. Show why a deliberately incorrect implementation should fail the same assertions."},
        {"title":"Verification workflow","bullets":["Extract snippets from slides and notes","Run inside an isolated, resource-limited sandbox","Preserve stdout, stderr, exit code and runtime version","Block the verified label if a mandatory check fails"],"notes":"Clarify that confidence is evidence-based and cannot be forced to 100%. Review the execution report and explain the difference between PASS, FAIL and BLOCKED."},
        {"title":"Recap and knowledge check","bullets":["Explain the concept in your own words","Run the example and inspect the logs","Use the cheat sheet for revision"],"notes":"Use the quiz for a quick formative check. Ask learners what additional edge cases they would add to the tests."}
      ],
      exercises=[{"title":"Add two numbers","prompt":"Implement add_numbers / addNumbers so it returns the arithmetic sum. The test suite checks positive and mixed-sign values.","language":lang,"reference_solution":reference,"naive_solution":naive,"tests":tests,"test_main_class":"TestMain" if lang=="java" else None}],
      quiz=[
        {"question":"Why run generated code in an isolated sandbox?","options":["To execute untrusted code with limited access","To guarantee every possible program is correct","To skip version pinning"],"correct_index":0,"explanation":"Isolation limits the impact of generated or malicious code; it does not prove universal correctness."},
        {"question":"What should happen when a mandatory snippet fails to compile?","options":["Publish it as verified if the score is high","Mark verification blocked and record the error","Delete the logs"],"correct_index":1,"explanation":"A failed mandatory check overrides the weighted score and blocks a verified release."},
        {"question":"What does a naive solution test demonstrate?","options":["That the tests can catch at least one intended defect","That the solution is optimal","That no additional tests are needed"],"correct_index":0,"explanation":"The intentionally wrong solution should fail for the reason the exercise is designed to test."}
      ],
      cheat_sheet=[f"Topic: {req.topic}","Trace: input → processing → output → assertions","Pin runtime and dependency versions","Keep reference and naive solutions separate","Capture exit code, stdout, stderr and test results","A HIGH score is publishable only when all hard gates pass"]
    )

def generate_course(req: GenerateRequest) -> tuple[CourseContent, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _demo_content(req), "DEMO_MODE"
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    payload = {
      "model": model,
      "messages": [
        {"role":"system","content":SYSTEM_PROMPT},
        {"role":"user","content":json.dumps({"topic":req.topic,"student_level":req.student_level,"duration_minutes":req.duration_minutes,"programming_language":req.programming_language,"framework":req.framework,"framework_version":req.framework_version,"brand_name":req.brand_name,"source_text":req.source_text or ""}, ensure_ascii=False)}
      ],
      "response_format": {"type":"json_object"},
      "temperature": 0.2
    }
    with httpx.Client(timeout=90) as client:
        response = client.post(f"{base_url.rstrip('/')}/chat/completions", headers={"Authorization":f"Bearer {api_key}"}, json=payload)
        response.raise_for_status()
        data = response.json()
    content = data["choices"][0]["message"]["content"]
    return CourseContent.model_validate_json(content), "AI_API"


def repair_code_snippet(code: str, language: str, error_output: str, title: str, framework: str = "", framework_version: str = "") -> str | None:
    """Ask the model for one bounded code repair. Returns None when model access is disabled."""
    api_key=os.getenv("OPENAI_API_KEY")
    if not api_key: return None
    model=os.getenv("OPENAI_MODEL","gpt-4.1-mini")
    base_url=os.getenv("OPENAI_BASE_URL","https://api.openai.com/v1")
    prompt={"task":"Repair this generated teaching code using the execution evidence. Return JSON only: {\"code\": \"...\"}.","title":title,"language":language,"framework":framework,"framework_version":framework_version,"source_code":code,"sandbox_error":error_output[-8000:],"requirements":["Fix the actual compilation/runtime/test issue, not the test harness by weakening assertions.","Keep it runnable in the same approved runtime profile.","Do not include Markdown fences.","Preserve educational clarity."]}
    payload={"model":model,"messages":[{"role":"system","content":"You are a code repair assistant. Use the provided compiler/test logs as evidence. Never claim you ran code."},{"role":"user","content":json.dumps(prompt,ensure_ascii=False)}],"response_format":{"type":"json_object"},"temperature":0.1}
    try:
        with httpx.Client(timeout=60) as client:
            response=client.post(f"{base_url.rstrip('/')}/chat/completions",headers={"Authorization":f"Bearer {api_key}"},json=payload)
            response.raise_for_status()
        result=json.loads(response.json()["choices"][0]["message"]["content"])
        fixed=result.get("code")
        return fixed if isinstance(fixed,str) and fixed.strip() else None
    except Exception:
        return None


def rewrite_slide(course: CourseContent, slide_index: int, instruction: str, request: GenerateRequest):
    """Regenerate just one slide through the model; other slide objects are untouched."""
    api_key=os.getenv("OPENAI_API_KEY")
    if not api_key: return None
    model=os.getenv("OPENAI_MODEL","gpt-4.1-mini")
    base_url=os.getenv("OPENAI_BASE_URL","https://api.openai.com/v1")
    target=course.slides[slide_index]
    surrounding=[]
    if slide_index>0: surrounding.append({"position":"previous","title":course.slides[slide_index-1].title,"bullets":course.slides[slide_index-1].bullets})
    if slide_index+1<len(course.slides): surrounding.append({"position":"next","title":course.slides[slide_index+1].title,"bullets":course.slides[slide_index+1].bullets})
    prompt={"target_slide":target.model_dump(),"course_title":course.title,"learning_objectives":course.learning_objectives,"adjacent_slides":surrounding,"trainer_instruction":instruction,"student_level":request.student_level,"runtime_language":request.programming_language,"framework":request.framework,"framework_version":request.framework_version,"brand":request.brand_name,"requirements":["Return JSON for exactly one Slide: title, bullets, code_blocks, diagram_mermaid, notes.","Keep every code block runnable and at most 12 lines for classroom readability; put longer implementations in exercise source files, not slide blocks.","Do not use inline backticks for executable code; place runnable code in code_blocks or fenced notes.","Use a valid Mermaid diagram string or null.","Keep the neighboring slides' progression and do not change their contents.","Do not claim verification; the sandbox will test extracted code."]}
    payload={"model":model,"messages":[{"role":"system","content":"You are an instructional designer regenerating one slide in a larger course. Return valid JSON only."},{"role":"user","content":json.dumps(prompt,ensure_ascii=False)}],"response_format":{"type":"json_object"},"temperature":0.2}
    try:
        with httpx.Client(timeout=75) as client:
            response=client.post(f"{base_url.rstrip('/')}/chat/completions",headers={"Authorization":f"Bearer {api_key}"},json=payload)
            response.raise_for_status()
        from .models import Slide
        raw=json.loads(response.json()["choices"][0]["message"]["content"])
        return Slide.model_validate(raw)
    except Exception:
        return None
