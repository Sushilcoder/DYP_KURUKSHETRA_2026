from __future__ import annotations
import re
from .models import CourseContent

FENCE_RE = re.compile(r"```([A-Za-z0-9_+#.-]*)\s*\n(.*?)```", re.DOTALL)


def extract_snippets(course: CourseContent) -> list[dict]:
    snippets: list[dict] = []
    counter = 1
    for sidx, slide in enumerate(course.slides, start=1):
        for block in slide.code_blocks:
            if not block.code.strip():
                continue
            snippets.append({"snippet_id":f"SNIP-{counter:03d}","title":block.title or f"Slide {sidx} code","language":normalize_language(block.language),"code":block.code,"source_locations":[{"slide_id":f"SLIDE-{sidx:02d}","location":"slide.code_blocks"}],"status":"PENDING"})
            counter += 1
        for match in FENCE_RE.finditer(slide.notes or ""):
            lang, code = match.group(1), match.group(2)
            if code.strip():
                snippets.append({"snippet_id":f"SNIP-{counter:03d}","title":f"Slide {sidx} notes code","language":normalize_language(lang),"code":code,"source_locations":[{"slide_id":f"SLIDE-{sidx:02d}","location":"speaker_notes"}],"status":"PENDING"})
                counter += 1
    for eidx, exercise in enumerate(course.exercises, start=1):
        for kind, code in (("reference_solution", exercise.reference_solution), ("naive_solution", exercise.naive_solution)):
            if code.strip():
                snippets.append({"snippet_id":f"SNIP-{counter:03d}","title":f"Exercise {eidx} {kind.replace('_',' ')}","language":exercise.language,"code":code,"source_locations":[{"exercise_id":f"EX-{eidx:02d}","location":kind}],"status":"PENDING","exercise_id":f"EX-{eidx:02d}","exercise_role":kind,"tests_code":exercise.tests,"test_main_class":exercise.test_main_class})
                counter += 1
        # Keep the test harness itself as an artifact and separately verify it with each solution.
        if exercise.tests.strip():
            snippets.append({"snippet_id":f"SNIP-{counter:03d}","title":f"Exercise {eidx} test harness","language":exercise.language,"code":exercise.tests,"source_locations":[{"exercise_id":f"EX-{eidx:02d}","location":"tests"}],"status":"ARTIFACT_ONLY","exercise_id":f"EX-{eidx:02d}","exercise_role":"tests"})
            counter += 1
    return snippets


def normalize_language(value: str) -> str:
    v = (value or "").lower().strip()
    if v in {"py", "python", "python3"}: return "python"
    if v in {"java", "jav", "java21"}: return "java"
    return "unsupported"
