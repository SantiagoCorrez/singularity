# Singularity

Reporte de una canción a partir de su WAV, en tres módulos:

1. **Emoción y trayectoria**: mapa de Russell, radar de 13 dimensiones, trayectoria por tramos y coherencia entre letra y sonido.
2. **Tribus agénticas**: un enjambre de agentes que consulta fuentes externas, grafo de tribus y memoria del artista.
3. **Neural Scan**: cerebro 3D en partículas sincronizado con el reproductor.

**Regla de procedencia.** Toda cifra lleva fuente, fecha, estado y calibración. Si le falta algo, la interfaz muestra **ABSTENCIÓN** con el motivo, en lugar de un valor. El modo desarrollo (casilla en la cabecera del reporte) muestra los valores sin calibrar marcados como **NO CALIBRADO**.

## Requisitos

| Para | Necesitas |
|---|---|
| Ver la demo | Node.js 22 |
| Analizar tus WAV | Lo anterior y Docker Desktop (unos 4 GB de memoria para Docker) |
| Desarrollar el backend en local | Python 3.11 |

## 1. Ver la demo (sin backend)

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:3000/report/demo>. Todas las cifras son simuladas y llevan el sello **DEMO**. La variante <http://localhost:3000/report/abstention> muestra cómo se ve el reporte cuando las emociones no superan la calibración.

## 2. Analizar tus WAV (backend en Docker)

El backend corre en Docker porque Essentia, la librería del modelo de emoción, no tiene versión para Windows.

### Descarga los pesos del modelo

Van en `apps/api/models/` y no están en el repositorio. Son dos archivos de unos 3,3 MB en total.

En PowerShell:

```powershell
$m = "apps/api/models"
Invoke-WebRequest https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.pb -OutFile "$m/msd-musicnn-1.pb"
Invoke-WebRequest https://essentia.upf.edu/models/classification-heads/deam/deam-msd-musicnn-2.pb -OutFile "$m/deam-msd-musicnn-2.pb"
```

En bash:

```bash
curl -fL -o apps/api/models/msd-musicnn-1.pb https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.pb && curl -fL -o apps/api/models/deam-msd-musicnn-2.pb https://essentia.upf.edu/models/classification-heads/deam/deam-msd-musicnn-2.pb
```

> **Licencia.** Essentia es AGPLv3 y, según su web, sus modelos preentrenados se publican como CC BY-NC-SA 4.0 (uso no comercial). Confírmalo antes de cualquier uso comercial.

Sin los pesos, el análisis funciona igual, pero la valencia y la activación salen en abstención.

### Claves opcionales

Crea `infra/.env` (está excluido de git) solo con las que tengas:

```
ANTHROPIC_API_KEY=...
```

| Variable | Activa |
|---|---|
| `ANTHROPIC_API_KEY` | Análisis de la letra, coherencia letra ↔ sonido y las perspectivas de Manager, Marketing y PR |
| `YOUTUBE_API_KEY`, `TIKTOK_ACCESS_TOKEN`, `GOOGLE_TRENDS_API_KEY` | Reservadas para el agente de Tendencias. Aún no hay adaptadores: aunque las pongas, esas cifras siguen en abstención |

### Arranca el backend

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

La primera construcción tarda varios minutos (instala TensorFlow y Essentia). Levanta cuatro servicios:

| Servicio | Qué hace |
|---|---|
| `api` | FastAPI en <http://localhost:8010> |
| `worker` | Analiza las pistas que llegan a la cola |
| `redis` | Cola de trabajos |
| `db` | Postgres con pgvector, para la memoria del artista; no se publica fuera de Docker |

Comprueba que responde:

```bash
curl http://localhost:8010/api/health
```

Con la web en marcha (`npm run dev`), abre <http://localhost:3000/upload>, sube un WAV de entre 10 segundos y 15 minutos y espera a que te lleve al reporte. La primera pista tarda más porque carga el modelo.

Para pararlo:

```bash
docker compose -f infra/docker-compose.yml down
```

Las pistas subidas se guardan en `apps/api/data/` y la base de datos en el volumen `pgdata`.

## 3. Backend local sin Docker (opcional)

Útil para trabajar en la API o el análisis de audio. Sin Essentia ni Postgres, la emoción del audio, las tribus y el ADN del artista salen en abstención, y las pistas se analizan dentro del propio servidor en lugar de en una cola.

```bash
python -m venv apps/api/.venv
```

En Windows el ejecutable es `apps/api/.venv/Scripts/python`; en macOS y Linux, `apps/api/.venv/bin/python`.

```bash
apps/api/.venv/Scripts/python -m pip install -r apps/api/requirements.txt -r apps/api/requirements-llm.txt
```

```bash
apps/api/.venv/Scripts/python -m uvicorn singularity_api.main:app --port 8010 --app-dir apps/api
```

No lo arranques a la vez que el contenedor `api`: los dos usan el puerto 8010.

## Pruebas

Frontend: regla de abstención, coherencia y validación de reportes contra el esquema.

```bash
npm test
```

```bash
npm run typecheck
```

Backend: vuelve a ejecutar la calibración de cada medida y compara con lo guardado; tarda un par de minutos.

```bash
cd apps/api && .venv/Scripts/python -m pytest -q
```

Si cambias cómo se mide algo, sube su versión en el método y recalibra; sin eso, la cifra sale sin calibración y las pruebas fallan:

```bash
cd apps/api && .venv/Scripts/python -m singularity_api.calibration.run
```

## Cambiar el esquema del reporte

`packages/schema/` es la única fuente de verdad. Después de editarlo, regenera los tipos del frontend y los datos de la demo:

```bash
npm run gen:types
```

```bash
npm run gen:demo
```

## Estructura

```
packages/schema/        Esquema JSON del reporte y de la cifra con procedencia
apps/web/               Next.js: reporte, subida y demo
  demo/                 Generador de los datos DEMO y del WAV sintético
  src/lib/provenance.ts La regla de abstención (el único punto de decisión)
apps/api/               FastAPI y análisis
  singularity_api/
    audio/              Descriptores, estructura, envolvente, modelo de emoción
    calibration/        Pruebas contra señales de referencia y resultados guardados
    lyrics/             Análisis de la letra con Claude
    swarm/              Enjambre: herramientas, agentes, perspectivas y orquestador
    tribes.py           Clustering de tribus
    artist_graph.py     ADN del artista (Postgres + pgvector)
  models/               Pesos de Essentia (no versionados)
infra/                  docker-compose del backend
```

## Estado actual

| Parte | Estado |
|---|---|
| Descriptores del máster (sonoridad, pulso, tonalidad, brillo, dinámica, ataques, clímax, estructura) | Medidos y calibrados contra señales sintéticas: se muestran |
| Valencia y activación del audio | Modelo real de Essentia, sin calibrar con datos propios: abstención (visibles en modo desarrollo) |
| 13 dimensiones y emoción dominante | Pendiente: falta entrenar el modelo con anotaciones del panel de oyentes |
| Letra y coherencia | Listo, necesita `ANTHROPIC_API_KEY`; sin calibrar, visible en modo desarrollo |
| Agente de Riesgo (señales técnicas) | Se muestra |
| Agente de Tendencias | Sin adaptadores todavía |
| Tribus | Sin catálogo de referencia: se muestra "VISTA PREVIA SIN DATOS" |
| ADN del artista | Funciona con Docker; sin calibrar, visible en modo desarrollo |

Chartmetric y Spotify están excluidos del proyecto, y con ellos la psicografía y los agentes de Audiencia, Playlists, Geolocalización y Oportunidades.

## Problemas frecuentes

- **El puerto 8010 está ocupado.** Cambia el puerto en `infra/docker-compose.yml` y pon la nueva dirección en `API_URL` y `NEXT_PUBLIC_API_URL` antes de `npm run dev`.
- **La subida falla con un error de CORS.** La API solo acepta la web en `http://localhost:3000` y `http://127.0.0.1:3000`. Para otra dirección, define `SINGULARITY_WEB_ORIGINS` en `infra/.env`, separadas por comas.
- **`pip` o las descargas fallan por certificados** (redes corporativas o antivirus que inspeccionan TLS). Añade `--use-feature=truststore` a `pip install` para usar los certificados del sistema, y descarga los pesos con PowerShell en lugar de curl.
- **"El reporte no está disponible".** El análisis aún no ha terminado o la API no está en marcha; revisa los registros con `docker compose -f infra/docker-compose.yml logs worker`.
- **Antes de desplegar** cambia la contraseña de Postgres de `infra/docker-compose.yml`, que es un valor de desarrollo.
