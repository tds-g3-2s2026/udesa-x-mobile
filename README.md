# UdeSA-X Mobile

Aplicación mobile principal orientada a los usuarios finales de la red social UdeSA-X.

## Stack

- React Native 0.81 con Expo SDK 54 y TypeScript
- Bun como gestor de paquetes y runner de scripts
- Expo Router para navegación basada en archivos (`app/`), con tabs en el área autenticada
- Zustand para estado global y `expo-secure-store` para el almacenamiento cifrado de la sesión
- Zod para validaciones de formularios y Axios para el acceso a la API
- `expo-splash-screen` para sostener el splash nativo hasta que se lee la sesión
- `@expo/vector-icons` para los íconos de la barra de tabs
- Jest con el preset `jest-expo` para los tests unitarios

## Requisitos

- [Bun](https://bun.sh) 1.1 o superior
- Expo Go en un dispositivo, o Android Studio / Xcode para los emuladores

## Instalación

```bash
bun install
```

## Ejecución con Expo

```bash
bun run start       # Metro bundler y menú de Expo (QR para Expo Go)
bun run android     # Abre la app en el emulador o dispositivo Android
bun run ios         # Abre la app en el simulador de iOS (solo macOS)
bun run web         # Abre la app en el navegador
```

La URL de la API se toma de la variable de entorno `EXPO_PUBLIC_API_URL`. Si no está
definida, la app usa `http://localhost:8000/api`. El sufijo `/api` no es opcional: es el
prefijo bajo el que todos los servicios publican sus endpoints.

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.10:8000/api bun run start
```

En un dispositivo físico hay que usar una dirección alcanzable desde el celular, nunca
`localhost`: la IP en la red local, o la de la tailnet si el celular entra por Tailscale.
Si además el celular carga Metro por la tailnet, hay que decirle a Expo qué URL anunciar,
porque por defecto publica la de la red local:

```bash
EXPO_PACKAGER_PROXY_URL=http://100.x.y.z:8081 bun run start
```

## Probar sin backend

Este mock está verificado contra el código real de `udesa-x-users-api` (registro, login,
logout, verificación de email, cambio y recuperación de contraseña, perfil), así que se
puede probar cualquier pantalla autenticada sin depender de que el servicio real esté
levantado. No tiene dependencias, corre con la biblioteca estándar de Python:

```bash
bun run mock-api                        # escucha en el puerto 8020
python3 scripts/mock-users-api.py 9000  # o el puerto que prefieras
```

Al arrancar imprime las direcciones alcanzables de la máquina, la de la tailnet primero,
con el comando exacto para cada una. Trae una cuenta ya verificada, `@demo` con contraseña
`Password123`, para entrar directo al feed. Un registro nuevo queda sin verificar hasta
pegar el token que el mock imprime en su propia consola (simula el link que llegaría por
mail). Si la app no conecta, el banner incluye una URL de `healthcheck` para abrir en el
navegador del celular y separar un problema de red de uno de la app.

El mock también sirve de contrato: responde con los mismos nombres de campo (snake_case) y
los mismos códigos de error que la API real, así que un cambio ahí sin el equivalente del
otro lado se nota probando.

`udesa-x-posts-api` ya expone seguir y dejar de seguir (`udesa-x-posts-api#22`), pero
todavía no las solicitudes de cuentas protegidas (`udesa-x-posts-api#13`), así que hay un
segundo mock para `GET /follow-requests` y para aprobar o rechazar una solicitud, que es un
servicio aparte con su propia URL:

```bash
bun run mock-posts-api                   # escucha en el puerto 8021
python3 scripts/mock-posts-api.py 9001   # o el puerto que prefieras
```

Usa el mismo token que emite `mock-users-api.py`, así que hay que loguearse ahí primero.
Trae 2 solicitudes pendientes ya cargadas para `@demo`. La URL se toma de
`EXPO_PUBLIC_POSTS_API_URL`, igual que `EXPO_PUBLIC_API_URL` para users-api.

## Checks

```bash
./scripts/lint.sh    # ESLint y Prettier en modo verificación
./scripts/test.sh    # Tests unitarios con Jest
bun x tsc --noEmit   # Chequeo de tipos
bun run format       # Aplica el formato de Prettier
```

### Como los corre el CI: dentro de la imagen

Lo de arriba corre sobre tu máquina. **El CI los corre adentro de una imagen Docker**, para que
el resultado no dependa de cómo esté armada la máquina:

```bash
docker compose -f docker/docker-compose.dev.yml run --rm --build tests
```

El `--build` no es opcional: sin él, el compose corre la imagen cacheada y podrías estar
verificando código viejo.

Ese `Dockerfile` **existe solo para los tests**. La app se distribuye por Expo y no despliega
ningún contenedor, así que no tiene stage de producción: lo único que fija es el entorno donde
corre la suite. La versión de Bun está en `.bun-version` y en el `Dockerfile`.

**Por qué existe el `moduleNameMapper` de `@react-navigation`.** Esos paquetes publican
únicamente un build ESM, con un `{"type":"module"}` anidado que Jest, corriendo en CommonJS, se
niega a `require`. También publican su código fuente, y el mapeo apunta ahí para que Babel lo
compile.

Sin eso la suite **fallaba en Linux y pasaba en Windows**: Jest no encuentra ese `package.json`
anidado en Windows y trata el archivo como CommonJS. Nadie lo había notado porque nunca se
habían corrido los tests fuera de una máquina Windows.

## Sesión, splash y refresco de token

Al arrancar, `app/_layout.tsx` sostiene el splash nativo con `expo-splash-screen` mientras
lee la sesión guardada en `expo-secure-store`, y lo esconde cuando ya sabe qué grupo de
navegación montar: nunca se ve un cuadro de la pantalla equivocada.

El `apiClient` de Axios lleva dos interceptores. El de request agrega
`Authorization: Bearer <accessToken>` leyendo el store en cada llamada. El de response
atiende los 401 pidiendo un token nuevo — pero `users-api` todavía no expone
`POST /auth/refresh` (está en su propio backlog, no es parte de este repo): sin
`refreshToken` guardado, el intento de refrescar falla de inmediato, se borra la sesión del
dispositivo y las guardas del layout raíz devuelven al login. El mecanismo de refresco ya
está escrito y lo único que falta es que el otro lado exista — `AuthTokens.refreshToken` es
opcional a propósito, para el día que lo sea.

## Estructura

```
app/                      Rutas de Expo Router
  _layout.tsx             Sostiene el splash, restaura la sesión y monta el grupo permitido
  (auth)/                 Login y verificación de email
  (auth)/register/        Wizard de registro: un paso por ruta
  (app)/_layout.tsx       Barra de tabs del área autenticada
  (app)/index.tsx         Tab Inicio: el feed
  (app)/search.tsx        Tab Buscar
  (app)/notifications.tsx Tab Notificaciones
  (app)/profile.tsx       Tab Perfil: datos de la sesión y cierre de sesión
scripts/                  Checks y mocks locales de users-api y posts-api
src/api/                  Clientes Axios de cada servicio (apiClient, postsApiClient)
src/features/auth/        Esquemas Zod, servicio de autenticación y componentes de formulario
src/features/shell/       Chrome compartido por las pantallas de los tabs
src/features/social/      Servicio del grafo social (solicitudes de seguimiento)
src/stores/               Estado global (sesión, tema y borrador del registro)
src/theme/                Paletas claro/oscuro y el hook de lectura
src/types/                Tipos compartidos
tests/unit/               Tests unitarios trazados a los criterios de aceptación
```

## Trazabilidad de criterios de aceptación

Cada criterio de aceptación de [`CONSIGNA.md`](../udesa-x-platform/docs/CONSIGNA.md) tiene al
menos un test que lo referencia por identificador, así que la verificación se hace filtrando
la suite:

```bash
bun run test -- -t "E1-H1.CA3"
```

| Criterio    | Qué verifica                                                        | Archivo                                                                                                                |
| ----------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `E1-H1.CA2` | Formato de email y error de email duplicado en pantalla             | `tests/unit/authSchemas.test.ts`, `tests/unit/authService.test.ts`, `tests/unit/authScreens.test.tsx`                  |
| `E1-H1.CA3` | Handle con `@` inicial, entre 4 y 15 caracteres alfanuméricos o `_` | `tests/unit/authSchemas.test.ts`, `tests/unit/authScreens.test.tsx`                                                    |
| `E1-H1.CA4` | Contraseña de 8 caracteres o más, con mayúscula y número            | `tests/unit/authSchemas.test.ts`                                                                                       |
| `E1-H1.CA5` | Campos obligatorios no vacíos en registro y login                   | `tests/unit/authSchemas.test.ts`, `tests/unit/authScreens.test.tsx`                                                    |
| `E1-H1.CA6` | Token de verificación pegado del link, y reenvío del link           | `tests/unit/authSchemas.test.ts`, `tests/unit/authService.test.ts`, `tests/unit/authScreens.test.tsx`                  |
| `E1-H2.CA1` | Login válido, tokens recibidos y sesión persistida en SecureStore   | `tests/unit/authService.test.ts`, `tests/unit/authStore.test.ts`, `tests/unit/authScreens.test.tsx`                    |
| `E1-H2.CA3` | Mensaje genérico de credenciales inválidas                          | `tests/unit/authService.test.ts`, `tests/unit/authScreens.test.tsx`                                                    |
| `E1-H3.CA2` | Borrado seguro del JWT y de los datos locales de sesión             | `tests/unit/authStore.test.ts`, `tests/unit/authScreens.test.tsx`, `tests/unit/navigationGuards.test.tsx`              |
| `T-51`      | Los cuatro tabs del área autenticada y el contenido de cada uno     | `tests/unit/appTabs.test.tsx`                                                                                          |
| `T-52`      | Refresco de token, interceptores de Axios y renovación en el store  | `tests/unit/authInterceptors.test.ts`, `tests/unit/authService.test.ts`, `tests/unit/authStore.test.ts`                |
| `E3-H1.CA1` | El botón Seguir sigue a una cuenta pública y refleja el estado      | `tests/unit/followService.test.ts`, `tests/unit/followButton.test.tsx`                                                 |
| `E3-H1.CA2` | Listar, aprobar y rechazar solicitudes de seguimiento pendientes    | `tests/unit/followService.test.ts`, `tests/unit/followRequestsScreen.test.tsx`, `tests/unit/navigationGuards.test.tsx` |
| `E3-H1.CA3` | El mensaje de la API al intentar seguirse a uno mismo llega a la UI | `tests/unit/followService.test.ts`                                                                                     |
| `E3-H1.CA5` | El mensaje de rate limit de la API llega a la UI                    | `tests/unit/followService.test.ts`, `tests/unit/followButton.test.tsx`                                                 |

Los criterios que dependen enteramente del backend, sin nada que mobile pueda probar por su
cuenta (`E1-H1.CA1`, `E1-H1.CA7`, `E1-H2.CA2`, `E1-H2.CA4`, `E1-H2.CA5`, `E1-H3.CA1`,
`E3-H1.CA4`) se verifican en `udesa-x-users-api` o `udesa-x-posts-api` según corresponda. Las
demás CA de `E3-H1` de la tabla de arriba son reglas del servicio (a quién se puede seguir,
límites, mensajes de error): lo que se prueba acá es que mobile llama a la ruta correcta y
muestra lo que la API responde, no la regla en sí.

`FollowButton` (`src/features/social/components/FollowButton.tsx`) sigue y deja de seguir
contra `posts-api` real (`udesa-x-posts-api#22`, ya mergeado), pero ninguna pantalla lo usa
todavía: la pantalla del perfil de otro usuario es `E2-H14`, sin empezar. El estado
`Solicitado` tampoco es alcanzable: `udesa-x-posts-api#13` (cuentas protegidas) sigue sin
implementarse, así que seguir una cuenta protegida da un error explícito en vez de una
solicitud.

## Code Guidelines (Reglas del Equipo)

Para mantener la calidad y consistencia del código, todos los miembros deben seguir estas reglas:

- **Ramas:** Obligatorio usar la convención `feature-[nombre-de-la-funcionalidad]` o `fix-[fix-a-realizar]`. Toda rama se integra a `main`.
- **Issues:** Todas las ramas deben tener un issue asociado con la información necesaria para implementar la tarea.
- **Etiquetas (Labels):** Los issues deben clasificarse usando `feature`, `tech debt`, `spike`, o `bug`.
- **Pull Requests (PR):** Las descripciones de los PR deben redactarse en **español**.
- **Idioma del código:** En inglés todo lo que vive dentro de un archivo de código (variables, funciones, clases, tablas, comentarios y docstrings) y los nombres de los archivos y carpetas de código. En español la documentación, los mensajes de commit y las descripciones de PR.
- **Commits (Opcional):** Recomendamos usar la convención de [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
