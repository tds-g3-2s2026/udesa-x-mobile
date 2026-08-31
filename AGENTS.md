# AGENTS.md - udesa-x-mobile

<!-- INICIO BLOQUE PROPIO - completado en cada servicio -->

Aplicación mobile principal para usuarios de la red social UdeSA-X (Épicas E1 a E4).

## Stack y herramientas

- Framework y runtime: React Native 0.81, Expo SDK 54, React 19, TypeScript, Bun
- Navegación: Expo Router (file-based routing en `app/`), con tabs en el área autenticada
- Estado y almacenamiento seguro: Zustand y expo-secure-store
- Validaciones: Zod. Acceso HTTP: Axios
- Tests: Jest con el preset `jest-expo` y React Native Testing Library

## Checks y comandos

```bash
bun run start           # Inicia el servidor de desarrollo Expo / Metro bundler
bun run mock-api        # Mock local de los endpoints /auth de users-api
./scripts/lint.sh       # Linting con ESLint y Prettier
./scripts/test.sh       # Tests unitarios con Jest
bun x tsc --noEmit      # Chequeo de tipos
```

## Arquitectura y particularidades locales

- Rutas de navegación en `app/` organizadas por grupos: `(auth)` para login y verificación, `(auth)/register/` para el wizard de registro con una ruta por paso, y `(app)` para la experiencia autenticada, que es una barra de tabs con Inicio, Buscar, Notificaciones y Perfil.
- El layout raíz sostiene el splash nativo hasta que lee la sesión y elige el grupo con `Stack.Protected`: no hay redirecciones imperativas después de iniciar o cerrar sesión.
- Lógica de dominio, servicios de red y esquemas en `src/features/` y stores globales en `src/stores/`.
- El `apiClient` de `src/features/auth/services/authService.ts` tiene los interceptores de Axios: agrega el `Bearer` de la sesión y refresca el token ante un 401.
- `users-api` todavía no expone `/auth`: para recorrer las pantallas autenticadas se usa `bun run mock-api`.
- Documentación general del sistema: consultar `../udesa-x-platform/docs/` (`ARQUITECTURA.md`, `CONVENCIONES.md`, `PLANIFICACION.md`).

<!-- FIN BLOQUE PROPIO -->

<!-- INICIO BLOQUE COMUN - sincronizado desde udesa-x-platform, no editar la copia local -->

## Reglas del equipo

- **Ramas e issues**: Rama base `main`. Ramas de trabajo `feature-<nombre>` (funcionalidad), `fix-<nombre>` (defecto) o `chore-<nombre>` (mantenimiento y tooling, etiqueta `tech debt`), siempre asociadas a un issue en el mismo repositorio.
- **Idiomas**:
  - Código (`src/`, `tests/`), nombres de archivos, identificadores y comentarios en código: **inglés**.
  - Documentación (`docs/`, `README.md`), mensajes de commit y Pull Requests: **español**.
- **Commits**: Formato Conventional Commits (`feat:`, `fix:`, `docs:`, etc.) con descripción en español.
- **Simplicidad**: Soluciones mínimas y directas para el criterio de aceptación. No introducir librerías, patrones ni abstracciones nuevas sin un ADR aprobado en `docs/adr/`.

## Límites y flujo de trabajo del agente

- El agente inspecciona el repositorio (`git status`, `git diff`), edita archivos en el working tree, ejecuta checks locales y redacta propuestas de commit y PR.
- **El agente nunca commitea, pushea ni abre/aprueba/mergea Pull Requests.** La revisión y confirmación en Git la realiza siempre un integrante del equipo.
- **Sin firmas**: Nunca agregar `Co-Authored-By`, firmas o menciones del agente en commits, PRs ni código.

## Modo de planificación

- Planes extremadamente concisos: priorizar brevedad y concreción por sobre prosa formal.
- Al final de cada plan, incluir la lista de preguntas o dudas pendientes a resolver (si las hay).

## Skills (.agents/skills/)

- `explicar-implementacion`: Genera la explicación detallada del cambio para incluir en la descripción del PR.
- `revisar-pr`: Guía paso a paso para la revisión técnica de Pull Requests.

<!-- FIN BLOQUE COMUN -->
