from __future__ import annotations
import os, re, shutil, time, uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import docker
from docker.errors import DockerException, ImageNotFound, APIError

app=FastAPI(title="Verified Course Studio Sandbox Controller", version="0.1.0")
VOLUME_NAME=os.getenv("RUNTIME_VOLUME_NAME","verified-course-studio_runtime_jobs")
JOBS_ROOT=Path(os.getenv("JOBS_ROOT","/runtime_jobs"))
PYTHON_IMAGE=os.getenv("PYTHON_IMAGE","python:3.12.15-slim-bookworm")
JAVA_IMAGE=os.getenv("JAVA_IMAGE","eclipse-temurin:21.0.12.1_1-jdk-jammy")
JOB_ID_RE=re.compile(r"^[A-Za-z0-9_-]{1,100}$")
CLASS_RE=re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,80}$")

class RunRequest(BaseModel):
    snippet_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    language: str = Field(pattern=r"^(python|java)$")
    code: str = Field(min_length=1, max_length=50000)
    tests_code: str | None = Field(default=None, max_length=50000)
    test_main_class: str | None = Field(default=None, pattern=r"^[A-Za-z_][A-Za-z0-9_]{0,80}$")
    timeout_seconds: int = Field(default=10, ge=1, le=30)


def _main_class(code: str) -> str:
    found=re.search(r"\bpublic\s+class\s+([A-Za-z_][A-Za-z0-9_]*)",code)
    if found: return found.group(1)
    found=re.search(r"\bclass\s+([A-Za-z_][A-Za-z0-9_]*)",code)
    if found: return found.group(1)
    return "Main"


def _run_container(req: RunRequest, directory: Path) -> dict:
    try:
        client=docker.from_env()
        client.ping()
    except DockerException as exc:
        return {"status":"BLOCKED","exit_code":None,"stdout":"","stderr":f"Docker daemon unavailable; code was NOT run. {exc}"}
    if req.language=="python":
        image=PYTHON_IMAGE
        (directory/"solution.py").write_text(req.code,encoding="utf-8")
        if req.tests_code:
            (directory/"test_solution.py").write_text(req.tests_code,encoding="utf-8")
            command=["sh","-lc","python -u solution.py && python -m unittest -v test_solution.py"]
        else:
            command=["python","-u","solution.py"]
    else:
        image=JAVA_IMAGE
        entry_class=_main_class(req.code)
        (directory/f"{entry_class}.java").write_text(req.code,encoding="utf-8")
        if req.tests_code:
            test_class=req.test_main_class or _main_class(req.tests_code)
            if test_class==entry_class:
                return {"status":"ERROR","exit_code":None,"stdout":"","stderr":"Test class conflicts with source class."}
            (directory/f"{test_class}.java").write_text(req.tests_code,encoding="utf-8")
            command=["sh","-lc",f"mkdir -p /tmp/classes && javac -d /tmp/classes *.java && java -ea -cp /tmp/classes {test_class}"]
        else:
            command=["sh","-lc",f"mkdir -p /tmp/classes && javac -d /tmp/classes *.java && java -cp /tmp/classes {entry_class}"]
    container=None
    try:
        # Images are allowlisted by this controller; callers cannot submit Docker commands or images.
        container=client.containers.create(
            image=image,
            command=command,
            working_dir=f"/runtime_jobs/{directory.name}",
            volumes={VOLUME_NAME:{"bind":"/runtime_jobs","mode":"ro"}},
            network_disabled=True,
            mem_limit="256m",
            nano_cpus=500_000_000,
            pids_limit=64,
            security_opt=["no-new-privileges:true"],
            cap_drop=["ALL"],
            read_only=True,
            tmpfs={"/tmp":"rw,noexec,nosuid,size=32m"},
            user="65534:65534",
            environment={"PYTHONDONTWRITEBYTECODE":"1","PYTHONUNBUFFERED":"1"},
            stdin_open=False,
            tty=False,
            labels={"app":"verified-course-studio","purpose":"untrusted-generated-code"},
        )
        container.start()
        try:
            wait_result=container.wait(timeout=req.timeout_seconds+2)
            exit_code=int(wait_result.get("StatusCode",1))
        except Exception:
            try: container.kill()
            except Exception: pass
            exit_code=124
        try:
            output=container.logs(stdout=True,stderr=False).decode("utf-8",errors="replace")[-12000:]
            err=container.logs(stdout=False,stderr=True).decode("utf-8",errors="replace")[-12000:]
        except Exception as exc:
            output=""; err=f"Unable to collect container logs: {exc}"
        try: image_id=client.images.get(image).attrs.get("Id")
        except Exception: image_id=None
        if exit_code==0:
            return {"status":"PASSED","exit_code":0,"stdout":output,"stderr":err,"runtime_image":image,"runtime_image_id":image_id,"command":command,"timeout_seconds":req.timeout_seconds,"execution_isolated":True}
        if exit_code==124:
            err=(err+"\nExecution timed out and the container was terminated.").strip()
        return {"status":"FAILED","exit_code":exit_code,"stdout":output,"stderr":err,"runtime_image":image,"runtime_image_id":image_id,"command":command,"timeout_seconds":req.timeout_seconds,"execution_isolated":True}
    except ImageNotFound as exc:
        return {"status":"BLOCKED","exit_code":None,"stdout":"","stderr":f"Approved runtime image is not available locally. Pre-pull and pin it before execution: {exc}"}
    except APIError as exc:
        return {"status":"BLOCKED","exit_code":None,"stdout":"","stderr":f"Sandbox container could not be started; code was NOT run. {exc}"}
    finally:
        if container is not None:
            try: container.remove(force=True)
            except Exception: pass

@app.get("/health")
def health():
    docker_ready=False
    try:
        c=docker.from_env(); c.ping(); docker_ready=True
    except Exception: pass
    return {"status":"ok","docker_available":docker_ready,"volume_name":VOLUME_NAME,"profiles":{"python":{"image":PYTHON_IMAGE},"java":{"image":JAVA_IMAGE}}}

@app.post("/run")
def run(req: RunRequest):
    if not JOB_ID_RE.fullmatch(req.snippet_id): raise HTTPException(400,"Invalid snippet ID")
    JOBS_ROOT.mkdir(parents=True,exist_ok=True)
    job_name=f"job_{int(time.time())}_{uuid.uuid4().hex[:8]}_{req.snippet_id}"
    directory=JOBS_ROOT/job_name
    directory.mkdir(parents=True,exist_ok=False)
    try:
        result=_run_container(req,directory)
        result.update({"snippet_id":req.snippet_id,"language":req.language,"command_profile":"approved-fixed-command","network_access":"disabled","resource_limits":{"memory":"256m","cpus":0.5,"pids":64,"timeout_seconds":req.timeout_seconds}})
        return result
    finally:
        # Give Docker a moment to release its readonly mount before cleanup.
        time.sleep(0.15)
        shutil.rmtree(directory,ignore_errors=True)
