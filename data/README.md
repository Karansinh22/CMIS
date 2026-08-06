# Place test audio files here

To test the pipeline end-to-end, copy a real meeting recording into this directory.

## Recommended test files

- `test_meeting.wav` — A short (5–10 min) multi-speaker recording, 16kHz mono WAV preferred
- `test_meeting_2.wav` — A second meeting with overlapping topics (needed to test recurring-topic detection)

## Quick synthetic audio (no real recording needed)

```bash
# Generate a 30-second silent WAV for basic pipeline smoke-testing
python -c "
import wave, struct
with wave.open('data/test_meeting.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
    w.writeframes(struct.pack('<' + 'h' * 480000, *([0] * 480000)))
print('Created data/test_meeting.wav (30s silent WAV)')
"
```

## Tips

- Multi-speaker recordings (2–4 speakers) produce the most interesting diarization output.
- Recordings with clear agenda structure produce better topic segmentation.
- Any format accepted by ffmpeg works: .wav, .mp3, .m4a, .mp4, .ogg, .flac
