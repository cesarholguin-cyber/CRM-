"""Bound request bodies before JSON or multipart parsers allocate resources."""
import re
from tempfile import SpooledTemporaryFile

from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse


class RequestBodyLimitMiddleware:
    def __init__(self, app, json_limit=1024 * 1024, upload_limit=52 * 1024 * 1024):
        self.app = app
        self.json_limit = json_limit
        self.upload_limit = upload_limit

    async def __call__(self, scope, receive, send):
        if (scope["type"] != "http" or not scope["path"].startswith("/api/")
                or scope["method"] not in {"POST", "PUT", "PATCH", "DELETE"}):
            return await self.app(scope, receive, send)
        upload = re.fullmatch(r"/api/v1/sales/\d+/documents/?", scope["path"])
        limit = self.upload_limit if upload and scope["method"] == "POST" else self.json_limit

        async def reject(status=413):
            message = "La solicitud supera el tamaño permitido." if status == 413 else "Content-Length inválido."
            await JSONResponse({"detail": message}, status_code=status)(scope, receive, send)

        lengths = [value for key, value in scope.get("headers", []) if key.lower() == b"content-length"]
        if lengths:
            if len(lengths) != 1 or not re.fullmatch(rb"[0-9]{1,20}", lengths[0]):
                return await reject(400)
            if int(lengths[0]) > limit:
                return await reject()

        # Preflight the complete body before the endpoint can parse or write data.
        # Disk spooling bounds RAM; the file is closed on success, error and disconnect.
        with SpooledTemporaryFile(max_size=min(limit, 1024 * 1024)) as body:
            size = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                size += len(chunk)
                if size > limit:
                    return await reject()
                await run_in_threadpool(body.write, chunk)
                if not message.get("more_body", False):
                    break
            await run_in_threadpool(body.seek, 0)
            remaining = size
            finished = False

            async def replay():
                nonlocal remaining, finished
                if finished:
                    return await receive()
                chunk = await run_in_threadpool(body.read, min(remaining, 64 * 1024))
                remaining -= len(chunk)
                finished = remaining == 0
                return {"type": "http.request", "body": chunk, "more_body": not finished}

            await self.app(scope, replay, send)
