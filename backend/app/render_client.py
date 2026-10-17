from __future__ import annotations
import os
import httpx

RENDERER_URL=os.getenv("RENDERER_URL","http://renderer:8082")

def render_course(material_id: str) -> dict:
    try:
        with httpx.Client(timeout=105) as client:
            response=client.post(f"{RENDERER_URL.rstrip('/')}/render/{material_id}")
        if response.status_code>=400:
            return {"status":"BLOCKED","message":f"Renderer HTTP {response.status_code}: {response.text[:1500]}"}
        return response.json()
    except Exception as exc:
        return {"status":"BLOCKED","message":f"Deck renderer unavailable; rendered-layout verification was NOT completed. {type(exc).__name__}: {exc}"}
