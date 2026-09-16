import wave
import math
import struct
import subprocess
import tempfile
import os

sample_rate = 44100
duration = 2
frequency = 440

wav_path = "/tmp/kibo_test.wav"

with wave.open(wav_path, "w") as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(sample_rate)

    for i in range(sample_rate * duration):
        value = int(
            0.3 * 32767 *
            math.sin(2 * math.pi * frequency * i / sample_rate)
        )

        data = struct.pack("<hh", value, value)
        wav.writeframes(data)

print("Reproduciendo por PulseAudio...")
print("Archivo:", wav_path)

subprocess.run([
    "paplay",
    wav_path
], check=True)

print("Audio terminado")

os.remove(wav_path)