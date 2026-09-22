# NEXO Intel — Frontend

Consola web para analistas SOC que hace visible y auditable la cadena **indicador → entidad → técnica ATT&CK → evidencia** que genera [NEXO-BACKEND](https://github.com/NEXO-FDSI/NEXO-BACKEND), con controles para que el analista acepte o rechace cada asociación propuesta.

Proyecto del curso **Seminario de Seguridad de la Información 2026-2**, Escuela Colombiana de Ingeniería Julio Garavito.

> Repo hermano: [`NEXO-BACKEND`](https://github.com/NEXO-FDSI/NEXO-BACKEND.git), la API que consume este frontend. Se ejecutan por separado, no como monorepo.

## Contexto académico

| | |
|---|---|
| Asignatura | Fundamentos de Seguridad de la Información |
| Grupo | Grupo 2 |
| Profesor | Diego Alexander López Correa |
| Integrantes | Daniel Alexander Ahumada León · Daniel Ricardo Ruge Gómez · David Alejandro Patacón Henao · David Santiago Cajamarca Cadena |

## Qué hace

| Paso | Endpoint del backend | En la interfaz |
|---|---|---|
| 1. Ingesta | `POST /indicators` | Formulario por tipo (IP, dominio, hash, URL). Acepta valores *defanged* y muestra la forma canónica que devuelve el backend. 422 y 409 se explican en el formulario |
| 2. Enriquecimiento | `POST /indicators/{id}/enrich` | Evidencia OTX, pulses (con los volcados agregados que la correlación descarta), validaciones de OTX (whitelist, falso positivo) y la respuesta cruda. Un **502 nunca se muestra como "sin evidencia"** |
| 3. Correlación | `POST /indicators/{id}/correlate` | Cadena de evidencia en dos etapas: si la entidad no se resuelve, se declara "sin asociación" y la etapa de técnicas no se ejecuta. Técnicas agrupadas por táctica en el orden oficial de ATT&CK 19.1, con enlace a attack.mitre.org |
| 4. Informe | `POST /indicators/{id}/report` | Informe Markdown renderizado de forma segura, con versiones (cada regeneración es una fila nueva), copia y descarga `.md`. Contador de espera para el LLM (hasta ~60 s) |
| 5. Validación | `POST /reports/{id}/validate` | Decisión aceptar/rechazar con analista opcional e historial auditable por informe |
| Estado | `GET /health` | Indicador "API en línea" en la barra superior, consultado cada 30 s |

Cada paso se puede ejecutar a mano (como lo diseñó el backend, un endpoint por paso) o con **Análisis completo**, que encadena enriquecimiento, correlación e informe y se detiene en el primer fallo.

### Historial local

El backend no expone endpoints de consulta (`GET`), así que la interfaz guarda en `localStorage` el resultado de cada paso por investigación. Sin la respuesta cruda de OTX, que puede pesar cientos de KB; se recarga desde la caché del backend sin volver a consultar OTX. Si el backend responde 404 (por ejemplo, porque se reinició la base de datos), la investigación se marca como inexistente y se puede quitar del historial.

## Stack

- React 19 + TypeScript + Vite
- CSS Modules con *design tokens* (`src/index.css`); tipografía Fira Sans / Fira Code autoalojada
- `react-markdown` + `remark-gfm` para el informe (no interpreta HTML crudo)
- Vitest + Testing Library, con cobertura mínima del 90 % exigida en la configuración
- oxlint

## Arquitectura

```
src/
├── api/           # contratos del backend (types.ts), fetch con timeout y errores tipados (http.ts), un método por endpoint (nexo.ts)
├── domain/        # lógica pura: pasos del pipeline, lectura defensiva de OTX, tácticas ATT&CK, confianza, mensajes de error
├── state/         # reducer puro, acciones asíncronas con candado por investigación, persistencia local, contexto
├── hooks/         # useHealth, useElapsedSeconds
├── components/
│   ├── ui/        # primitivas accesibles: Button, Badge, Panel, Alert, Tabs, EmptyState, ConfidenceMeter, CopyButton
│   ├── layout/    # barra superior y marca
│   ├── sidebar/   # formulario de ingesta e historial
│   ├── dashboard/ # KPIs y bienvenida
│   └── case/      # detalle: stepper, cadena de evidencia y una pestaña por paso
└── test/          # backend simulado sobre fetch y fixtures con la forma exacta de las respuestas reales
```

- Los componentes no llaman a `fetch`: usan las acciones del contexto, que traducen cada respuesta en una acción del reducer. Cada resultado actualiza los datos y libera el paso en curso en una sola transición.
- Un candado por indicador impide ejecutar dos pasos a la vez sobre la misma investigación.
- Toda regla que depende del backend (tipos, orden de pasos, códigos de error) está documentada junto al código con referencia al archivo del backend.

## Requisitos previos

- Node.js 24
- NEXO-BACKEND corriendo y con el origen del frontend en `CORS_ORIGINS` (p. ej. `http://localhost:5173`)

## Instalación y ejecución

```bash
npm install
cp .env.example .env.local   # VITE_API_URL=http://localhost:8000
npm run dev                  # http://localhost:5173
```

Si `VITE_API_URL` no está definida se usa `http://localhost:8000`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de producción |
| `npm run test` | Suite completa (Vitest) |
| `npm run coverage` | Suite con cobertura; falla por debajo del 90 % |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |

La integración continua (`.github/workflows/ci.yml`) corre lint, typecheck, cobertura y build en cada push a `main` y en cada PR.

## Pruebas

Las pruebas no tocan la red: `src/test/fakeBackend.ts` reemplaza `fetch` por un NEXO-BACKEND en memoria, y `src/test/fixtures.ts` reproduce las respuestas reales documentadas en el backend (escenario 1: WannaCry; escenario 5: 8.8.8.8 benigno). Cubren el flujo completo, los errores 400/404/409/422/502, el 500 sin CORS, los timeouts, la persistencia local y la accesibilidad por teclado de las pestañas.

## Docker

La URL del backend se incrusta en el build, así que se pasa al construir la imagen:

```bash
docker build --build-arg VITE_API_URL=http://localhost:8000 -t nexo-intel-frontend .
docker run -p 8080:80 nexo-intel-frontend
```

El backend debe incluir `http://localhost:8080` en `CORS_ORIGINS`.

## Limitaciones conocidas

- Sin autenticación ni multiusuario, igual que el backend (fuera del alcance del prototipo).
- El historial vive solo en el navegador que lo generó. Si un indicador ya registrado desde otro navegador da 409, la API no permite recuperarlo por valor.
- Un error 500 del backend llega sin cabeceras CORS, así que el navegador lo reporta como fallo de red; la interfaz lo explica y el detalle queda en el log del backend.
