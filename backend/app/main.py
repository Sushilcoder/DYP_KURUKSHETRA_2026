from __future__ import annotations
import asyncio, json, os, re, uuid
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from . import db
from .models import GenerateRequest, RegenerateSlideRequest
from .pipeline import run_generation, regenerate_slide, STORAGE_ROOT, _apply_final_render, _repair_until_stable
from .extraction import extract_snippets
from .models import CourseContent
from .verification import verify_course
from .packager import build_artifacts, refresh_report_and_zip
from .render_client import render_course

app=FastAPI(title="Verified Course Material Studio API",version="0.1.0",description="Generate teaching packs and independently verify code in an isolated sandbox.")
origins=os.getenv("CORS_ORIGINS","http://localhost:3000").split(",")
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,allow_methods=["GET","POST","OPTIONS"],allow_headers=["*"])

@app.on_event("startup")
def startup():
    Path("./storage").mkdir(parents=True,exist_ok=True)
    db.init_db()

@app.get("/health")
def health():
    return {"status":"ok","service":"backend","ai_mode":"AI_API" if os.getenv("OPENAI_API_KEY") else "DEMO_MODE","sandbox_url":os.getenv("SANDBOX_URL","http://sandbox:8081")}

@app.post("/api/v1/materials/generate",status_code=202)
def generate(req: GenerateRequest, background_tasks: BackgroundTasks):
    material_id="mat_"+uuid.uuid4().hex[:12]
    request_payload=req.model_dump()
    initial={"id":material_id,"status":"QUEUED","progress":0,"created_at":__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),"title":req.topic,"request":request_payload}
    db.save_record(material_id,"QUEUED",initial)
    background_tasks.add_task(run_generation,material_id,request_payload)
    return {"job_id":material_id,"material_id":material_id,"status":"QUEUED","progress":0,"poll_url":f"/api/v1/jobs/{material_id}","events_url":f"/api/v1/jobs/{material_id}/events"}

@app.get("/api/v1/jobs/{job_id}")
def get_job(job_id: str):
    rec=db.get_record(job_id)
    if not rec: raise HTTPException(404,"Job not found")
    return {k:v for k,v in rec.items() if k not in {"course","snippets","traceback"}}

@app.get("/api/v1/jobs/{job_id}/events")
async def job_events(job_id: str):
    if not db.get_record(job_id): raise HTTPException(404,"Job not found")
    async def event_stream():
        previous=None
        for _ in range(600):
            rec=db.get_record(job_id)
            if not rec: yield "event: error\ndata: {\"error\":\"job not found\"}\n\n"; return
            current={"status":rec.get("status"),"progress":rec.get("progress",0),"confidence":rec.get("confidence")}
            if current!=previous:
                yield "event: progress\ndata: "+json.dumps(current)+"\n\n"
                previous=current
            if current["status"] in {"VERIFIED","NEEDS_REVIEW","BLOCKED","FAILED"}: return
            await asyncio.sleep(1)
    return StreamingResponse(event_stream(),media_type="text/event-stream",headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

@app.get("/api/v1/materials")
def list_materials():
    rows=db.list_records()
    return [{k:v for k,v in row.items() if k not in {"course","snippets","traceback"}} for row in rows]

@app.get("/api/v1/materials/{material_id}")
def get_material(material_id: str):
    rec=db.get_record(material_id)
    if not rec: raise HTTPException(404,"Material not found")
    return rec

@app.get("/api/v1/materials/{material_id}/files")
def list_material_files(material_id: str):
    base=STORAGE_ROOT/material_id
    if not base.exists(): raise HTTPException(404,"Material artifacts are not ready")
    return {"material_id":material_id,"files":[{"path":str(p.relative_to(base)),"size_bytes":p.stat().st_size} for p in sorted(base.rglob("*")) if p.is_file()]}

@app.get("/api/v1/materials/{material_id}/snippets")
def get_snippets(material_id: str):
    rec=db.get_record(material_id)
    if not rec: raise HTTPException(404,"Material not found")
    return {"material_id":material_id,"snippets":rec.get("snippets",[])}

@app.get("/api/v1/materials/{material_id}/snippets/{snippet_id}")
def get_snippet(material_id: str, snippet_id: str):
    rec=db.get_record(material_id)
    if not rec: raise HTTPException(404,"Material not found")
    for s in rec.get("snippets",[]):
        if s.get("snippet_id")==snippet_id: return s
    raise HTTPException(404,"Snippet not found")

@app.post("/api/v1/materials/{material_id}/extract-code")
def reextract(material_id: str):
    rec=db.get_record(material_id)
    if not rec or not rec.get("course"): raise HTTPException(404,"Generated course not found")
    course=CourseContent.model_validate(rec["course"])
    snippets=extract_snippets(course)
    rec["snippets"]=snippets; db.save_record(material_id,rec.get("status","VERIFYING"),rec)
    return {"material_id":material_id,"snippets_found":len(snippets),"snippets":snippets}

@app.post("/api/v1/materials/{material_id}/verify-code",status_code=202)
def reverify(material_id: str, background_tasks: BackgroundTasks):
    rec=db.get_record(material_id)
    if not rec or not rec.get("course"): raise HTTPException(404,"Generated course not found")
    rec["status"]="VERIFYING"; rec["progress"]=35
    db.save_record(material_id,"VERIFYING",rec)
    background_tasks.add_task(_run_reverification,material_id)
    return {"material_id":material_id,"status":"VERIFYING","message":"Verification has been queued."}

def _run_reverification(material_id: str):
    rec=db.get_record(material_id)
    if not rec or not rec.get("course"): return
    course=CourseContent.model_validate(rec["course"])
    req_payload=rec.get("request",{})
    req=GenerateRequest.model_validate(req_payload)
    snippets=extract_snippets(course)
    build_artifacts(STORAGE_ROOT,material_id,course,snippets,{"status":"VERIFYING","confidence":{},"summary":{},"snippets":[]},req_payload,req.brand_name,req.brand_primary_color)
    render_info=render_course(material_id)
    report=verify_course(course,snippets,{**req_payload,"material_id":material_id},render_info)
    snippets,report=_repair_until_stable(course,snippets,{**req_payload,"material_id":material_id},report)
    build_artifacts(STORAGE_ROOT,material_id,course,snippets,report,req_payload,req.brand_name,req.brand_primary_color)
    final_render=render_course(material_id)
    _apply_final_render(report,final_render)
    refresh_report_and_zip(STORAGE_ROOT,material_id,report)
    rec.update({"status":report["status"],"progress":100,"course":course.model_dump(),"snippets":snippets,"verification_report":report,"confidence":report["confidence"],"summary":report["summary"],"updated_at":__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()})
    db.save_record(material_id,rec["status"],rec)

@app.post("/api/v1/materials/{material_id}/slides/{slide_id}/regenerate")
def regenerate(material_id: str, slide_id: str, req: RegenerateSlideRequest):
    if not re.fullmatch(r"SLIDE-[0-9]{2}",slide_id): raise HTTPException(400,"slide_id must look like SLIDE-01")
    try: return regenerate_slide(material_id,slide_id,req.trainer_instruction)
    except ValueError as exc: raise HTTPException(400,str(exc))

@app.get("/api/v1/materials/{material_id}/verification-report")
def report(material_id: str):
    rec=db.get_record(material_id)
    if not rec: raise HTTPException(404,"Material not found")
    if rec.get("verification_report"): return rec["verification_report"]
    report_path=STORAGE_ROOT/material_id/"07_Verification_Reports/verification_report.json"
    if report_path.exists(): return json.loads(report_path.read_text(encoding="utf-8"))
    raise HTTPException(409,"Verification report is not ready")

@app.get("/api/v1/materials/{material_id}/download")
def download(material_id: str, format: str=Query(default="zip",pattern="^(zip)$")):
    rec=db.get_record(material_id)
    if not rec: raise HTTPException(404,"Material not found")
    path=STORAGE_ROOT/f"{material_id}_course_pack.zip"
    if not path.exists(): raise HTTPException(409,"Course package is still being generated")
    return FileResponse(path,filename=f"{material_id}_course_pack.zip",media_type="application/zip")

@app.get("/api/v1/materials/{material_id}/export")
def export_material(material_id: str, format: str=Query(pattern="^(pptx|pdf)$")):
    rec=db.get_record(material_id)
    if not rec: raise HTTPException(404,"Material not found")
    ext="pptx" if format=="pptx" else "pdf"
    path=STORAGE_ROOT/material_id/f"01_Presentation/course_slides.{ext}"
    if not path.exists(): raise HTTPException(409,"Export is not ready")
    return FileResponse(path,filename=f"{material_id}.{ext}",media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation" if ext=="pptx" else "application/pdf")
