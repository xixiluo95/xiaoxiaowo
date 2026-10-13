"""静态资源缓存头：Vite 指纹资源长缓存、普通媒体短缓存、HTML 每次校验、API 不缓存。

纯 ASGI 中间件，只往响应头补 Cache-Control，不缓冲响应体——视频的 Range/206 分段响应
与流式响应都不受影响。压缩交给 Starlette 的 GZipMiddleware（它按 content-type 排除
video/*、image/*，并跳过 206）。
"""
from __future__ import annotations

import re

from starlette.datastructures import MutableHeaders

# Vite 产物形如 index-BK6Wf8oK.js：文件名里带 8 位以上指纹即可长缓存
_HASHED_ASSET = re.compile(r"-[0-9A-Za-z_]{8,}\.[A-Za-z0-9]+$")

HASHED_MAX_AGE = 31536000  # 1 年，指纹变化即换名，可 immutable
ASSET_MAX_AGE = 3600  # 1 小时，覆盖 emotions/scenes/ui 这类不改名的素材


def cache_directive(path: str) -> str | None:
    """按路径给出 Cache-Control；返回 None 表示不改动该响应。"""
    if path.startswith("/api/"):
        return "no-store"  # 会话数据与语音，绝不允许中间层或浏览器缓存
    if path.startswith("/assets/"):
        if _HASHED_ASSET.search(path):
            return f"public, max-age={HASHED_MAX_AGE}, immutable"
        return f"public, max-age={ASSET_MAX_AGE}"
    # 无扩展名的路径（含 "/"）由 StaticFiles(html=True) 回落到 index.html，属应用外壳
    last_segment = path.rsplit("/", 1)[-1]
    if "." not in last_segment or last_segment.endswith((".html", ".htm")):
        return "no-cache"
    return None


class StaticCacheMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        directive = cache_directive(scope.get("path", ""))
        if directive is None:
            return await self.app(scope, receive, send)

        no_store = directive == "no-store"

        async def send_with_cache(message):
            if message["type"] == "http.response.start":
                # 只给成功响应与 304 补长/短缓存；no-store 连错误响应一起标，避免启发式缓存
                if (message["status"] in (200, 304) or no_store) and "cache-control" not in MutableHeaders(scope=message):
                    MutableHeaders(scope=message)["Cache-Control"] = directive
            await send(message)

        await self.app(scope, receive, send_with_cache)
