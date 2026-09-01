#!/usr/bin/env python3
"""Mock de los endpoints de autenticación de users-api.

Existe para poder recorrer las pantallas autenticadas de la app mientras
udesa-x-users-api solo expone /healthcheck. No es parte de la aplicación: es una
herramienta de desarrollo local y se borra cuando la API real implemente
/api/v1/auth/*.

Además de desbloquear las pruebas, este archivo es el contrato que la API real
tiene que cumplir: los dos clientes TypeScript (mobile y backoffice) leen campos
en camelCase, así que users-api necesita un alias generator en Pydantic y no
snake_case crudo.

Uso:
    python3 scripts/mock-users-api.py [puerto]

Sin dependencias: solo biblioteca estándar.
"""

from __future__ import annotations

import json
import socket
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import count
from typing import Any

BASE_PATH = "/api/v1"
# La app puede apuntar al mock con o sin el prefijo /api, así que las dos formas
# resuelven al mismo endpoint.
BASE_PATHS = (BASE_PATH, "/v1")
# 8000 es el puerto documentado de users-api, pero suele estar tomado por otro
# servicio local. El puerto se puede pasar como primer argumento.
DEFAULT_PORT = 8020

# Cualquier registro nuevo se verifica con este código.
VERIFICATION_CODE = "123456"

# Cuenta ya verificada, para entrar al feed sin pasar por el registro.
DEMO_EMAIL = "demo@udesa.edu.ar"
DEMO_HANDLE = "@demo"
DEMO_PASSWORD = "Password123"

# Almacén en memoria: {email: {"user": {...}, "password": "..."}}.
# Se pierde al cortar el proceso, que es lo que queremos de un mock.
accounts: dict[str, dict[str, Any]] = {}

# Prefijo de los refresh tokens que emite el mock: el handle viaja adentro, así el
# refresco no necesita una tabla de sesiones.
REFRESH_TOKEN_PREFIX = "mock-refresh-token-"

# Cada emisión lleva un número distinto, así se ve en la app que el token cambió
# después de un refresco.
token_issues = count(1)


def build_user(handle: str, email: str, full_name: str, is_verified: bool) -> dict[str, Any]:
    return {
        "id": f"usr-{len(accounts) + 1}",
        "handle": handle,
        "email": email,
        "fullName": full_name,
        "isVerified": is_verified,
    }


def find_account(identifier: str) -> dict[str, Any] | None:
    """Busca por email o por handle, con o sin @ inicial."""
    needle = identifier.strip().lower()
    if needle in accounts:
        return accounts[needle]

    handle = needle if needle.startswith("@") else f"@{needle}"
    for account in accounts.values():
        if account["user"]["handle"].lower() == handle:
            return account
    return None


def strip_base_path(route: str) -> str | None:
    """Ruta sin el prefijo de versión, o None si no es una ruta de la API."""
    for base in BASE_PATHS:
        if route.startswith(base):
            return route[len(base) :]
    return None


def issue_tokens(handle: str) -> dict[str, str]:
    """Par de tokens nuevo para una cuenta."""
    bare = handle.lstrip("@")
    serial = next(token_issues)
    return {
        "accessToken": f"mock-access-token-{bare}-{serial}",
        "refreshToken": f"{REFRESH_TOKEN_PREFIX}{bare}-{serial}",
    }


def handle_from_refresh_token(token: str) -> str | None:
    """Handle codificado en un refresh token emitido por este mock."""
    if not token.startswith(REFRESH_TOKEN_PREFIX):
        return None
    # El handle solo admite letras, números y guiones bajos, así que el último
    # guion siempre separa el número de emisión.
    handle = token[len(REFRESH_TOKEN_PREFIX) :].rsplit("-", 1)[0]
    return handle or None


class AuthHandler(BaseHTTPRequestHandler):
    # Content-Length va en todas las respuestas, así que keep-alive es seguro.
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        route = self.path.split("?")[0]
        if route == "/healthcheck" or strip_base_path(route) == "/healthcheck":
            self.send_json(200, {"status": "ok", "mock": True})
            return
        self.send_problem(404, "Ruta no encontrada", f"{self.path} no existe en el mock.")

    def do_POST(self) -> None:
        route = self.path.split("?")[0]
        endpoint_path = strip_base_path(route)
        if endpoint_path is None:
            self.send_problem(404, "Ruta no encontrada", f"{route} no existe en el mock.")
            return

        if endpoint_path == "/auth/logout":
            self.logout()
            return

        body = self.read_json()
        if body is None:
            self.send_problem(400, "Cuerpo inválido", "Se esperaba un objeto JSON.")
            return

        endpoints = {
            "/auth/register": self.register,
            "/auth/login": self.login,
            "/auth/verify-email": self.verify_email,
            "/auth/resend-verification": self.resend_verification,
            "/auth/refresh": self.refresh,
        }
        endpoint = endpoints.get(endpoint_path)
        if endpoint is None:
            self.send_problem(404, "Ruta no encontrada", f"{route} no existe en el mock.")
            return
        endpoint(body)

    def register(self, body: dict[str, Any]) -> None:
        email = str(body.get("email", "")).strip().lower()
        handle = str(body.get("handle", "")).strip()
        full_name = str(body.get("fullName", "")).strip()

        if not email or not handle or not full_name:
            self.send_problem(422, "Datos incompletos", "Faltan campos obligatorios.")
            return
        # users-api expects this one field in snake_case, unlike the rest of
        # the contract (confirmed against their actual code, no camelCase
        # alias exists for it).
        if body.get("terms_accepted") is not True:
            self.send_problem(
                422, "Términos no aceptados", "Hay que aceptar los términos y la política de privacidad."
            )
            return
        if email in accounts:
            self.send_problem(409, "Correo en uso", "El correo ya está registrado")
            return
        if find_account(handle) is not None:
            self.send_problem(409, "Usuario en uso", "Ese nombre de usuario ya está en uso")
            return

        user = build_user(handle, email, full_name, is_verified=False)
        accounts[email] = {"user": user, "password": str(body.get("password", ""))}
        print(f"    registro de {handle} <{email}>: el código es {VERIFICATION_CODE}")

        self.send_json(
            201,
            {
                "user": user,
                "message": "Registro exitoso. Revisá tu correo.",
                "requireVerification": True,
            },
        )

    def verify_email(self, body: dict[str, Any]) -> None:
        account = find_account(str(body.get("email", "")))
        if account is None:
            self.send_problem(404, "Cuenta inexistente", "No hay una cuenta con ese correo.")
            return
        if str(body.get("code", "")) != VERIFICATION_CODE:
            self.send_problem(
                400, "Código inválido", "El código es inválido o expiró. Pedí uno nuevo."
            )
            return

        account["user"]["isVerified"] = True
        self.send_json(200, {"verified": True})

    def resend_verification(self, body: dict[str, Any]) -> None:
        account = find_account(str(body.get("email", "")))
        if account is None:
            self.send_problem(404, "Cuenta inexistente", "No hay una cuenta con ese correo.")
            return
        print(f"    reenvío a <{account['user']['email']}>: el código es {VERIFICATION_CODE}")
        self.send_json(200, {"sent": True})

    def login(self, body: dict[str, Any]) -> None:
        account = find_account(str(body.get("identifier", "")))
        password = str(body.get("password", ""))

        # Mismo mensaje para usuario inexistente y contraseña equivocada: sin
        # enumeración de usuarios.
        if account is None or account["password"] != password:
            self.send_problem(401, "Credenciales inválidas", "Credenciales inválidas")
            return
        if not account["user"]["isVerified"]:
            self.send_problem(
                403,
                "Cuenta sin verificar",
                "Tenés que verificar tu correo antes de iniciar sesión.",
            )
            return

        self.send_json(
            200,
            {
                "user": account["user"],
                "tokens": issue_tokens(account["user"]["handle"]),
            },
        )

    def refresh(self, body: dict[str, Any]) -> None:
        """Renueva el par de tokens. El usuario no cambia, así que no se devuelve."""
        handle = handle_from_refresh_token(str(body.get("refreshToken", "")).strip())
        account = find_account(handle) if handle else None
        if account is None:
            self.send_problem(
                401, "Sesión expirada", "El refresh token no es válido. Iniciá sesión de nuevo."
            )
            return
        self.send_json(200, {"tokens": issue_tokens(account["user"]["handle"])})

    def logout(self) -> None:
        """Revoca el token del header Authorization. Sin cuerpo, así que no
        pasa por read_json como el resto de los endpoints."""
        auth_header = self.headers.get("Authorization", "")
        token = auth_header[len("Bearer ") :].strip() if auth_header.startswith("Bearer ") else ""
        if not token:
            self.send_problem(401, "Token inválido", "invalid-token")
            return
        # El mock no mantiene una lista de revocación: alcanza con responder 204,
        # que es lo único que el cliente observa (idempotente, igual que la API real).
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def read_json(self) -> dict[str, Any] | None:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            parsed = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    def send_json(
        self, status: int, payload: dict[str, Any], content_type: str = "application/json"
    ) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def send_problem(self, status: int, title: str, detail: str) -> None:
        """Error en formato Problem Details, como pide ARQUITECTURA.md."""
        self.send_json(
            status,
            {"type": "about:blank", "title": title, "status": status, "detail": detail},
            content_type="application/problem+json",
        )

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        sys.stdout.write(f"  {format % args}\n")
        sys.stdout.flush()


def lan_address() -> str:
    """IP de esta máquina en la red local."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return str(probe.getsockname()[0])
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def tailnet_hosts() -> list[str]:
    """IP y nombre MagicDNS en la tailnet, si Tailscale está corriendo.

    Un celular conectado por Tailscale no llega a la IP de la red local, así que
    esta es la dirección que hay que usar en ese caso.
    """
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
    # Solo IPv4: es la que entienden todas las redes móviles.
    hosts = [address for address in node.get("TailscaleIPs", []) if ":" not in address]

    dns_name = str(node.get("DNSName", "")).rstrip(".")
    if dns_name and (status.get("CurrentTailnet") or {}).get("MagicDNSEnabled"):
        hosts.append(dns_name)
    return hosts


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    accounts[DEMO_EMAIL] = {
        "user": build_user(DEMO_HANDLE, DEMO_EMAIL, "Demo UdeSA", is_verified=True),
        "password": DEMO_PASSWORD,
    }

    # Se bindea antes de imprimir: si el puerto está tomado, el mensaje útil es
    # el del error y no un banner de un servidor que nunca arrancó.
    try:
        server = ThreadingHTTPServer(("0.0.0.0", port), AuthHandler)
    except OSError as error:
        print(f"No se pudo escuchar en el puerto {port}: {error}")
        print(f"Probá con otro: python3 scripts/mock-users-api.py {port + 1}")
        raise SystemExit(1) from error

    # La tailnet va primero: si el celular entra por Tailscale, la IP de la red
    # local no le sirve.
    hosts = [(host, "tailnet") for host in tailnet_hosts()]
    hosts.append((lan_address(), "red local"))

    print(f"Mock de users-api escuchando en 0.0.0.0:{port}\n")
    print("Levantá la app apuntando acá:")
    for host, network in hosts:
        print(f"  # {network}")
        print(f"  EXPO_PUBLIC_API_URL=http://{host}:{port}{BASE_PATH} bun run start")
    print()
    print("Si la app no conecta, abrí esto en el navegador del celular:")
    print(f"  http://{hosts[0][0]}:{port}/healthcheck\n")
    print("Cuenta ya verificada, para entrar directo al feed:")
    print(f"  usuario {DEMO_HANDLE} o {DEMO_EMAIL}")
    print(f"  contraseña {DEMO_PASSWORD}\n")
    print(f"Código de verificación de cualquier registro nuevo: {VERIFICATION_CODE}\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nMock detenido.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
