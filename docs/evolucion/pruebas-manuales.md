# Pruebas manuales — sprint de evolución (F1–F5)

Stack completo en local, contra Supabase real y APIs reales (OTX, ThreatFox, VirusTotal,
Groq; Ollama como respaldo).

## Preparación (fish)

```fish
# Terminal 1 — backend
cd nexo-intel-backend; source .venv/bin/activate.fish
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Ollama (respaldo de la IA)
systemctl status ollama          # debe estar activo
ollama run qwen3:8b "ok"         # lo deja cargado en GPU

# Terminal 3 — frontend
cd nexo-intel-frontend; npm run dev   # http://localhost:5173
```

> **Antes de empezar.** Estos indicadores **ya existen en Supabase**:
> `24d004a1…1022c` (WannaCry SHA-256), `84.234.75.108`, `googledrive.network`,
> `google.com`, `44d88612…`, `84c82835…`, `107d9fce…`. Si no están en el historial de
> tu navegador, registrarlos da 409 y no se pueden abrir (limitación conocida: no hay
> GET por valor). Los casos de abajo usan indicadores nuevos. Lo que registres queda
> en Supabase: **prueba en el mismo navegador que usarás en la demo y no borres su
> historial**.
>
> **VirusTotal permite 4 consultas por minuto.** Espera unos 20 s entre indicadores
> nuevos, salvo en el caso D4.

## A. Navegación, tema y estado

| # | Pasos | Resultado esperado |
|---|---|---|
| A1 | Abrir `http://localhost:5173` | Tema oscuro. Cabecera: "API en línea" y "IA: groq · qwen/qwen3.8-27b" (al pasar el mouse: "Respaldo: ollama · qwen3:8b"). Sin historial: KPIs en 0 y "Cómo funciona NEXO" |
| A2 | Botón sol/luna → recargar | Cambia a tema claro y lo conserva al recargar |
| A3 | Abrir `#/investigaciones/999` | "La investigación #999 no está en este navegador" con enlace a la lista |
| A4 | Navegar Panel → Investigaciones → un caso → botón Atrás del navegador | Vuelve a la vista anterior; cada caso tiene URL propia |
| A5 | `http://localhost:8000/status` | Fuentes (OTX, ThreatFox, VirusTotal: `configurada: true`) e IA. Ninguna clave en la respuesta |

## B. Ingesta

| # | Pasos | Resultado esperado |
|---|---|---|
| B1 | Analizar indicador → pegar `hxxp://evil[.]example[.]com/payload` | Se selecciona **URL** solo |
| B2 | Pegar `5ff465afaabcbf0150d1a3ab2c2e74f3a4426467` | Se selecciona **Hash** |
| B3 | Tipo IP, valor `999.1.1.1`, Registrar | "Datos inválidos" con el motivo del backend; no se crea nada |
| B4 | Registrar `24d004a104d4d54034dbcffc2a4b19a11f39008a575aa614ea04703480b1022c` | Si está en tu historial, abre su investigación; si no, "El indicador ya existe en el backend" |

## C. Pipeline completo (análisis automático activado)

| # | Indicador | Qué verificar |
|---|---|---|
| C1 | Dominio `ervsystem.com` (SUNBURST, escenario 4) | Abre en **Resumen** y la cadena se llena sola. Entidad **sunburst**. Cabecera: severidad, píldoras por fuente (VirusTotal "con registros"). **Inteligencia**: barra de VT (≈16 maliciosos), ThreatFox "no tiene registros". **ATT&CK**: técnicas por táctica, alguna con marca **IA**. **Análisis IA**: hallazgos con citas; al hacer clic en `E-VT` se resalta su bloque; "Ver el prompt exacto"; pie con `groq · … ms · tokens`. El log del backend muestra `IA groq (qwen/qwen3.8-27b) respondió en … ms` |
| C2 | Hash `32519b85c0b422e4656de6e6c41878e95fd95026267daab4215ee59c107d6c77` (DLL de SolarWinds, escenario 6) | Entidad **blackcat** con confianza 0,6 (vía tags). Severidad **Alta**. Resumen: **"VirusTotal contradice la asociación: sus familias apuntan a sunburst"**. El análisis de IA menciona la contradicción. En Informe y validación: **Rechazar** con tu nombre → historial de decisiones; el Panel ya no lo cuenta como pendiente |
| C3 | IP `8.8.8.8` (escenario 5) | Severidad **Benigno conocido**, "Sin asociación", técnicas "No se ejecuta". Análisis IA: **"No se consultó al modelo"**, motivo "por diseño" |
| C4 | IP `10.0.0.5` | Las tres fuentes **"omitida (IP no pública)"**; el log del backend **no** muestra peticiones HTTP a terceros; severidad **Indeterminada** |
| C5 | IP `190.24.150.33` (escenario 2) | Sin pulses ni entidad. Severidad **Baja** si todas las fuentes respondieron; **Indeterminada** si alguna falló (nunca "Baja" sin verificar) |
| C6 | Hash `edde2e639889353657078f66a3bd11b4ae54343a991e95a522a7d5c7f050eb15` (escenario 3) | Entidad **remcos**, técnicas repartidas entre varias tácticas |
| C7 | Hash `2c4a910a1299cdae2a4e55988a2f102e` (MD5 de SUNBURST, escenario 4, después de C1) | Entidad **sunburst** otra vez. En el Panel, "Tácticas más frecuentes" cuenta 2 investigaciones en las tácticas compartidas |
| C8 | Hash SHA-1 `5ff465afaabcbf0150d1a3ab2c2e74f3a4426467` | ThreatFox **"no aplica a este tipo"** (solo busca MD5/SHA-256). Revisar la concordancia: OTX trae *Cobalt Strike* entre sus familias y VirusTotal dice *wannacry* |
| C9 | Una IP de un IoC reciente de https://threatfox.abuse.ch/browse/ (ip:puerto de las últimas 24 h; registrar solo la IP) | ThreatFox **"con registros"**: familia y confianza en su tarjeta; severidad al menos **Alta** |

## D. Resiliencia

| # | Pasos | Resultado esperado |
|---|---|---|
| D1 | `.env`: `LLM_API_KEY=gsk_invalida` → reiniciar uvicorn → en un caso con entidad: **Regenerar** informe | Pie de Análisis IA: `ollama · qwen3:8b` y **"Respaldo: groq no respondió"**. Luego restaurar la clave |
| D2 | Igual que D1 + `sudo systemctl stop ollama` → Regenerar | El informe sale igual. Análisis IA: **"El modelo no respondió"** con los dos intentos y sus errores. Luego `sudo systemctl start ollama` |
| D3 | Regenerar el informe dos veces seguidas en menos de 10 s | La segunda puede tardar unos 4 s más (espera del 429 de Groq) o salir con el respaldo; el pie dice cuál respondió |
| D4 | Registrar 5 indicadores nuevos en menos de un minuto (p. ej. dominios reales poco conocidos) | En el 5.º, VirusTotal sale **"límite de cuota"**, con el aviso "Enriquecido con 2 de 3 fuentes… «no respondió» no equivale a «sin evidencia»". Pasado un minuto: **Reintentar fuentes** → VT se completa |
| D5 | Si OTX está lento o caído (pasa) | Hasta unos 20 s y luego error **"No se pudo verificar la reputación… NO significa sin evidencia"** con Reintentar. ThreatFox y VT ya quedaron guardados: al reintentar solo se vuelve a consultar OTX |
| D6 | Detener uvicorn | Cabecera "API fuera de línea"; cualquier acción → "Backend inaccesible" |
| D7 | Recargar la página con investigaciones | El historial sigue ahí, con fuentes e informes |

## E. Panel e informe

| # | Pasos | Resultado esperado |
|---|---|---|
| E1 | Panel con varias investigaciones | "Requieren atención" ordena por severidad y luego por pendientes. Clic en **"Críticas o altas"** filtra la tabla |
| E2 | Panel → "Fuentes y modelo" | Cada fuente: configurada y su último estado con latencia. IA: modelo, respaldo y "último análisis: groq en … ms" |
| E3 | Informe y validación → **Descargar .md** | En el Markdown, Tipo, Fecha, Confianza y Severidad van en líneas separadas; tabla "Fuentes consultadas"; hallazgos con citas y línea "Redactado por IA" |
| E4 | `http://localhost:8000/docs` → `POST /indicators/{id}/report` sobre un caso analizado | La respuesta incluye `metadatos` con `severidad`, `concordancia`, `fuentes` e `ia` (contexto, prompt, salida, descartes) |
