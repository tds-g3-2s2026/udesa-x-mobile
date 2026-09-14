#!/usr/bin/env python3
"""Mock implementation of the posts-api follow-requests endpoints.

Covers only what udesa-x-posts-api#13 defines: listing the follow requests
aimed at the current user, and approving or rejecting one. It exists so the
mobile app's pending-requests screen can be built and tested before those
endpoints exist for real. Follow/unfollow (udesa-x-posts-api#5) is not mocked
here yet: no mobile screen calls it.

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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import count
from typing import Any

BASE_PATH = "/api/v1"
BASE_PATHS = (BASE_PATH, "/v1")
# Different from mock-users-api.py's 8020 on purpose: this is a separate
# service, reachable at its own address, same as the real deployment.
DEFAULT_PORT = 8021

ERROR_TYPE_BASE = "https://udesa-x.dev/errors"

APPROVE_PATH = re.compile(r"^/follow-requests/([^/]+)/approve$")
REJECT_PATH = re.compile(r"^/follow-requests/([^/]+)/reject$")

request_id_issues = count(1)

# In-memory store, lost when the process stops: {id: {...}}. Seeded with a
# couple of pending requests aimed at @demo so the screen has something to
# show without needing another account to send one first.
follow_requests: dict[str, dict[str, Any]] = {}


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

    def do_GET(self) -> None:
        route = self.path.split("?")[0]
        if route == "/healthcheck" or strip_base_path(route) == "/healthcheck":
            self.send_json(200, {"status": "ok", "mock": True})
            return
        if strip_base_path(route) == "/follow-requests":
            self.list_follow_requests()
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
