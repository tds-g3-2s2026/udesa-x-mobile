#!/usr/bin/env python3
"""Mock implementation of the users-api authentication endpoints.

It makes it possible to use the app's authenticated screens while
udesa-x-users-api only exposes /healthcheck. It is a local development tool,
not part of the application, and will be removed once the real API implements
/api/v1/auth/*.

Besides enabling testing, this file specifies the contract the real API must
meet: both TypeScript clients (mobile and backoffice) read camelCase fields, so
users-api needs a Pydantic alias generator instead of raw snake_case.

Usage:
    python3 scripts/mock-users-api.py [port]

No dependencies: standard library only.
"""

from __future__ import annotations

import json
import re
import socket
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import count
from typing import Any

BASE_PATH = "/api/v1"
# The app can point to the mock with or without the /api prefix, so both forms
# resolve to the same endpoint.
BASE_PATHS = (BASE_PATH, "/v1")
# Port 8000 is documented for users-api but is often occupied by another local
# service. The port can be passed as the first argument.
DEFAULT_PORT = 8020

# Every new registration is verified with this code.
VERIFICATION_CODE = "123456"

# Pre-verified account for entering the feed without registering.
DEMO_EMAIL = "demo@udesa.edu.ar"
DEMO_HANDLE = "@demo"
DEMO_PASSWORD = "Password123"

# In-memory store: {email: {"user": {...}, "password": "..."}}.
# It is lost when the process stops, which is the desired mock behavior.
accounts: dict[str, dict[str, Any]] = {}

# Prefix for refresh tokens issued by the mock: the handle travels inside it, so
# refreshing does not need a session table.
REFRESH_TOKEN_PREFIX = "mock-refresh-token-"

# Each issuance has a different number so the app can observe a token changing
# after a refresh.
token_issues = count(1)

# Issued recovery tokens: {token: {"email", "expires_at", "used"}}.
reset_tokens: dict[str, dict[str, Any]] = {}

# Failed password-change attempts per account. This is separate from the login
# lockout: failures here do not block entry to the app.
change_password_attempts: dict[str, int] = {}
CHANGE_PASSWORD_ATTEMPT_LIMIT = 3
CHANGE_PASSWORD_LOCK_SECONDS = 900

# Latest invalidated issuance number per account: {handle without @: serial}.
sessions_revoked_up_to: dict[str, int] = {}

# Times a link was requested per identifier, used for request limiting.
reset_requests: dict[str, list[float]] = {}

RESET_TOKEN_PREFIX = "mock-reset-token-"
# Base for error `type` values, matching users-api: the last segment is the
# identifier used by the client.
ERROR_TYPE_BASE = "https://udesa-x.dev/errors"
# Links last 10 minutes, the maximum defined by the requirement.
RESET_TOKEN_TTL_SECONDS = 600
# Three requests per hour for the same identifier.
RESET_REQUEST_LIMIT = 3
RESET_REQUEST_WINDOW_SECONDS = 3600


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


def password_policy_errors(password: str) -> list[str]:
    """Mensajes de la política de contraseña, en el orden en que los manda la API."""
    messages: list[str] = []
    if len(password) < 8:
        messages.append("String should have at least 8 characters")
    if not re.search(r"[A-Z]", password):
        messages.append("Value error, La contraseña debe tener al menos una mayúscula")
    if not re.search(r"[0-9]", password):
        messages.append("Value error, La contraseña debe tener al menos un número")
    return messages


def is_reset_request_allowed(identifier: str) -> bool:
    """Aplica el límite de pedidos por identificador y registra el intento.

    El contador va por identificador y no por cuenta a propósito: compartirlo
    exigiría resolver el identificador a una cuenta, y ahí el 429 delataría
    cuáles existen, que es justo lo que el mensaje genérico evita.
    """
    now = time.time()
    recent = [
        moment
        for moment in reset_requests.get(identifier, [])
        if now - moment < RESET_REQUEST_WINDOW_SECONDS
    ]
    reset_requests[identifier] = recent
    if len(recent) >= RESET_REQUEST_LIMIT:
        return False
    recent.append(now)
    return True


def issue_reset_token(email: str) -> str:
    """Token de recuperación nuevo, que invalida los que la cuenta tenga abiertos."""
    for token, data in list(reset_tokens.items()):
        if data["email"] == email:
            del reset_tokens[token]

    token = f"{RESET_TOKEN_PREFIX}{next(token_issues)}"
    reset_tokens[token] = {
        "email": email,
        "expires_at": time.time() + RESET_TOKEN_TTL_SECONDS,
        "used": False,
    }
    return token


def split_access_token(token: str) -> tuple[str, int] | None:
    """Handle y número de emisión de un access token emitido por este mock."""
    prefix = "mock-access-token-"
    if not token.startswith(prefix):
        return None
    handle, _, serial = token[len(prefix) :].rpartition("-")
    if not handle or not serial.isdigit():
        return None
    return handle, int(serial)


def is_access_token_revoked(token: str) -> bool:
    """Un token queda revocado si su emisión es anterior al último corte de la cuenta.

    Modela "se revocaron todas las sesiones" sin llevar una tabla de sesiones:
    alcanza con recordar hasta qué número de emisión quedó todo invalidado.
    """
    parts = split_access_token(token)
    if parts is None:
        return False
    handle, serial = parts
    return serial <= sessions_revoked_up_to.get(handle, 0)


_SCRIPT_TAG_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def sanitize_text(value: str) -> str:
    """Approximates the server's sanitizer (nh3): a script tag is removed with
    its content, any other tag is stripped but the text inside it stays."""
    without_scripts = _SCRIPT_TAG_RE.sub("", value)
    return _HTML_TAG_RE.sub("", without_scripts)


def handle_from_refresh_token(token: str) -> str | None:
    """Handle encoded in a refresh token issued by this mock."""
    if not token.startswith(REFRESH_TOKEN_PREFIX):
        return None
    # The handle only permits letters, numbers, and underscores, so the final
    # hyphen always separates the issuance number.
    handle = token[len(REFRESH_TOKEN_PREFIX) :].rsplit("-", 1)[0]
    return handle or None


class AuthHandler(BaseHTTPRequestHandler):
    # Every response includes Content-Length, so keep-alive is safe.
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        route = self.path.split("?")[0]
        if route == "/healthcheck" or strip_base_path(route) == "/healthcheck":
            self.send_json(200, {"status": "ok", "mock": True})
            return
        if strip_base_path(route) == "/me":
            self.get_profile()
            return
        self.send_problem(404, "Ruta no encontrada", f"{self.path} no existe en el mock.")

    def do_PATCH(self) -> None:
        route = self.path.split("?")[0]
        endpoint_path = strip_base_path(route)
        if endpoint_path == "/me":
            self.update_profile()
            return
        self.send_problem(404, "Ruta no encontrada", f"{route} no existe en el mock.")

    def do_POST(self) -> None:
        route = self.path.split("?")[0]
        endpoint_path = strip_base_path(route)
        if endpoint_path is None:
            self.send_problem(404, "Ruta no encontrada", f"{route} no existe en el mock.")
            return

        if endpoint_path == "/auth/logout":
            self.logout()
            return

        if endpoint_path == "/me/change-password":
            self.change_password()
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
            "/auth/forgot-password": self.forgot_password,
            "/auth/reset-password": self.reset_password,
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

        # The same message is used for an unknown user and a wrong password to
        # prevent user enumeration.
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

    def forgot_password(self, body: dict[str, Any]) -> None:
        """Pide un link de recuperación. Responde siempre igual, exista o no la cuenta."""
        identifier = str(body.get("identifier", "")).strip()
        if not identifier:
            self.send_problem(
                422,
                "Datos incompletos",
                "Falta el identificador.",
                code="validation-failed",
                errors=[{"field": "identifier", "message": "Field required"}],
            )
            return

        if not is_reset_request_allowed(identifier.lower()):
            self.send_problem(
                429,
                "Demasiados pedidos",
                "Se pidieron demasiados links de recuperación. Esperá 60 minutos",
                code="too-many-reset-requests",
                extra_headers={"Retry-After": str(RESET_REQUEST_WINDOW_SECONDS)},
            )
            return

        account = find_account(identifier)
        if account is not None:
            token = issue_reset_token(account["user"]["email"])
            print(f"    recuperación de {account['user']['handle']}: el código es {token}")
        else:
            # No account means no token, but the response is the same so the
            # client cannot distinguish the two cases.
            print(f"    recuperación pedida para <{identifier}>: no hay cuenta, no se emite token")

        self.send_json(202, {"status": "accepted"})

    def reset_password(self, body: dict[str, Any]) -> None:
        """Changes a password using a single-use token."""
        token = str(body.get("token", "")).strip()
        password = str(body.get("password", ""))
        confirmation = str(body.get("password_confirmation", ""))

        errors: list[dict[str, str]] = []
        if not token:
            errors.append({"field": "token", "message": "Field required"})
        policy_errors = password_policy_errors(password)
        for message in policy_errors:
            errors.append({"field": "password", "message": message})

        # When the password fails its own validation, suppress the confirmation
        # mismatch notice: the password has to be fixed first, as in the real API.
        if not policy_errors and password != confirmation:
            errors.append(
                {
                    "field": "password_confirmation",
                    "message": "Value error, Las contraseñas no coinciden",
                }
            )
        if errors:
            self.send_problem(
                422,
                "Datos inválidos",
                "Revisá los campos marcados.",
                code="validation-failed",
                errors=errors,
            )
            return

        data = reset_tokens.get(token)
        # The same error is used for missing, expired, or used tokens: the client
        # offers another link request in every case.
        if data is None or data["used"] or time.time() > data["expires_at"]:
            self.send_problem(
                400,
                "No se pudo cambiar la contraseña",
                "El link de recuperación es inválido o expiró. Pedí uno nuevo",
                code="reset-token-invalid",
            )
            return

        account = accounts.get(data["email"])
        if account is None:
            self.send_problem(
                400,
                "No se pudo cambiar la contraseña",
                "El link de recuperación es inválido o expiró. Pedí uno nuevo",
                code="reset-token-invalid",
            )
            return

        if account["password"] == password:
            self.send_problem(
                400,
                "No se pudo cambiar la contraseña",
                "La contraseña nueva tiene que ser distinta de la actual",
                code="password-unchanged",
            )
            return

        account["password"] = password
        data["used"] = True
        print(f"    contraseña cambiada para {account['user']['handle']}")

        self.send_json(200, {"status": "reset", "handle": account["user"]["handle"]})

    def resolve_authenticated_account(self, error_title: str) -> dict[str, Any] | None:
        """Resolves the account from the Authorization header, or sends the
        matching error and returns None. Shared by every endpoint under /me:
        no header or a malformed one (FastAPI's own 401, no `type`), a token
        that does not decode (401 invalid-token), or a session already
        revoked (401 session-revoked).
        """
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer ") or not auth_header[len("Bearer ") :].strip():
            # Without a header, FastAPI produces the 401 instead of the formatter:
            # it has no `type` and is in English. Mirror it for the real API behavior.
            self.send_json(
                401,
                {"detail": "Not authenticated"},
                extra_headers={"WWW-Authenticate": "Bearer"},
            )
            return None

        token = auth_header[len("Bearer ") :].strip()
        parts = split_access_token(token)
        if parts is None:
            self.send_problem(401, error_title, "El token no es válido", code="invalid-token")
            return None
        if is_access_token_revoked(token):
            self.send_problem(
                401,
                "La sesión ya no es válida",
                "Tu sesión se cerró. Iniciá sesión de nuevo",
                code="session-revoked",
            )
            return None

        account = find_account(parts[0])
        if account is None:
            self.send_problem(401, error_title, "El token no es válido", code="invalid-token")
            return None
        return account

    def profile_payload(self, account: dict[str, Any]) -> dict[str, Any]:
        user = account["user"]
        return {
            "id": user["id"],
            "email": user["email"],
            "handle": user["handle"],
            "display_name": account.get("display_name"),
            "bio": account.get("bio"),
        }

    def get_profile(self) -> None:
        account = self.resolve_authenticated_account("No se pudo cargar tu perfil")
        if account is None:
            return
        self.send_json(200, self.profile_payload(account))

    def update_profile(self) -> None:
        account = self.resolve_authenticated_account("No se pudo actualizar tu perfil")
        if account is None:
            return

        body = self.read_json()
        if body is None:
            self.send_problem(400, "Cuerpo inválido", "Se esperaba un objeto JSON.")
            return

        # email and handle are immutable, and the real API rejects them
        # outright rather than ignoring them in silence.
        rejected = [field for field in ("email", "handle") if field in body]
        if rejected:
            self.send_problem(
                422,
                "Datos inválidos",
                "Hay campos que no se pueden modificar.",
                code="validation-failed",
                errors=[
                    {"field": field, "message": "Extra inputs are not permitted"}
                    for field in rejected
                ],
            )
            return

        errors: list[dict[str, str]] = []

        display_name: str | None = None
        if "display_name" in body:
            raw_name = body["display_name"]
            if raw_name is None:
                errors.append(
                    {
                        "field": "display_name",
                        "message": "Value error, El nombre visible no puede quedar vacío",
                    }
                )
            # Measured on the raw input, same as the real API — a value that
            # only goes over the limit once sanitized is still fine.
            elif len(str(raw_name)) > 50:
                errors.append(
                    {"field": "display_name", "message": "String should have at most 50 characters"}
                )
            else:
                display_name = sanitize_text(str(raw_name))
                if not display_name.strip():
                    errors.append(
                        {
                            "field": "display_name",
                            "message": "Value error, El nombre visible no puede quedar vacío",
                        }
                    )

        bio: str | None = None
        if "bio" in body:
            raw_bio = body["bio"]
            if raw_bio is not None:
                if len(str(raw_bio)) > 160:
                    errors.append(
                        {"field": "bio", "message": "String should have at most 160 characters"}
                    )
                else:
                    bio = sanitize_text(str(raw_bio))

        if errors:
            self.send_problem(
                422,
                "Datos inválidos",
                "Revisá los campos marcados.",
                code="validation-failed",
                errors=errors,
            )
            return

        if "display_name" in body:
            account["display_name"] = display_name
        if "bio" in body:
            account["bio"] = bio

        self.send_json(200, self.profile_payload(account))

    def change_password(self) -> None:
        """Changes the active session password and revokes all sessions.

        This is the only endpoint that checks revocation, as in the real API:
        /auth/logout still accepts an already revoked token.
        """
        account = self.resolve_authenticated_account("No se pudo cambiar la contraseña")
        if account is None:
            return

        body = self.read_json()
        if body is None:
            self.send_problem(400, "Cuerpo inválido", "Se esperaba un objeto JSON.")
            return

        current = str(body.get("current_password", ""))
        password = str(body.get("password", ""))
        confirmation = str(body.get("password_confirmation", ""))

        errors: list[dict[str, str]] = []
        if not current:
            errors.append({"field": "current_password", "message": "Field required"})

        policy_errors = password_policy_errors(password)
        for message in policy_errors:
            errors.append({"field": "password", "message": message})
        if not policy_errors and password != confirmation:
            errors.append(
                {
                    "field": "password_confirmation",
                    "message": "Value error, Las contraseñas no coinciden",
                }
            )
        if errors:
            self.send_problem(
                422,
                "Datos inválidos",
                "Revisá los campos marcados.",
                code="validation-failed",
                errors=errors,
            )
            return

        handle = account["user"]["handle"]
        # Check the limit before the password: once the limit is reached, a
        # correct password does not matter.
        if change_password_attempts.get(handle, 0) >= CHANGE_PASSWORD_ATTEMPT_LIMIT:
            self.send_problem(
                429,
                "Demasiados intentos",
                "Erraste la contraseña actual demasiadas veces. Volvé a intentar el cambio en 15 minutos",
                code="too-many-password-attempts",
                extra_headers={"Retry-After": str(CHANGE_PASSWORD_LOCK_SECONDS)},
            )
            return

        if account["password"] != current:
            change_password_attempts[handle] = change_password_attempts.get(handle, 0) + 1
            # This is 400, not 401: the token is valid and a form field failed.
            # A 401 would make the client treat it as an expired session.
            self.send_problem(
                400,
                "No se pudo cambiar la contraseña",
                "La contraseña actual no es correcta",
                code="invalid-current-password",
            )
            return

        if password == current:
            self.send_problem(
                400,
                "No se pudo cambiar la contraseña",
                "La contraseña nueva tiene que ser distinta de la actual",
                code="password-unchanged",
            )
            return

        account["password"] = password
        change_password_attempts.pop(handle, None)
        # Every session issued so far becomes invalid, including the one that
        # made this request.
        sessions_revoked_up_to[handle.lstrip("@")] = parts[1]
        print(f"    contraseña cambiada desde la sesión de {handle}")

        self.send_json(200, {"status": "changed"})

    def logout(self) -> None:
        """Revokes the Authorization header token without reading a request body."""
        auth_header = self.headers.get("Authorization", "")
        token = auth_header[len("Bearer ") :].strip() if auth_header.startswith("Bearer ") else ""
        if not token:
            # users-api formats invalid-token 401s with a Spanish `type` and text.
            # FastAPI generates missing or malformed-header 401s without `type` in
            # English; the mock does not distinguish them because the app swallows
            # every logout error.
            self.send_problem(
                401,
                "No se pudo cerrar la sesión",
                "El token no es válido",
                code="invalid-token",
            )
            return
        # The mock does not keep a revocation list: replying 204 is sufficient,
        # since that is all the client observes (idempotent, like the real API).
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def read_json(self) -> dict[str, Any] | None:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            parsed = json.loads(raw or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            # json.loads decodes the bytes before parsing them; malformed UTF-8
            # fails there with UnicodeDecodeError, a different exception than
            # the JSON syntax error this was already handling.
            return None
        return parsed if isinstance(parsed, dict) else None

    def send_json(
        self,
        status: int,
        payload: dict[str, Any],
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
        errors: list[dict[str, str]] | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        """Sends a Problem Details error as required by ARQUITECTURA.md.

        `code` identifies the failure so the client can choose a response
        without reading text, and travels inside `type`. `errors` contains one
        rejected field per entry.
        """
        payload: dict[str, Any] = {
            # RFC 9457 puts the error identifier in the final `type` segment.
            # The real API sends no separate `code` field, so the client reads it here.
            "type": f"{ERROR_TYPE_BASE}/{code}" if code else "about:blank",
            "title": title,
            "status": status,
            "detail": detail,
        }
        if errors is not None:
            payload["errors"] = errors
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
    """IP address of this machine on the local network."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return str(probe.getsockname()[0])
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def tailnet_hosts() -> list[str]:
    """IP and MagicDNS name in the tailnet when Tailscale is running.

    A phone connected through Tailscale cannot reach the local-network IP, so
    this is the address to use in that case.
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
    # IPv4 only: it is supported by every mobile network.
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

    # Bind before printing: if the port is occupied, show the useful error rather
    # than a banner for a server that never started.
    try:
        server = ThreadingHTTPServer(("0.0.0.0", port), AuthHandler)
    except OSError as error:
        print(f"No se pudo escuchar en el puerto {port}: {error}")
        print(f"Probá con otro: python3 scripts/mock-users-api.py {port + 1}")
        raise SystemExit(1) from error

    # Tailnet comes first: a phone connecting through Tailscale cannot use the
    # local-network IP.
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
