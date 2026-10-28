"""Generate the lecture narration with Kokoro (hexgrad/Kokoro-82M, Apache-2.0), an open-source TTS.

    pip install kokoro soundfile      # in a separate venv
    python make_narration.py          # writes narration/vN_bM.mp3 and narration/durations.json

ffmpeg must be on PATH (wav -> mp3). The video scenes read durations.json for their timing.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

HERE = Path(__file__).resolve().parent
OUT = HERE / "narration"
VOICE = "af_heart"
SPEED = 0.95
RATE = 24000


def main():
    script = json.loads((HERE / "narration_script.json").read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    pipeline = KPipeline(lang_code="a")  # American English
    # Keep clips already made so existing videos keep their timing; delete an mp3 to remake it.
    durations_file = OUT / "durations.json"
    durations = json.loads(durations_file.read_text(encoding="utf-8-sig")) if durations_file.exists() else {}
    for vid, beats in script.items():
        for i, text in enumerate(beats, start=1):
            key = f"{vid}_b{i}"
            if key in durations and (OUT / f"{key}.mp3").exists():
                continue
            audio = np.concatenate([np.asarray(chunk.audio) for chunk in pipeline(text, voice=VOICE, speed=SPEED)])
            wav = OUT / f"{key}.wav"
            sf.write(wav, audio, RATE)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "128k", str(OUT / f"{key}.mp3")], check=True)
            wav.unlink()
            durations[key] = round(len(audio) / RATE, 3)
            print(key, durations[key], "s")
    (OUT / "durations.json").write_text(json.dumps(durations, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
