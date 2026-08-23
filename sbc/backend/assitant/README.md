# Asistente de voz local (Raspberry Pi)

STT: sherpa-onnx (Whisper) · LLM: Qwen2.5-0.5B-Instruct · TTS: Piper
Frontend: HTML/CSS/JS servido por el mismo backend.

## 1. Requisitos del sistema

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip ffmpeg
```

`ffmpeg` es necesario para convertir el audio que graba el navegador (webm) a WAV.

## 2. Backend

```bash
cd voice-assistant/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Nota sobre `llama-cpp-python` en Raspberry Pi: si la instalación por pip falla o
es muy lenta, compilalo con soporte para la arquitectura ARM:

```bash
CMAKE_ARGS="-DLLAMA_NATIVE=on" pip install llama-cpp-python
```

## 3. Descargar los modelos

### STT — sherpa-onnx (Whisper tiny, multilingüe)
Descargar desde los releases de sherpa-onnx:
https://github.com/k2-fsa/sherpa-onnx/releases (buscar "whisper-tiny")

Colocar en `models/stt/`:
- `encoder.onnx`
- `decoder.onnx`
- `tokens.txt`

### LLM — Qwen2.5-0.5B-Instruct (GGUF)
Repo: `Qwen/Qwen2.5-0.5B-Instruct-GGUF` en Hugging Face.
Descargar la versión cuantizada `q4_k_m` (buen balance calidad/velocidad en CPU).

Colocar en `models/llm/qwen2.5-0.5b-instruct-q4_k_m.gguf`

### TTS — Piper
1. Descargar el binario de Piper para ARM64:
   https://github.com/rhasspy/piper (sección Installation)
   Descomprimir en `models/tts/piper/` (debe quedar `models/tts/piper/piper`)

2. Descargar una voz en español, por ejemplo `es_AR-daniela-high`:
   https://github.com/rhasspy/piper/blob/master/VOICES.md

   Colocar los 2 archivos (`.onnx` y `.onnx.json`) en `models/tts/`

Si usás otra voz o modelo, ajustá las rutas en `backend/main.py`
(constantes `STT_MODEL_DIR`, `LLM_MODEL_PATH`, `PIPER_BINARY`, `TTS_MODEL_PATH`).

## 4. Correr el asistente

```bash
cd voice-assistant/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

Abrir en el navegador (de la Raspberry o de otra PC en la misma red):

```
http://<ip-de-la-raspberry>:8000
```

Mantener presionado el botón, hablar, soltar. El asistente transcribe,
piensa una respuesta y la lee en voz alta.

## 5. Estructura del proyecto

```
voice-assistant/
├── backend/
│   ├── main.py       # API FastAPI, orquesta STT -> LLM -> TTS
│   ├── stt.py         # Reconocimiento de voz (sherpa-onnx)
│   ├── llm.py          # Modelo de lenguaje (Qwen2.5-0.5B)
│   ├── tts.py           # Síntesis de voz (Piper)
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── models/
    ├── stt/    (encoder.onnx, decoder.onnx, tokens.txt)
    ├── llm/    (qwen2.5-0.5b-instruct-q4_k_m.gguf)
    └── tts/    (piper/, voz .onnx + .onnx.json)
```

## 6. Puntos a tener en cuenta (rendimiento en Raspberry Pi)

- Qwen2.5-0.5B en q4_k_m corre razonablemente bien en CPU ARM, pero la
  latencia total (STT + LLM + TTS) probablemente ronde 2-5 segundos por
  turno en una Raspberry Pi 4. Es esperable — no es un bug.
- Si la latencia es un problema real para el caso de uso, las próximas
  optimizaciones (en este orden de impacto) son: (1) usar un modelo
  Whisper aún más chico para STT, (2) reducir `max_tokens` en el LLM,
  (3) precargar todo en RAM y evitar swap.
- No agregues streaming de audio ni WebSockets hasta confirmar que el
  flujo simple request/response funciona end to end. Complejizarlo antes
  de tener el caso base andando es la forma más común de trabarse en este
  tipo de proyecto.
