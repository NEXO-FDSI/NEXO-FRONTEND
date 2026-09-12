# Threat Intel Enrichment — Frontend

Interfaz web de solo lectura que visualiza, de forma trazable, la cadena **indicador → entidad → técnica ATT&CK → evidencia** generada por el backend, con controles para que un analista acepte o rechace cada asociación propuesta por la IA.

Proyecto del curso **Seminario de Seguridad de la Información 2026-2** — Escuela Colombiana de Ingeniería Julio Garavito.

> Repo hermano: [`threat-intel-backend`](https://github.com/NEXO-FDSI/NEXO-BACKEND.git) — API que este frontend consume. Se ejecutan por separado, no como monorepo.

## Contexto académico

| | |
|---|---|
| Asignatura | Fundamentos de Seguridad de la Información |
| Grupo | Grupo 2 |
| Profesor | Diego Alexander López Correa |
| Integrantes | Daniel Alexander Ahumada León · Daniel Ricardo Ruge Gómez · David Alejandro Patacón Henao · David Santiago Cajamarca Cadena |

## Propósito

El diferenciador central del proyecto frente a plataformas comerciales de "SOC agéntico" (Cortex XSIAM, Sentinel, Falcon, etc.) no es automatizar más, sino **hacer auditable cada paso de la decisión**. Esta interfaz es la pieza que hace visible esa cadena de evidencia — es la razón por la que el prototipo necesita una vista web y no solo expone una API.

Alcance deliberadamente acotado: interfaz de solo lectura + validación humana, **sin** autenticación multiusuario ni funciones de administración tipo SOC comercial.

## Stack

- React + TypeScript
- Vite
- Consumo de la API del backend vía `fetch`

## Requisitos previos

- Node.js (LTS)
- El backend (`nexo-backend`) corriendo localmente o accesible por red

## Instalación

```bash
npm install
```

## Variables de entorno

Crear `.env.local` (no se versiona):

```
VITE_API_URL=http://localhost:8000
```

## Ejecución en desarrollo

Con el backend corriendo en el puerto 8000:

```bash
npm run dev
```

Abre `http://localhost:5173`. Si la página muestra el estado de conexión con el backend correctamente, la integración entre ambos repos está funcionando.

## Docker

```bash
docker build -t nexo-intel-frontend .
docker run -p 8080:80 nexo-intel-frontend
```

Build multi-stage: compila con Node y sirve los estáticos con nginx.

## Estructura del proyecto

```
src/
├── App.tsx          # punto de entrada actual (health check contra el backend)
├── components/       # (por definir) cadena indicador → entidad → técnica → evidencia
└── ...
```