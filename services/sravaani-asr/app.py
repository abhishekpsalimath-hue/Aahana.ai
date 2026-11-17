"""Private, opt-in HTTP wrapper for the official SraVaani 1.0 transcribe API.

This service intentionally refuses to start unless remote-code execution is
explicitly acknowledged, a full immutable model revision is supplied, and
both Hugging Face and service credentials are configured.
"""
from __future__ import annotations

import hmac
import io
import os
import re
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import soundfile as sf
import torch
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool
from transformers import AutoModel

MODEL_ID = "ARTPARK-IISc/SraVaani-1.0"
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_AUDIO_SECONDS = 90
MODEL_REVISION = os.getenv("HF_MODEL_REVISION", "").strip()
HF_TOKEN = os.getenv("HF_TOKEN", "").strip()
SERVICE_TOKEN = os.getenv("SRAVAANI_API_TOKEN", "").strip()
ALLOW_REMOTE_CODE = os.getenv("ALLOW_AUDITED_REMOTE_CODE", "").lower() == "true"

_model = None
_device = "cuda" if torch.cuda.is_available() else "cpu"
_inference_lock = threading.Lock()


def _validate_startup_config() -> None:
    if not ALLOW_REMOTE_CODE:
        raise RuntimeError(
            "Refusing to load SraVaani custom code. Audit the pinned model "
            "revision, then set ALLOW_AUDITED_REMOTE_CODE=true explicitly."
        )
    if not re.fullmatch(r"[0-9a-fA-F]{40,64}", MODEL_REVISION):
        raise RuntimeError("HF_MODEL_REVISION must be an immutable 40–64 character commit SHA.")
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is required; accept the gated model terms first.")
    if len(SERVICE_TOKEN) < 32:
        raise RuntimeError("SRAVAANI_API_TOKEN must be a random secret of at least 32 characters.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _model
    _validate_startup_config()
    _model = AutoModel.from_pretrained(
        MODEL_ID,
        revision=MODEL_REVISION,
        trust_remote_code=True,
        token=HF_TOKEN,
    ).to(_device).eval()
    yield
    _model = None


app = FastAPI(
    title="Aahana private SraVaani ASR",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)


def _authenticate(authorization: str | None) -> None:
    expected = f"Bearer {SERVICE_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _transcribe_wav(audio_bytes: bytes) -> str:
    # soundfile can decode formats other than WAV, so enforce the container too.
    if len(audio_bytes) < 12 or audio_bytes[:4] != b"RIFF" or audio_bytes[8:12] != b"WAVE":
        raise HTTPException(status_code=415, detail="Only RIFF/WAVE audio is accepted.")
    # Decode before writing anything to disk.
    try:
        samples, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=True)
    except Exception as exc:
        raise HTTPException(status_code=415, detail="Upload a valid WAV audio file.") from exc

    if sample_rate <= 0 or samples.size == 0:
        raise HTTPException(status_code=422, detail="The WAV file contains no audio.")
    duration = len(samples) / sample_rate
    if duration > MAX_AUDIO_SECONDS:
        raise HTTPException(status_code=413, detail=f"Audio must be {MAX_AUDIO_SECONDS} seconds or shorter.")

    # The official model quickstart accepts a local audio path. Temporary audio
    # is removed immediately after inference; no user audio is retained.
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = Path(temp_file.name)
        with _inference_lock:
            hypotheses = _model.transcribe(str(temp_path), return_hypotheses=True)
        transcript = " ".join(
            hypothesis.text.strip()
            for hypothesis in hypotheses
            if getattr(hypothesis, "text", "").strip()
        )
        if not transcript:
            raise HTTPException(status_code=422, detail="No speech transcript was returned.")
        return transcript
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


@app.get("/health")
async def health():
    # Do not reveal model credentials, revision, or internal host details.
    return {"status": "ok" if _model is not None else "starting", "provider": "sravaani-1.0"}


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    _authenticate(authorization)
    if file.content_type not in {"audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Only WAV audio is accepted.")
    audio_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty.")
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Audio upload exceeds the 15 MB limit.")
    transcript = await run_in_threadpool(_transcribe_wav, audio_bytes)
    return {"text": transcript, "provider": "sravaani-1.0", "audio_retained": False}
