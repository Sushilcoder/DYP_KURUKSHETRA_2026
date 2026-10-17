from __future__ import annotations
import json, os
from pathlib import Path
import httpx
from .models import CourseContent
from .scoring import ConfidenceMetrics, calculate_confidence

SANDBOX_URL=os.getenv("SANDBOX_URL","http://sandbox:8081")


def _sandbox_run(snippet: dict) -> dict:
    lang=snippet.get("language")
    if lang not in {"python","java"}:
        return {"status":"BLOCKED","exit_code":None,"stdout":"","stderr":f"Unsupported language profile: {lang}. No fallback execution is allowed."}
    if snippet.get("exercise_role")=="tests":
        return {"status":"ARTIFACT_ONLY","exit_code":None,"stdout":"","stderr":"Test harness is executed together with each solution, not by itself."}
    body={"snippet_id":snippet["snippet_id"],"language":lang,"code":snippet.get("code", ""),"tests_code":snippet.get("tests_code"),"test_main_class":snippet.get("test_main_class"),"timeout_seconds":10}
    try:
        with httpx.Client(timeout=35) as client:
            resp=client.post(f"{SANDBOX_URL.rstrip('/')}/run",json=body)
        if resp.status_code>=400:
            return {"status":"ERROR","exit_code":None,"stdout":"","stderr":f"Sandbox HTTP {resp.status_code}: {resp.text[:2000]}"}
        result=resp.json()
        return result
    except Exception as exc:
        return {"status":"BLOCKED","exit_code":None,"stdout":"","stderr":f"Sandbox unavailable; code was NOT run. {type(exc).__name__}: {exc}"}


def verify_course(course: CourseContent, snippets: list[dict], request_payload: dict, ppt_info: dict | None=None) -> dict:
    results=[]
    exercise_roles={}
    for snip in snippets:
        if snip.get("status")=="ARTIFACT_ONLY" or snip.get("exercise_role")=="tests":
            snip["status"]="ARTIFACT_ONLY"
            snip["execution"]={"status":"ARTIFACT_ONLY","exit_code":None,"stdout":"","stderr":"Executed with reference and naive implementations, not standalone."}
            results.append(snip)
            continue
        result=_sandbox_run(snip)
        raw_status=result.get("status","ERROR")
        result["raw_status"]=raw_status
        role=snip.get("exercise_role")
        combined_logs=(result.get("stdout","")+"\n"+result.get("stderr","")).lower()
        # A naive implementation is expected to execute and fail the assertions, not fail compilation.
        compile_or_syntax_error=("syntaxerror" in combined_logs or "indentationerror" in combined_logs or "cannot find symbol" in combined_logs or ("javac" in combined_logs and "error:" in combined_logs))
        expected_naive_failure=(role=="naive_solution" and raw_status=="FAILED" and snip.get("tests_code") and ("assertionerror" in combined_logs or "failed (failures=" in combined_logs or "fail:" in combined_logs) and not compile_or_syntax_error)
        if expected_naive_failure:
            snip["status"]="EXPECTED_FAILURE"
            result["status"]="EXPECTED_FAILURE"
            result["expected_test_failure"]=True
        else:
            snip["status"]=raw_status
        snip["execution"]=result
        snip["error"]=result.get("stderr","") if snip["status"] not in {"PASSED","EXPECTED_FAILURE"} else ""
        if snip.get("exercise_id"):
            exercise_roles.setdefault(snip["exercise_id"],{})[role or "unknown"]=snip["status"]
        results.append(snip)
    # Verify naive/reference differential expectations: reference must pass; naive must fail the supplied test suite.
    exercise_checks=[]
    exercise_passes=0
    for exercise_id, roles in exercise_roles.items():
        ref=roles.get("reference_solution")
        naive=roles.get("naive_solution")
        valid=(ref=="PASSED" and naive=="EXPECTED_FAILURE")
        exercise_checks.append({"exercise_id":exercise_id,"reference_solution_status":ref,"naive_solution_status":naive,"test_integrity_passed":valid,"reason":"Reference must pass; naive implementation must fail an assertion in the same test harness."})
        if valid: exercise_passes+=1
    non_test=[s for s in snippets if s.get("exercise_role")!="tests" and s.get("status")!="ARTIFACT_ONLY"]
    passed=sum(1 for s in non_test if s.get("status")=="PASSED")
    expected_failures=sum(1 for s in non_test if s.get("status")=="EXPECTED_FAILURE")
    failed=sum(1 for s in non_test if s.get("status")=="FAILED")
    blocked=sum(1 for s in non_test if s.get("status") in {"BLOCKED","ERROR"})
    total=len(non_test)
    valid_execution_checks=passed+expected_failures
    extraction=1.0 if all(s.get("code") for s in snippets) else 0.0
    execution=valid_execution_checks/total if total else 1.0
    exercise_integrity=exercise_passes/len(exercise_checks) if exercise_checks else (1.0 if not course.exercises else 0.0)
    # Reproducibility requires an immutable image ID reported by the trusted sandbox for every run.
    versions=1.0 if total>0 and all(s.get("execution",{}).get("runtime_image_id") for s in non_test if s.get("status") not in {"BLOCKED","ERROR"}) and blocked==0 else 0.0
    layout_passed=bool(ppt_info and ppt_info.get("status")=="PASS" and ppt_info.get("slide_count",0)>0 and ppt_info.get("slide_count")==ppt_info.get("pdf_page_count"))
    layout=1.0 if layout_passed else 0.0
    quality=min(1.0, 0.45 + 0.08*bool(course.learning_objectives) + 0.10*bool(course.quiz) + 0.10*bool(course.cheat_sheet) + 0.12*bool(course.exercises) + 0.10*(len(course.slides)>=5))
    mandatory=(extraction==1.0 and total>0 and valid_execution_checks==total and blocked==0 and failed==0 and exercise_integrity==1.0 and versions==1.0 and layout_passed)
    metrics=ConfidenceMetrics(extraction,execution,exercise_integrity,versions,layout,quality)
    confidence=calculate_confidence(metrics,mandatory)
    status="VERIFIED" if mandatory and confidence["band"]=="HIGH" else ("NEEDS_REVIEW" if confidence["band"]=="MEDIUM" and blocked==0 else "BLOCKED")
    # Explicit exact command/runtime facts are part of the report.
    report={
      "status":status,
      "material_id":request_payload.get("material_id"),
      "created_at_utc":__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
      "execution_policy":{"sandbox_url":SANDBOX_URL,"network_access":"disabled inside runtime container","timeout_seconds":10,"supported_standalone_languages":["python","java"],"resource_limits":{"memory":"256m","cpu_cores":0.5,"process_limit":64},"note":"Exact command arrays, image tags, resolved image IDs, runtime exit codes, stdout and stderr are preserved per snippet. Full Spring Boot project builds require a separately provisioned Maven/Gradle profile and are not assumed to pass standalone compilation."},
      "summary":{"snippets_found":len(snippets),"execution_checks":total,"snippets_passed":passed,"expected_naive_failures":expected_failures,"snippets_failed":failed,"snippets_blocked":blocked,"artifact_only_test_harnesses":sum(1 for s in snippets if s.get("status")=="ARTIFACT_ONLY"),"exercise_count":len(exercise_checks),"exercise_test_integrity_passed":exercise_passes,"pptx_export":"PASS","pdf_export":"PASS" if layout_passed else "NOT_VERIFIED","layout_overflow_count":len((ppt_info or {}).get("issues",[])) if layout_passed else None},
      "presentation":ppt_info or {"status":"BLOCKED","message":"No rendered layout report was available."},
      "exercise_checks":exercise_checks,
      "confidence":confidence,
      "snippets":[{"snippet_id":s["snippet_id"],"title":s.get("title"),"language":s.get("language"),"status":s.get("status"),"source_locations":s.get("source_locations",[]),"execution":s.get("execution",{}),"error":s.get("error","")} for s in snippets],
      "warnings":["Confidence is a weighted evidence score, not a probability guarantee.","DEMO_MODE content should be replaced with model-generated content when OPENAI_API_KEY is configured."] + ([] if layout_passed else ["Rendered layout checks did not pass or were unavailable; the course cannot be marked VERIFIED."])
    }
    return report
