#!/usr/bin/env python3
"""Mock implementation of posts-api's follow-related endpoints.

Covers follow-requests (udesa-x-posts-api#13: list, approve, reject),
follow/unfollow (udesa-x-posts-api#5), and the followers/following listings
(udesa-x-posts-api#30: paginated, cursor-based, 20 per page). It exists so
the mobile app's social screens can be built and tested before those
endpoints exist for real.

Only @demo (the one account mock-users-api.py always has) has any social
graph seeded. Any other id 404s as unknown, and a protected-account 403
(follow-list-not-visible) is not modeled: there is no other-account profile
screen yet to reach it from.

Authenticates the same way the real service will: it accepts the JWT
users-api issues. This mock does not verify a signature, it just parses the
same `mock-access-token-<handle>-<serial>` shape mock-users-api.py hands out,
so logging in against that mock and calling this one works with one token.

Usage:
    python3 scripts/mock-posts-api.py [port]

No dependencies: standard library only.
"""

from __future__ import annotations

import json
import re
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import count
from typing import Any

BASE_PATH = "/api"
# posts-api publishes every endpoint under /api, no version segment (a single
# cluster Ingress routes by this path) — same convention as users-api.
BASE_PATHS = (BASE_PATH,)
# Different from mock-users-api.py's 8020 on purpose: this is a separate
# service, reachable at its own address, same as the real deployment.
DEFAULT_PORT = 8021

ERROR_TYPE_BASE = "https://udesa-x.dev/errors"

APPROVE_PATH = re.compile(r"^/follow-requests/([^/]+)/approve$")
REJECT_PATH = re.compile(r"^/follow-requests/([^/]+)/reject$")
FOLLOW_PATH = re.compile(r"^/users/([^/]+)/follow$")
FOLLOWERS_PATH = re.compile(r"^/users/([^/]+)/followers$")
FOLLOWING_PATH = re.compile(r"^/users/([^/]+)/following$")

PAGE_SIZE = 20
# The only id this mock recognizes as a real account: matches the "usr-1"
# mock-users-api.py hands the first (and only) seeded account, @demo.
DEMO_ID = "usr-1"

# Verified against posts-api: length is measured after stripping tags, and
# the rate limit is per account per rolling hour, not a fixed clock window.
POST_MAX_LENGTH = 280
POST_RATE_LIMIT = 30
POST_RATE_WINDOW_SECONDS = 3600
HTML_TAG = re.compile(r"<[^>]*>")

request_id_issues = count(1)
post_id_issues = count(1)

# In-memory, lost on restart: {id: {...}} for the posts this mock has
# accepted, and {handle: [timestamp, ...]} for the rolling-hour rate count.
posts: dict[str, dict[str, Any]] = {}
post_timestamps: dict[str, list[float]] = {}

# In-memory store, lost when the process stops: {id: {...}}. Seeded with a
# couple of pending requests aimed at @demo so the screen has something to
# show without needing another account to send one first.
follow_requests: dict[str, dict[str, Any]] = {}

# A pool of synthetic accounts, all of them @demo's followers, so the
# followers list has enough rows (25) to exercise pagination past one page
# of 20. Followed back is tracked separately in `demo_following`.
synthetic_accounts: dict[str, dict[str, Any]] = {
    f"usr-{n}": {
        "id": f"usr-{n}",
        "handle": f"@persona{n}",
        "displayName": f"Persona {n}" if n % 3 == 0 else None,
        "avatarUrl": None,
        "createdAt": "2026-09-10T12:00:00Z",
    }
    for n in range(2, 27)
}
follower_ids: list[str] = list(synthetic_accounts.keys())
# Mutable: what @demo follows back, seeded with a few so both tabs have
# something to show. Toggled by POST/DELETE /users/{id}/follow.
demo_following: set[str] = {"usr-2", "usr-5", "usr-9"}


def strip_base_path(route: str) -> str | None:
    for base in BASE_PATHS:
        if route.startswith(base):
            return route[len(base) :]
    return None


def split_access_token(token: str) -> tuple[str, int] | None:
    """Same shape mock-users-api.py issues: mock-access-token-<handle>-<serial>."""
    prefix = "mock-access-token-"
    if not token.startswith(prefix):
        return None
    rest = token[len(prefix) :]
    handle, _, serial = rest.rpartition("-")
    if not handle or not serial.isdigit():
        return None
    return handle, int(serial)


def seed_request(requester: str, target: str) -> None:
    request_id = f"freq-{next(request_id_issues)}"
    follow_requests[request_id] = {
        "id": request_id,
        "requester_handle": requester,
        "target_handle": target,
        "status": "pending",
        "created_at": "2026-09-10T12:00:00Z",
    }


class PostsHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_OPTIONS(self) -> None:
        """Answers the browser's CORS preflight. Native clients never send one:
        this only matters for `bun run web`, where the app and the mock are on
        different origins and the browser blocks the real request otherwise.
        """
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        route = self.path.split("?")[0]
        if route == "/healthcheck" or strip_base_path(route) == "/healthcheck":
            self.send_json(200, {"status": "ok", "mock": True})
            return
        if strip_base_path(route) == "/follow-requests":
            self.list_follow_requests()
            return

        endpoint_path = strip_base_path(route)
        if endpoint_path is not None:
            followers_match = FOLLOWERS_PATH.match(endpoint_path)
            if followers_match:
                self.list_follow_graph(followers_match.group(1), "followers")
                return
            following_match = FOLLOWING_PATH.match(endpoint_path)
            if following_match:
                self.list_follow_graph(following_match.group(1), "following")
                return

        self.send_problem(404, "Ruta no encontrada", f"{self.path} no existe en el mock.")

    def do_POST(self) -> None:
        route = self.path.split("?")[0]
        endpoint_path = strip_base_path(route)
        if endpoint_path is None:
            self.send_problem(404, "Ruta no encontrada", f"{route} no existe en el mock.")
            return

        approve_match = APPROVE_PATH.match(endpoint_path)
        if approve_match:
            self.resolve_follow_request(approve_match.group(1), "approved")
            return

        reject_match = REJECT_PATH.match(endpoint_path)
        if reject_match:
            self.resolve_follow_request(reject_match.group(1), "rejected")
            return

        follow_match = FOLLOW_PATH.match(endpoint_path)
        if follow_match:
            self.set_following(follow_match.group(1), following=True)
            return

        if endpoint_path == "/posts":
            self.create_post()
            return

        self.send_problem(404, "Ruta no encontrada", f"{route} no existe en el mock.")

    def do_DELETE(self) -> None:
        route = self.path.split("?")[0]
        endpoint_path = strip_base_path(route)
        if endpoint_path is None:
            self.send_problem(404, "Ruta no encontrada", f"{route} no existe en el mock.")
            return

        follow_match = FOLLOW_PATH.match(endpoint_path)
        if follow_match:
            self.set_following(follow_match.group(1), following=False)
            return

        self.send_problem(404, "Ruta no encontrada", f"{route} no existe en el mock.")

    def resolve_caller_handle(self) -> str | None:
        """Bearer token's handle, or None after sending the matching error."""
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer ") or not auth_header[len("Bearer ") :].strip():
            self.send_json(
                401,
                {"detail": "Not authenticated"},
                extra_headers={"WWW-Authenticate": "Bearer"},
            )
            return None

        token = auth_header[len("Bearer ") :].strip()
        parts = split_access_token(token)
        if parts is None:
            self.send_problem(
                401, "No se pudo validar la sesión", "El token no es válido", code="invalid-token"
            )
            return None
        return f"@{parts[0]}"

    def list_follow_requests(self) -> None:
        caller = self.resolve_caller_handle()
        if caller is None:
            return

        pending = [
            request
            for request in follow_requests.values()
            if request["target_handle"] == caller and request["status"] == "pending"
        ]
        self.send_json(
            200,
            [
                {
                    "id": request["id"],
                    "requesterHandle": request["requester_handle"],
                    "createdAt": request["created_at"],
                }
                for request in pending
            ],
        )

    def list_follow_graph(self, user_id: str, kind: str) -> None:
        caller = self.resolve_caller_handle()
        if caller is None:
            return

        if user_id != DEMO_ID:
            self.send_problem(
                404, "Cuenta inexistente", "Esa cuenta no existe.", code="user-not-found"
            )
            return

        ids = follower_ids if kind == "followers" else sorted(demo_following)

        query = self.path.split("?", 1)[1] if "?" in self.path else ""
        cursor_values = [
            value.split("=", 1)[1] for value in query.split("&") if value.startswith("cursor=")
        ]
        offset = int(cursor_values[0]) if cursor_values and cursor_values[0].isdigit() else 0

        page_ids = ids[offset : offset + PAGE_SIZE]
        next_offset = offset + PAGE_SIZE
        next_cursor = str(next_offset) if next_offset < len(ids) else None

        items = [
            {
                "id": account_id,
                "handle": synthetic_accounts[account_id]["handle"],
                "displayName": synthetic_accounts[account_id]["displayName"],
                "avatarUrl": synthetic_accounts[account_id]["avatarUrl"],
                "following": account_id in demo_following,
                "createdAt": synthetic_accounts[account_id]["createdAt"],
            }
            for account_id in page_ids
        ]
        self.send_json(200, {"items": items, "nextCursor": next_cursor})

    def set_following(self, target_id: str, *, following: bool) -> None:
        caller = self.resolve_caller_handle()
        if caller is None:
            return

        if target_id not in synthetic_accounts:
            self.send_problem(
                404, "Cuenta inexistente", "Esa cuenta no existe.", code="user-not-found"
            )
            return

        if following:
            demo_following.add(target_id)
        else:
            demo_following.discard(target_id)

        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def create_post(self) -> None:
        caller = self.resolve_caller_handle()
        if caller is None:
            return

        body = self.read_json()
        if body is None:
            self.send_problem(400, "Cuerpo inválido", "Se esperaba un objeto JSON.")
            return

        raw_content = str(body.get("content", ""))
        # The limit is measured on the sanitized text, not on what the client
        # sent: a post padded with tags to dodge the count would still be
        # rejected server-side.
        sanitized = HTML_TAG.sub("", raw_content).strip()

        if not sanitized:
            self.send_problem(
                422, "Post vacío", "El post no puede estar vacío.", code="post-is-blank"
            )
            return
        if len(sanitized) > POST_MAX_LENGTH:
            self.send_problem(
                422,
                "Post demasiado largo",
                f"El post no puede superar los {POST_MAX_LENGTH} caracteres.",
                code="post-too-long",
            )
            return

        now = time.time()
        recent = [
            timestamp
            for timestamp in post_timestamps.get(caller, [])
            if now - timestamp < POST_RATE_WINDOW_SECONDS
        ]
        if len(recent) >= POST_RATE_LIMIT:
            retry_after = int(POST_RATE_WINDOW_SECONDS - (now - recent[0]))
            self.send_problem(
                429,
                "Demasiadas publicaciones",
                "Alcanzaste el límite de 30 publicaciones por hora. Probá más tarde.",
                code="too-many-posts",
                extra_headers={"Retry-After": str(max(retry_after, 1))},
            )
            return
        recent.append(now)
        post_timestamps[caller] = recent

        post_id = f"post-{next(post_id_issues)}"
        # Only @demo is a real account in this mock: see the module docstring.
        post = {
            "id": post_id,
            "authorId": DEMO_ID,
            "content": sanitized,
            "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "likesCount": 0,
            "retweetsCount": 0,
            "repliesCount": 0,
        }
        posts[post_id] = post
        self.send_json(201, post)

    def resolve_follow_request(self, request_id: str, resolution: str) -> None:
        caller = self.resolve_caller_handle()
        if caller is None:
            return

        request = follow_requests.get(request_id)
        if request is None:
            self.send_problem(
                404, "Solicitud inexistente", "Esa solicitud de seguimiento no existe."
            )
            return
        # Only the account that received the request can decide on it.
        if request["target_handle"] != caller:
            self.send_problem(
                403,
                "No autorizado",
                "Esta solicitud no está dirigida a tu cuenta.",
                code="not-request-owner",
            )
            return
        if request["status"] != "pending":
            self.send_problem(
                409,
                "Solicitud ya resuelta",
                "Esta solicitud ya fue aprobada o rechazada.",
                code="follow-request-already-resolved",
            )
            return

        request["status"] = resolution
        print(f"    {caller}: solicitud de {request['requester_handle']} -> {resolution}")
        self.send_json(200, {"id": request["id"], "status": resolution})

    def read_json(self) -> dict[str, Any] | None:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            parsed = json.loads(raw or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
        return parsed if isinstance(parsed, dict) else None

    def send_json(
        self,
        status: int,
        payload: Any,
        content_type: str = "application/json",
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        # Only the browser checks this (see do_OPTIONS): native clients ignore it.
        self.send_header("Access-Control-Allow-Origin", "*")
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(raw)

    def send_problem(
        self,
        status: int,
        title: str,
        detail: str,
        code: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        payload = {
            "type": f"{ERROR_TYPE_BASE}/{code}" if code else "about:blank",
            "title": title,
            "status": status,
            "detail": detail,
        }
        self.send_json(
            status,
            payload,
            content_type="application/problem+json",
            extra_headers=extra_headers,
        )

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        sys.stdout.write(f"  {format % args}\n")
        sys.stdout.flush()


def lan_address() -> str:
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return str(probe.getsockname()[0])
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def tailnet_hosts() -> list[str]:
    try:
        result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        status = json.loads(result.stdout) if result.returncode == 0 else {}
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return []

    if status.get("BackendState") != "Running":
        return []

    node = status.get("Self") or {}
    hosts = [address for address in node.get("TailscaleIPs", []) if ":" not in address]

    dns_name = str(node.get("DNSName", "")).rstrip(".")
    if dns_name and (status.get("CurrentTailnet") or {}).get("MagicDNSEnabled"):
        hosts.append(dns_name)
    return hosts


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    seed_request("@joaquin_dev", "@demo")
    seed_request("@ana_garcia", "@demo")

    try:
        server = ThreadingHTTPServer(("0.0.0.0", port), PostsHandler)
    except OSError as error:
        print(f"No se pudo escuchar en el puerto {port}: {error}")
        print(f"Probá con otro: python3 scripts/mock-posts-api.py {port + 1}")
        raise SystemExit(1) from error

    hosts = [(host, "tailnet") for host in tailnet_hosts()]
    hosts.append((lan_address(), "red local"))

    print(f"Mock de posts-api escuchando en 0.0.0.0:{port}\n")
    print("Levantá la app apuntando acá:")
    for host, network in hosts:
        print(f"  # {network}")
        print(f"  EXPO_PUBLIC_POSTS_API_URL=http://{host}:{port}{BASE_PATH} bun run start")
    print()
    print("Si la app no conecta, abrí esto en el navegador del celular:")
    print(f"  http://{hosts[0][0]}:{port}/healthcheck\n")
    print("Trae 2 solicitudes de seguimiento pendientes para @demo, de @joaquin_dev y @ana_garcia.")
    print("Usa el mismo token que emite mock-users-api.py: iniciá sesión ahí primero.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nMock detenido.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
