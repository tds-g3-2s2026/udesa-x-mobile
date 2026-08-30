# AGENTS.md - udesa-x-mobile

<!-- INICIO BLOQUE PROPIO - completado en cada servicio -->

App mobile de UdeSA-X para usuarios finales. Cubre las épicas E1 (usuarios), E2 (publicaciones), E3 (interacciones sociales) y E4 (notificaciones); E5 vive en el backoffice.

## Mapa del repo

```
app/                  rutas de Expo Router, una carpeta por segmento de navegación
  (auth)/             login, registro, recuperación de contraseña
  (tabs)/             navegación autenticada: feed, búsqueda, notificaciones, perfil
  _layout.tsx         layout raíz, providers de TanStack Query y de sesión
src/
  api/                clientes HTTP por servicio, tipos de request y response
  components/         componentes de UI reutilizables, sin lógica de negocio
  features/           lógica por dominio: users, posts, social, notifications
  hooks/              hooks compartidos
  stores/             stores de Zustand
  lib/                utilidades transversales, configuración y acceso a secure store
tests/unit/           unitarios y de componentes
.maestro/             flujos E2E
```

Regla de capas: los archivos de `app/` resuelven navegación y composición de pantalla. La lógica de negocio y las llamadas de red viven en `src/features/` y `src/api/`. Una ruta que llama a `fetch` directamente es un error de revisión.

## Stack y herramientas

- Runtime y framework: Expo SDK 57 sobre React Native, con TypeScript
- Navegación: Expo Router, rutas derivadas del árbol de `app/`
- Estado del servidor: TanStack Query
- Estado del cliente: Zustand
- Tokens y credenciales: `expo-secure-store`. Nunca AsyncStorage para datos de sesión
- Tests unitarios y de componentes: Jest con React Native Testing Library 14
- Tests E2E: Maestro

## Checks y comandos

```bash
npm run lint             # ESLint y chequeo de tipos de TypeScript
npm test                 # Unitarios y de componentes, con reporte de cobertura
maestro test .maestro/   # E2E sobre emulador o dispositivo
```

**Cobertura mínima: 85%.** En este repo el gate se activa en **S5**, no en S3: S3 aplica a los servicios de backend. Hasta S5 la cobertura se mide y se reporta, pero no bloquea el PR.

## Arquitectura y particularidades locales

- El proyecto de Expo todavía no está inicializado: no hay `package.json`, `app/` ni `src/`. El scaffolding llega con `T-51` (navegación principal y estructura de tabs, S2) y el sistema de componentes con `T-19` (S3). Hasta entonces los comandos de arriba no corren.
- Documentación general del sistema: `../udesa-x-platform/docs/` (`ARQUITECTURA.md`, `CONVENCIONES.md`, `PLANIFICACION.md`).

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
