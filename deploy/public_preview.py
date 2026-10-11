"""Protected, isolated phone preview. Run only on the loopback interface."""
import os
import secrets

from starlette.requests import HTTPConnection
from starlette.responses import PlainTextResponse, RedirectResponse
from main import app as inner_app

TOKEN = os.environ["PREVIEW_ACCESS_TOKEN"]
COOKIE = "xxw_preview_access"


async def app(scope, receive, send):
    if scope["type"] not in ("http", "websocket"):
        return await inner_app(scope, receive, send)
    path = scope["path"]
    if scope["type"] == "http" and secrets.compare_digest(path, "/enter/" + TOKEN):
        response = RedirectResponse("/", status_code=303)
        response.set_cookie(COOKIE, TOKEN, secure=True, httponly=True, samesite="lax", max_age=86400)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return await response(scope, receive, send)
    authenticated = secrets.compare_digest(HTTPConnection(scope).cookies.get(COOKIE, ""), TOKEN)
    blocked = path.startswith(("/internal", "/docs", "/redoc", "/openapi.json"))
    if not authenticated or blocked:
        if scope["type"] == "websocket":
            return await send({"type": "websocket.close", "code": 1008})
        return await PlainTextResponse("Please open the preview invitation link.", status_code=403)(scope, receive, send)
    await inner_app(scope, receive, send)
