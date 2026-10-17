from app.generator import _demo_content
from app.models import GenerateRequest


def test_demo_content_has_notes_slides_exercise_quiz_and_cheat_sheet():
    req = GenerateRequest(topic="Python functions", programming_language="python")
    course = _demo_content(req)
    assert len(course.slides) >= 5
    assert all(slide.notes.strip() for slide in course.slides)
    assert len(course.exercises) >= 1
    assert len(course.quiz) >= 3
    assert len(course.cheat_sheet) >= 1
