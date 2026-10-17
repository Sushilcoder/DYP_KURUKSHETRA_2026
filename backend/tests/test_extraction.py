from app.models import CourseContent
from app.extraction import extract_snippets


def test_extracts_slide_code_notes_code_and_exercise_sources():
    course = CourseContent.model_validate({
        "title": "Sample", "summary": "Sample course",
        "slides": [{"title": "One", "bullets": [], "code_blocks": [{"title": "Main", "language": "python", "code": "print('hello')"}], "notes": "Try this:\n```python\nprint('notes')\n```"}],
        "exercises": [{"title": "Add", "prompt": "Add numbers", "language": "python", "reference_solution": "def add(a,b): return a+b", "naive_solution": "def add(a,b): return a-b", "tests": "import unittest"}],
        "quiz": [], "cheat_sheet": []
    })
    snippets = extract_snippets(course)
    assert len(snippets) == 5
    assert snippets[0]["source_locations"][0]["location"] == "slide.code_blocks"
    assert snippets[1]["source_locations"][0]["location"] == "speaker_notes"
    assert snippets[2]["exercise_role"] == "reference_solution"
    assert snippets[3]["exercise_role"] == "naive_solution"
    assert snippets[4]["status"] == "ARTIFACT_ONLY"
