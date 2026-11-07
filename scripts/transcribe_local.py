"""Word-level transcription with faster-whisper. Usage: transcribe_local.py audio.wav [model]. Prints JSON to stdout."""
import json, sys
from faster_whisper import WhisperModel

audio = sys.argv[1]
model = WhisperModel(sys.argv[2] if len(sys.argv) > 2 else "small.en", compute_type="int8")
segments, _ = model.transcribe(audio, word_timestamps=True, vad_filter=False)
out = []
for seg in segments:
    for w in seg.words or []:
        out.append({"text": w.word.strip(), "startMs": round(w.start * 1000), "endMs": round(w.end * 1000)})
print(json.dumps(out))
