from app.generator import _demo_content
from app.models import GenerateRequest
from app.extraction import extract_snippets
from app import verification


def test_reference_pass_and_naive_assertion_failure_can_verify(monkeypatch):
    course = _demo_content(GenerateRequest(topic="Python functions", programming_language="python"))
    snippets = extract_snippets(course)

    def fake_run(snip):
        base = {"exit_code": 0, "stdout": "", "stderr": "", "runtime_image": "python:3.12.15-slim-bookworm", "runtime_image_id": "sha256:approved-test-image", "command": ["python", "-u", "solution.py"]}
        if snip.get("exercise_role") == "naive_solution":
            return {**base, "status": "FAILED", "exit_code": 1, "stderr": "AssertionError: incorrect sum", "stdout": "FAIL: test_add"}
        return {**base, "status": "PASSED"}

    monkeypatch.setattr(verification, "_sandbox_run", fake_run)
    report = verification.verify_course(course, snippets, {"material_id": "mat_test"}, {"status": "PASS", "slide_count": 6, "pdf_page_count": 6, "issues": []})
    assert report["status"] == "VERIFIED"
    assert report["confidence"]["score"] > 70
    assert report["summary"]["expected_naive_failures"] == 1
    assert report["summary"]["snippets_failed"] == 0
    assert report["exercise_checks"][0]["test_integrity_passed"] is True


def test_render_or_sandbox_failure_blocks_verified_status(monkeypatch):
    course = _demo_content(GenerateRequest(topic="Python functions", programming_language="python"))
    snippets = extract_snippets(course)
    def fake_run(snip):
        return {"status": "BLOCKED", "exit_code": None, "stdout": "", "stderr": "sandbox unreachable"}
    monkeypatch.setattr(verification, "_sandbox_run", fake_run)
    report = verification.verify_course(course, snippets, {"material_id": "mat_test"}, {"status": "BLOCKED", "message": "renderer unavailable"})
    assert report["status"] == "BLOCKED"
    assert report["confidence"]["band"] == "LOW"
    assert report["confidence"]["score"] < 50
    assert report["confidence"]["mandatory_gates_passed"] is False
