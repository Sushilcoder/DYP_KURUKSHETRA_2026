from __future__ import annotations
import json, os, re, shutil, traceback, uuid
from datetime import datetime, timezone
from pathlib import Path
from . import db
from .generator import generate_course, repair_code_snippet, rewrite_slide
from .models import GenerateRequest, CourseContent
from .extraction import extract_snippets
from .verification import verify_course
from .packager import build_artifacts, refresh_report_and_zip
from .render_client import render_course
from .scoring import ConfidenceMetrics, calculate_confidence

STORAGE_ROOT=Path(os.getenv("STORAGE_ROOT","./storage/materials")).resolve()
STORAGE_ROOT.mkdir(parents=True,exist_ok=True)

def _utc(): return datetime.now(timezone.utc).isoformat()

def _apply_code_repair(course: CourseContent, snippet: dict, fixed_code: str) -> bool:
    old_code=snippet.get("code","")
    if not old_code or not fixed_code.strip() or fixed_code.strip()==old_code.strip(): return False
    for source in snippet.get("source_locations",[]):
        location=source.get("location")
        slide_id=source.get("slide_id","")
        if slide_id.startswith("SLIDE-"):
            try: slide_idx=int(slide_id.split("-")[-1])-1
            except ValueError: continue
            if 0<=slide_idx<len(course.slides):
                slide=course.slides[slide_idx]
                if location=="slide.code_blocks":
                    for block in slide.code_blocks:
                        if block.code==old_code:
                            block.code=fixed_code
                            return True
                if location=="speaker_notes":
                    import re
                    pattern=re.compile(r"(```[^\n]*\n)(.*?)(```)" ,re.DOTALL)
                    for match in pattern.finditer(slide.notes or ""):
                        if match.group(2)==old_code:
                            slide.notes=slide.notes[:match.start(2)]+fixed_code+slide.notes[match.end(2):]
                            return True
        exercise_id=source.get("exercise_id","")
        if exercise_id.startswith("EX-"):
            try: exercise_idx=int(exercise_id.split("-")[-1])-1
            except ValueError: continue
            if 0<=exercise_idx<len(course.exercises):
                exercise=course.exercises[exercise_idx]
                if source.get("location")=="reference_solution" and exercise.reference_solution==old_code:
                    exercise.reference_solution=fixed_code; return True
    return False


def _repair_until_stable(course: CourseContent, snippets: list[dict], request_payload: dict, report: dict) -> tuple[list[dict],dict]:
    max_attempts=max(0,min(3,int(os.getenv("MAX_REPAIR_ATTEMPTS","2"))))
    history: dict[str,list[dict]]={}
    if not os.getenv("OPENAI_API_KEY") or max_attempts==0:
        report["repair_attempts"]=[]
        return snippets,report
    req=GenerateRequest.model_validate({k:v for k,v in request_payload.items() if k!="material_id"})
    material_id=request_payload.get("material_id")
    for attempt in range(1,max_attempts+1):
        changed=0
        failed=[s for s in snippets if s.get("status")=="FAILED" and s.get("exercise_role") not in {"naive_solution","tests"}]
        if not failed: break
        for snippet in failed:
            error=(snippet.get("execution",{}).get("stderr","")+"\n"+snippet.get("execution",{}).get("stdout",""))[-8000:]
            fixed=repair_code_snippet(snippet.get("code",""),snippet.get("language",""),error,snippet.get("title","Snippet"),req.framework,req.framework_version)
            applied=bool(fixed and _apply_code_repair(course,snippet,fixed))
            history.setdefault(snippet["snippet_id"],[]).append({"attempt":attempt,"repair_requested":True,"repair_applied":applied,"previous_status":snippet.get("status"),"error_excerpt":error[:1500]})
            if applied: changed+=1
        if changed==0:
            # If code is clean but a specific slide fails rendered-layout checks, regenerate only that slide.
            layout_issues=(report.get("presentation",{}) or {}).get("issues",[])
            affected=sorted({issue.get("slide_id") for issue in layout_issues if issue.get("slide_id") and str(issue.get("slide_id")).startswith("SLIDE-")})
            for target_id in affected:
                try: target_idx=int(target_id.split("-")[-1])-1
                except ValueError: continue
                if target_idx<0 or target_idx>=len(course.slides): continue
                issue_text="; ".join(str(issue.get("issue","layout issue")) for issue in layout_issues if issue.get("slide_id")==target_id)
                replacement=rewrite_slide(course,target_idx,f"Fix the rendered layout verification issue: {issue_text}. Make all text fit, keep displayed code lines at or below 52 characters, use a complete runnable code block of at most 12 lines, and preserve the lesson objective.",req)
                applied=replacement is not None
                history.setdefault(target_id,[]).append({"attempt":attempt,"repair_requested":True,"repair_applied":applied,"previous_status":"LAYOUT_FAILED","error_excerpt":issue_text[:1500]})
                if applied:
                    course.slides[target_idx]=replacement
                    changed+=1
        if changed==0: break
        # Rebuild the updated slide deck and rendered PDF before re-running all affected snippets.
        snippets=extract_snippets(course)
        build_artifacts(STORAGE_ROOT,material_id,course,snippets,report,request_payload,req.brand_name,req.brand_primary_color)
        render_info=render_course(material_id)
        report=verify_course(course,snippets,{**request_payload,"material_id":material_id},render_info)
    for snip in snippets:
        if snip["snippet_id"] in history: snip["repair_history"]=history[snip["snippet_id"]]
    report["repair_attempts"]=[{"snippet_id":sid,"attempts":entries} for sid,entries in history.items()]
    if history and any(not entry.get("repair_applied") for entries in history.values() for entry in entries):
        report.setdefault("warnings",[]).append("One or more code repair attempts could not be applied; inspect the preserved execution log.")
    return snippets,report


def _apply_final_render(report: dict, render_info: dict) -> None:
    metrics=dict(report.get("confidence",{}).get("metrics",{}))
    render_ok=bool(render_info and render_info.get("status")=="PASS" and render_info.get("slide_count",0)>0 and render_info.get("slide_count")==render_info.get("pdf_page_count"))
    metrics["layout_export_integrity"]=1.0 if render_ok else 0.0
    # Re-evaluate all hard gates from measurable checks and final render results.
    summary=report.get("summary",{})
    total=int(summary.get("execution_checks",0) or 0)
    passed=int(summary.get("snippets_passed",0) or 0)
    expected=int(summary.get("expected_naive_failures",0) or 0)
    failed=int(summary.get("snippets_failed",0) or 0)
    blocked=int(summary.get("snippets_blocked",0) or 0)
    non_layout_gates=(metrics.get("extraction_completeness",0)==1.0 and total>0 and passed+expected==total and failed==0 and blocked==0 and metrics.get("execution_success",0)==1.0 and metrics.get("exercise_test_integrity",0)==1.0 and metrics.get("version_reproducibility",0)==1.0)
    mandatory=bool(non_layout_gates and render_ok)
    confidence=calculate_confidence(ConfidenceMetrics(**metrics),mandatory)
    report["confidence"]=confidence
    report["presentation"]=render_info or {"status":"BLOCKED","message":"No rendered layout report was available."}
    report.setdefault("summary",{})["pdf_export"]="PASS" if render_ok else "NOT_VERIFIED"
    report["summary"]["layout_overflow_count"]=len(render_info.get("issues",[])) if render_ok else None
    if not render_ok:
        report.setdefault("warnings",[]).append("Final rendered layout verification did not pass; package is not marked VERIFIED.")
    if mandatory and confidence["band"]=="HIGH":
        report["status"]="VERIFIED"
    elif mandatory and confidence["band"]=="MEDIUM":
        report["status"]="NEEDS_REVIEW"
    else:
        report["status"]="BLOCKED"


def run_generation(material_id: str, request_payload: dict) -> None:
    rec=db.get_record(material_id) or {"id":material_id}
    rec.update({"id":material_id,"status":"GENERATING","progress":5,"created_at":rec.get("created_at",_utc()),"request":request_payload})
    db.save_record(material_id,"GENERATING",rec)
    try:
        req=GenerateRequest.model_validate(request_payload)
        course,generation_mode=generate_course(req)
        snippets=extract_snippets(course)
        rec.update({"status":"VERIFYING","progress":35,"title":course.title,"generation_mode":generation_mode,"course":course.model_dump(),"snippets":snippets})
        db.save_record(material_id,"VERIFYING",rec)
        # Build a first deck so the renderer can inspect the actual PowerPoint output.
        draft_report={"status":"VERIFYING","confidence":{},"summary":{},"snippets":[]}
        build_artifacts(STORAGE_ROOT,material_id,course,snippets,draft_report,request_payload,req.brand_name,req.brand_primary_color)
        render_info=render_course(material_id)
        report=verify_course(course,snippets,{**request_payload,"material_id":material_id},render_info)
        snippets,report=_repair_until_stable(course,snippets,{**request_payload,"material_id":material_id},report)
        report["generation_mode"]=generation_mode
        # Build final artefacts with result statuses, then render the exact final PPTX to PDF.
        build_artifacts(STORAGE_ROOT,material_id,course,snippets,report,request_payload,req.brand_name,req.brand_primary_color)
        final_render=render_course(material_id)
        _apply_final_render(report,final_render)
        refresh_report_and_zip(STORAGE_ROOT,material_id,report)
        final_status=report["status"]
        result={"id":material_id,"status":final_status,"progress":100,"created_at":rec["created_at"],"updated_at":_utc(),"title":course.title,"generation_mode":generation_mode,"request":request_payload,"course":course.model_dump(),"snippets":snippets,"verification_report":report,"confidence":report["confidence"],"summary":report["summary"],"download_url":f"/api/v1/materials/{material_id}/download?format=zip","pptx_url":f"/api/v1/materials/{material_id}/export?format=pptx","pdf_url":f"/api/v1/materials/{material_id}/export?format=pdf","report_url":f"/api/v1/materials/{material_id}/verification-report"}
        db.save_record(material_id,final_status,result)
    except Exception as exc:
        rec.update({"status":"FAILED","progress":100,"error":f"{type(exc).__name__}: {exc}","traceback":traceback.format_exc(limit=4),"updated_at":_utc()})
        db.save_record(material_id,"FAILED",rec)

def regenerate_slide(material_id: str, slide_id: str, instruction: str) -> dict:
    record=db.get_record(material_id)
    if not record or not record.get("course"):
        raise ValueError("Material is not ready for slide regeneration")
    course=CourseContent.model_validate(record["course"])
    index=int(slide_id.split("-")[-1])-1
    if index<0 or index>=len(course.slides): raise ValueError("Unknown slide ID")
    slide=course.slides[index]
    req=GenerateRequest.model_validate(record.get("request",{}))
    rewritten=rewrite_slide(course,index,instruction,req)
    ai_rewritten=rewritten is not None
    if ai_rewritten:
        course.slides[index]=rewritten
    else:
        # Demo-mode behavior remains transparent: mark the instruction in notes instead of pretending an AI rewrite occurred.
        slide.notes=(slide.notes.strip()+"\n\nTrainer regeneration instruction (demo mode; content not rewritten): "+instruction).strip()
    updated_payload=record.get("request",{})
    updated_payload["source_text"]=(updated_payload.get("source_text") or "")+f"\nSlide regeneration: {slide.title}. Instruction: {instruction}"
    record.update({"status":"VERIFYING","progress":35,"course":course.model_dump(),"last_regenerated_slide":slide_id})
    db.save_record(material_id,"VERIFYING",record)
    # Re-extract all snippets and re-verify. Unchanged slides remain byte-for-byte equivalent in course JSON.
    req=GenerateRequest.model_validate({k:v for k,v in updated_payload.items() if k!="material_id"})
    snippets=extract_snippets(course)
    build_artifacts(STORAGE_ROOT,material_id,course,snippets,{"status":"VERIFYING","confidence":{},"summary":{},"snippets":[]},updated_payload,req.brand_name,req.brand_primary_color)
    draft_render=render_course(material_id)
    report=verify_course(course,snippets,{**updated_payload,"material_id":material_id},draft_render)
    snippets,report=_repair_until_stable(course,snippets,{**updated_payload,"material_id":material_id},report)
    report["regeneration"]={"slide_id":slide_id,"instruction":instruction,"ai_rewritten":ai_rewritten,"scope":"Only the targeted slide object is changed. All slide code and notes are re-extracted and re-verified." if ai_rewritten else "Demo mode: regeneration instruction was annotated in notes; slide content was not rewritten because no AI API key is configured."}
    build_artifacts(STORAGE_ROOT,material_id,course,snippets,report,updated_payload,req.brand_name,req.brand_primary_color)
    final_render=render_course(material_id)
    _apply_final_render(report,final_render)
    refresh_report_and_zip(STORAGE_ROOT,material_id,report)
    record.update({"status":report["status"],"progress":100,"course":course.model_dump(),"snippets":snippets,"verification_report":report,"confidence":report["confidence"],"download_url":f"/api/v1/materials/{material_id}/download?format=zip","updated_at":_utc()})
    db.save_record(material_id,record["status"],record)
    return record
