# Fase 5c — Panel principal

Fecha: 2026-09-30. Por indicación del usuario, en esta fase no se escribieron tests nuevos
ni se tomaron capturas; sí se verificaron lint, tipos, build y la suite existente.

## Qué cambia

`KpiStrip` (5 contadores sin acción) y la bienvenida fija se reemplazan por
`components/dashboard/Dashboard.tsx`. Cada bloque responde una pregunta:

| Bloque | Pregunta | Detalle |
|---|---|---|
| **4 KPIs** | ¿Cuánto hay y cuánto es grave? | Investigaciones · Con amenaza atribuida · **Críticas o altas** (severidad del último informe) · Pendientes de validación. Cada KPI es un botón (`aria-pressed`) que **filtra la tabla** |
| **Requieren atención** | ¿Qué miro primero? | Tabla ordenada por severidad ("Sin evaluar" va entre indeterminada y baja: falta información, no es inocuo), luego pendiente de validación, luego lo más reciente. Columnas: severidad, indicador (enlace), entidad, estado, fuentes ("2/3 con registros · 1 sin respuesta"), fecha. Máximo 8 filas con enlace "Ver las N" |
| **Fuentes y modelo** | ¿Puedo confiar en la próxima consulta? | Por fuente: configurada o sin clave (`GET /status`) y su **último estado observado** con latencia. IA: proveedor y modelo, respaldo configurado y el último análisis (proveedor, latencia, si usó respaldo) |
| **Tácticas ATT&CK más frecuentes** | ¿Hay solapamiento entre casos? | En cuántas investigaciones aparece cada táctica (top 6, barras CSS sin librería). Muestra, por ejemplo, la misma campaña del escenario 4 |

Sin investigaciones, el panel muestra los KPIs en cero y "Cómo funciona NEXO".

Se omitió a propósito un "feed de actividad reciente": duplicaría la tabla.

## Verificación

- `npm run lint`, `npm run typecheck`, `npm run build`: sin errores.
- `npm run coverage`: **129 tests** en verde; cobertura global 98,0 % sentencias · 92,2 %
  ramas · 98,0 % funciones · 98,8 % líneas (umbral del CI: 90 %).
- Se ajustó una aserción existente de `App.test.tsx`: el contador "Validados" ya no existe
  y ahora se verifican "Críticas o altas" = 1 y "Pendientes de validación" = 0 tras validar.

## Riesgo anotado

`Dashboard.tsx` tiene 54 % de cobertura de ramas (filtros por KPI, panel sin `/status`,
"Ver las N"). La cobertura global sigue sobre el umbral, pero si el panel crece conviene
agregarle tests para no acercarse al 90 % de ramas del CI.
