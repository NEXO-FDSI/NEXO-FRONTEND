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

## Tutorial: probar el stack completo en local

Levanta el backend con Docker y un Postgres local, sin Supabase, sin API key de OTX (la API pública responde sin clave, con límite de peticiones) y sin instalar Python 3.14. El repo del backend no se modifica: la configuración va por variables de entorno y el bundle de ATT&CK se monta desde fuera.

Requisitos: Docker Desktop (o Docker Engine) corriendo y Node.js 24. Los comandos asumen los dos repos clonados lado a lado y se ejecutan desde la carpeta que los contiene:

```
carpeta-del-proyecto/
├── NEXO-BACKEND/
└── NEXO-FRONTEND/
```

> **Windows:** usa PowerShell y escribe `curl.exe` en lugar de `curl` (en PowerShell 5.1, `curl` es un alias de `Invoke-WebRequest`). En Git Bash, antepone `MSYS_NO_PATHCONV=1` al `docker run` que lleva `-v`, o Git Bash reescribe la ruta del contenedor.

### 1. Backend (solo la primera vez)

```bash
# Bundle MITRE ATT&CK Enterprise 19.1 (~50 MB), fuera del repo del backend
curl -L --create-dirs -o attck/enterprise-attack-19.1.json https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack-19.1.json

# Red y base de datos local
docker network create nexo-net
docker run -d --name nexo-pg --network nexo-net -e POSTGRES_PASSWORD=nexo -e POSTGRES_DB=nexo postgres:17-alpine

# Imagen del backend (solo lee el repo)
docker build -t nexo-backend-local ./NEXO-BACKEND

# Migraciones. Si falla por conexión, Postgres aún está arrancando: espera unos segundos y repite
docker run --rm --network nexo-net -e DATABASE_URL=postgresql+psycopg://postgres:nexo@nexo-pg:5432/nexo nexo-backend-local alembic upgrade head

# API en :8000, con CORS para el frontend y el bundle montado
docker run -d --name nexo-api --network nexo-net -p 8000:8000 -e DATABASE_URL=postgresql+psycopg://postgres:nexo@nexo-pg:5432/nexo -e CORS_ORIGINS=http://localhost:5173 -v "$(pwd)/attck:/app/data/attck:ro" nexo-backend-local

# Debe responder {"status":"ok"}
curl http://localhost:8000/health
```

Si tienen la API key de OTX, agréguenla al `docker run` de la API con `-e REPUTATION_API_KEY=<clave>`.

Las siguientes veces basta con arrancar los contenedores existentes:

```bash
docker start nexo-pg nexo-api
```

### 2. Frontend

```bash
cd NEXO-FRONTEND
npm install
npm run dev
```

Abre <http://localhost:5173>. Arriba a la derecha debe aparecer **"API en línea"** en verde.

### 3. Qué probar

Debajo del formulario hay botones de ejemplo con los indicadores de los escenarios oficiales del backend (`data/test_dataset/scenarios.json`).

| Prueba | Cómo | Resultado esperado |
|---|---|---|
| Amenaza conocida | Botón **WannaCry** → *Registrar indicador* | Entidad `wannacry`, confianza 90 %, 16 técnicas en 8 tácticas |
| Indicador benigno | Botón **IP benigna** (`8.8.8.8`) | "Sin asociación" y la etapa de técnicas en "No se ejecuta"; en *Enriquecimiento* aparece *Whitelisted IP* |
| Misma campaña | Botón **SUNBURST** (`ervsystem.com`) | Resuelve a `sunburst` si OTX conserva los pulses del escenario (los datos de OTX cambian con el tiempo) |
| Validación humana | Pestaña **Validación** → *Aceptar* o *Rechazar* → *Registrar decisión* | La decisión entra al historial y el estado de la investigación cambia |
| Formato inválido (422) | Tipo IP, valor `999.1.1.1` | "Datos inválidos" con el mensaje del backend |
| Duplicado (409) | El hash de WannaCry en MAYÚSCULAS | Se abre la investigación que ya existía |
| Error interno (500) | `docker stop nexo-pg`, registra una IP nueva y luego `docker start nexo-pg` | "Backend inaccesible", con la explicación del 500 sin cabeceras CORS |
| Paso a paso | Desmarca *Analizar automáticamente* antes de registrar | Cada paso se ejecuta desde el stepper o desde su pestaña |
| Persistencia | Recarga la página | El historial se conserva |
| Responsive | DevTools (F12) → vista de dispositivo móvil | Una sola columna y sin scroll horizontal |

El apartado *Análisis* del informe dice "no disponible" si Ollama no está corriendo: es el comportamiento esperado del backend, que genera el resto del informe igual. Para obtener la narrativa del LLM, sigan la sección de Ollama del README del backend.

### 4. Pruebas automáticas

```bash
npm run coverage   # suite completa; falla si la cobertura baja del 90 %
```

### 5. Apagar y limpiar

```bash
docker rm -f nexo-api nexo-pg
docker network rm nexo-net
```

### Alternativa: setup del backend con Supabase

Si levantan el backend como indica su README (Supabase + `uvicorn`), lo único que necesita el frontend es que el `.env` del backend incluya `CORS_ORIGINS=http://localhost:5173`. Después basta con `npm run dev` aquí.

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
