"""HTTP / WebSocket 路由。"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from . import deletion, diary_service, orchestrator, safety
from .stt import STTUnavailable
from .tts import TTSFailed, TTSNotConfigured

router = APIRouter()


def _state(request):
    return request.app.state


def require_session(request, session_id: str):
    """会话守卫：到期先清除 → 410；closing 期间的活动取消倒计时（Q01 待确认项，
    按「重开取消」实现）；deleted → 410。"""
    state = _state(request)
    row = deletion.resume(state.db, state.db_lock, session_id)
    if row is None:
        return None  # 不存在 → 404
    if row == "deleted":
        return "deleted"
    return row


def session_or_error(request, session_id: str):
    row = require_session(request, session_id)
    if row is None:
        return None, JSONResponse({"error": "session_not_found"}, status_code=404)
    if row == "deleted":
        return None, JSONResponse({"error": "session_expired"}, status_code=410)
    return row, None


# ---------- 会话 ----------

@router.post("/api/session")
async def create_session(request: Request):
    state = _state(request)
    sid = uuid.uuid4().hex
    now = diary_service.now_iso()
    with state.db_lock:
        state.db.execute(
            "INSERT INTO sessions (id, status, current_character, created_at, last_active_at)"
            " VALUES (?, 'active', 'none', ?, ?)",
            (sid, now, now),
        )
        state.db.commit()
    return {"sessionId": sid, "createdAt": now}


class SessionRef(BaseModel):
    sessionId: str


@router.post("/api/session/resume")
async def resume_session(body: SessionRef, request: Request):
    row, err = session_or_error(request, body.sessionId)
    if err:
        return err
    return {"sessionId": row["id"], "status": row["status"], "character": row["current_character"]}


@router.post("/api/session/beacon")
async def session_beacon(body: SessionRef, request: Request):
    """页面关闭信标：开始五分钟删除倒计时，并整理当天日记。"""
    state = _state(request)
    row = deletion.mark_closed(
        state.db, state.db_lock, body.sessionId, state.settings.delete_after_seconds
    )
    if row is None:
        return JSONResponse({"error": "session_not_found"}, status_code=404)
    return {"sessionId": row["id"], "status": row["status"], "deleteAt": row["delete_at"]}


@router.get("/api/session/{session_id}")
async def get_session(session_id: str, request: Request):
    row, err = session_or_error(request, session_id)
    if err:
        return err
    return {
        "sessionId": row["id"],
        "status": row["status"],
        "character": row["current_character"],
        "createdAt": row["created_at"],
    }


# ---------- 对话 ----------

class ChatRequest(BaseModel):
    sessionId: str
    text: str


@router.post("/api/chat")
async def chat(body: ChatRequest, request: Request):
    _, err = session_or_error(request, body.sessionId)
    if err:
        return err
    if not body.text.strip():
        return JSONResponse({"error": "empty_text"}, status_code=400)
    return await orchestrator.process_message(_state(request), body.sessionId, body.text.strip())


@router.websocket("/ws/chat/{session_id}")
async def ws_chat(ws: WebSocket, session_id: str):
    state = ws.app.state
    await ws.accept()
    row = deletion.resume(state.db, state.db_lock, session_id)
    if row is None or row == "deleted":
        await ws.send_json({"type": "error", "error": "session_unavailable"})
        await ws.close(code=4404)
        return
    try:
        while True:
            data = await ws.receive_json()
            mtype = data.get("type")
            if mtype == "ping":
                await ws.send_json({"type": "pong"})
            elif mtype == "message":
                text = str(data.get("text") or "").strip()
                if not text:
                    await ws.send_json({"type": "error", "error": "empty_text"})
                    continue
                try:
                    result = await orchestrator.process_message(state, session_id, text)
                except Exception:
                    await ws.send_json({"type": "error", "error": "chat_failed"})
                    continue
                await ws.send_json({"type": "reply", **result})
            elif mtype == "close":
                deletion.mark_closed(
                    state.db, state.db_lock, session_id, state.settings.delete_after_seconds
                )
                await ws.send_json({"type": "closing"})
                await ws.close()
                return
    except WebSocketDisconnect:
        # 短暂断网/切后台不等于关闭（Q01），不触发删除计时
        return


# ---------- 日记与事件 ----------

@router.get("/api/diary")
async def get_diary(sessionId: str, request: Request, date: str | None = None):
    _, err = session_or_error(request, sessionId)
    if err:
        return err
    state = _state(request)
    local_date = date or diary_service.local_today()
    diary = diary_service.get_diary(state.db, sessionId, local_date)
    if diary is None:
        return {"date": local_date, "diary": None, "blocks": []}
    return {
        "date": local_date,
        "diary": {"id": diary["id"], "status": diary["status"], "finalizedAt": diary["finalized_at"]},
        "blocks": diary_service.list_blocks(state.db, diary["id"]),
    }


class BlockEdit(BaseModel):
    sessionId: str
    text: str


@router.put("/api/diary/blocks/{block_id}")
async def edit_block(block_id: str, body: BlockEdit, request: Request):
    _, err = session_or_error(request, body.sessionId)
    if err:
        return err
    state = _state(request)
    updated = diary_service.user_edit_block(state.db, state.db_lock, block_id, body.sessionId, body.text)
    if updated is None:
        return JSONResponse({"error": "block_not_found"}, status_code=404)
    return updated


@router.delete("/api/events/{event_id}")
async def delete_event(event_id: str, sessionId: str, request: Request):
    """删除事件 → 软删 emotion_event → 重算情绪占比 → 移除可检索内容。"""
    _, err = session_or_error(request, sessionId)
    if err:
        return err
    state = _state(request)
    heart = diary_service.delete_event(state.db, state.db_lock, sessionId, event_id)
    if heart is None:
        return JSONResponse({"error": "event_not_found"}, status_code=404)
    return {"deleted": True, "heart": heart}


@router.get("/api/mood/{session_id}")
async def mood(session_id: str, request: Request, date: str | None = None):
    _, err = session_or_error(request, session_id)
    if err:
        return err
    state = _state(request)
    local_date = date or diary_service.local_today()
    return diary_service.heart_status(state.db, session_id, local_date)


class MoodConfirm(BaseModel):
    sessionId: str
    emotion: str
    date: str | None = None


@router.post("/api/diary/confirm-mood")
async def confirm_mood(body: MoodConfirm, request: Request):
    _, err = session_or_error(request, body.sessionId)
    if err:
        return err
    if body.emotion not in ("calm", "joy", "anger", "sadness", "fear"):
        return JSONResponse({"error": "invalid_emotion"}, status_code=400)
    state = _state(request)
    local_date = body.date or diary_service.local_today()
    return diary_service.confirm_mood(state.db, state.db_lock, body.sessionId, local_date, body.emotion)


class DiaryDateRef(BaseModel):
    sessionId: str
    date: str | None = None


@router.post("/api/diary/confirm")
async def confirm_diary(body: DiaryDateRef, request: Request):
    _, err = session_or_error(request, body.sessionId)
    if err:
        return err
    state = _state(request)
    local_date = body.date or diary_service.local_today()
    diary = diary_service.confirm_diary(state.db, state.db_lock, body.sessionId, local_date)
    if diary is None:
        return JSONResponse({"error": "diary_not_found"}, status_code=404)
    return {"diaryId": diary["id"], "status": diary["status"]}


@router.post("/api/diary/share")
async def share_diary(body: DiaryDateRef, request: Request):
    """孩子预览确认后生成该版本的完整日记独立快照。"""
    _, err = session_or_error(request, body.sessionId)
    if err:
        return err
    state = _state(request)
    local_date = body.date or diary_service.local_today()
    result = diary_service.share_diary(state.db, state.db_lock, body.sessionId, local_date)
    if result is None:
        return JSONResponse({"error": "diary_not_found"}, status_code=404)
    return {**result, "path": f"/api/share/{result['shareToken']}"}


class RevokeRef(BaseModel):
    sessionId: str
    shareToken: str


@router.post("/api/diary/share/revoke")
async def revoke_share(body: RevokeRef, request: Request):
    _, err = session_or_error(request, body.sessionId)
    if err:
        return err
    state = _state(request)
    ok = diary_service.revoke_snapshot(state.db, state.db_lock, body.shareToken)
    if not ok:
        return JSONResponse({"error": "snapshot_not_found"}, status_code=404)
    return {"revoked": True}


@router.get("/api/share/{token}")
async def read_shared(token: str, request: Request):
    """旧分享链接：只读快照；撤回/过期后 410，未知 404。"""
    state = _state(request)
    snap = diary_service.get_snapshot_by_token(state.db, token)
    if snap is None:
        return JSONResponse({"error": "not_found"}, status_code=404)
    if snap == "revoked":
        return JSONResponse({"error": "snapshot_revoked"}, status_code=410)
    return snap


# ---------- 家长端 ----------

@router.get("/api/parent/heart/{session_id}")
async def parent_heart(session_id: str, request: Request, date: str | None = None):
    """心情心脏状态：未确认=白（state=unconfirmed），与已确认平静区分。"""
    state = _state(request)
    # 家长端读取不取消孩子的删除倒计时，只检查是否已过期
    deletion.purge_if_expired(state.db, state.db_lock, session_id)
    row = state.db.execute("SELECT status FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        return JSONResponse({"error": "not_found"}, status_code=404)
    if row["status"] == "deleted":
        return JSONResponse({"error": "expired"}, status_code=410)
    local_date = date or diary_service.local_today()
    return diary_service.heart_status(state.db, session_id, local_date)


@router.get("/api/parent/diaries/{session_id}")
async def parent_diaries(session_id: str, request: Request, date: str | None = None):
    """被分享的日记快照（immutable）；不展示未分享日记。"""
    state = _state(request)
    deletion.purge_if_expired(state.db, state.db_lock, session_id)
    row = state.db.execute("SELECT status FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        return JSONResponse({"error": "not_found"}, status_code=404)
    if row["status"] == "deleted":
        return JSONResponse({"error": "expired"}, status_code=410)
    return {"snapshots": diary_service.list_shared_snapshots(state.db, session_id, date)}


@router.get("/api/parent/guidance/{session_id}")
async def parent_guidance(session_id: str, request: Request, date: str | None = None, bindingId: str | None = None):
    """行动指南：疑似霸凌起才出现；家庭风险屏蔽中的事件按接收人过滤。"""
    state = _state(request)
    deletion.purge_if_expired(state.db, state.db_lock, session_id)
    row = state.db.execute("SELECT status FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        return JSONResponse({"error": "not_found"}, status_code=404)
    if row["status"] == "deleted":
        return JSONResponse({"error": "expired"}, status_code=410)
    return {"guidance": safety.list_guidance(state.db, session_id, date, bindingId)}


# ---------- 语音 ----------

class TTSRequest(BaseModel):
    sessionId: str
    text: str


@router.post("/api/tts")
async def tts(body: TTSRequest, request: Request):
    """TTS 失败不阻断文本回复：失败返回 503，前端保留字幕。"""
    _, err = session_or_error(request, body.sessionId)
    if err:
        return err
    state = _state(request)
    try:
        audio = await state.tts.synthesize(body.text)
    except TTSNotConfigured:
        return JSONResponse({"error": "tts_unavailable"}, status_code=503)
    except TTSFailed:
        return JSONResponse({"error": "tts_failed"}, status_code=503)
    except Exception:
        return JSONResponse({"error": "tts_failed"}, status_code=503)
    return Response(content=audio, media_type="audio/mpeg")


@router.post("/api/stt")
async def stt(request: Request):
    """STT：FunASR 优先；未配置/失败返回明确错误，前端回退文字输入。
    原始音频只在内存中识别，不保存（设定 §11）。"""
    state = _state(request)
    form = await request.form()
    upload = form.get("audio")
    if upload is None:
        return JSONResponse({"error": "audio_required"}, status_code=400)
    audio = await upload.read()
    if state.stt is None:
        return JSONResponse(
            {"error": "stt_unavailable", "fallback": "text"}, status_code=501
        )
    try:
        text = await state.stt.transcribe(audio)
    except STTUnavailable:
        return JSONResponse({"error": "stt_unavailable", "fallback": "text"}, status_code=503)
    except Exception:
        return JSONResponse({"error": "stt_failed", "fallback": "text"}, status_code=503)
    return {"text": text, "final": True}


# ---------- 内部演示接口（仅开发环境） ----------

class FinalizeRef(BaseModel):
    sessionId: str | None = None
    date: str | None = None


@router.post("/internal/dev/finalize-diary")
async def dev_finalize(body: FinalizeRef, request: Request):
    """演示「00:00 自动整合」：幂等，重跑不产生第二篇。"""
    state = _state(request)
    return diary_service.finalize_diaries(state.db, state.db_lock, body.sessionId, body.date)


class BindingRef(BaseModel):
    sessionId: str
    relation: str


@router.post("/internal/dev/bindings")
async def dev_binding(body: BindingRef, request: Request):
    _, err = session_or_error(request, body.sessionId)
    if err:
        return err
    try:
        return safety.add_demo_binding(_state(request).db, _state(request).db_lock, body.sessionId, body.relation)
    except ValueError:
        return JSONResponse({"error": "relation_required"}, status_code=400)


class ExclusionRef(BaseModel):
    riskEventId: str
    bindingId: str


@router.post("/internal/dev/risk-recipient-exclusion")
async def dev_exclude(body: ExclusionRef, request: Request):
    state = _state(request)
    ok = safety.exclude_recipient(state.db, state.db_lock, body.riskEventId, body.bindingId)
    if not ok:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return {"excluded": True}


@router.post("/internal/dev/purge-expired")
async def dev_purge(request: Request):
    state = _state(request)
    purged = deletion.purge_expired(state.db, state.db_lock)
    for sid in purged:
        state.histories.pop(sid, None)
    return {"purged": purged}


class ForceExpireRef(BaseModel):
    sessionId: str


@router.post("/internal/dev/force-expire")
async def dev_force_expire(body: ForceExpireRef, request: Request):
    """测试/演示辅助：把某 session 的删除计时立即置为到期。"""
    state = _state(request)
    with state.db_lock:
        cur = state.db.execute(
            "UPDATE sessions SET delete_at = ? WHERE id = ? AND status = 'closing'",
            ("2000-01-01T00:00:00+00:00", body.sessionId),
        )
        state.db.commit()
    if not cur.rowcount:
        return JSONResponse({"error": "not_closing"}, status_code=400)
    return {"forced": True}


# ---------- 占位接口（只留壳，不实现） ----------

@router.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def placeholder_auth(path: str):
    return JSONResponse({"error": "not_implemented", "note": "MVP 占位接口"}, status_code=501)


@router.api_route("/api/binding/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def placeholder_binding(path: str):
    return JSONResponse({"error": "not_implemented", "note": "MVP 占位接口"}, status_code=501)


@router.api_route("/api/parent/notifications/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def placeholder_notifications(path: str):
    return JSONResponse({"error": "not_implemented", "note": "MVP 占位接口"}, status_code=501)


@router.api_route("/api/memory/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def placeholder_memory(path: str):
    return JSONResponse({"error": "not_implemented", "note": "MVP 占位接口"}, status_code=501)
