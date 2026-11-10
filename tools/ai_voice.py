#!/usr/bin/env python3
"""
Makes a natural AI voice for every mantra that has no real recording yet, using AI4Bharat's open-source
Indic Parler-TTS model (Apache-2.0, speaks Sanskrit). Runs in GitHub Actions (see .github/workflows/ai-voice.yml),
because it needs to download the model (~4 GB) and a few minutes of CPU per mantra.

  python3 tools/ai_voice.py [--slugs gayatri,mahamrityunjaya] [--minutes 300] [--max-lines 40] [--redo]

For each mantra (shortest first) it reads the Sanskrit one line at a time, joins the lines with short pauses,
saves vedic-pandit-client/public/audio/<slug>.mp3, and links it in SeedData with the credit line below.
Real recordings (any audioCredit that does not start with "AI voice") are never replaced.
It stops starting new mantras after --minutes, so the job can be run again to continue where it left off.
"""
import argparse, json, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'vedic-pandit-client' / 'public' / 'audio'
SEED = ROOT / 'src' / 'VedicPandit.WebAPI' / 'SeedData'
MODEL = 'ai4bharat/indic-parler-tts'
CREDIT = 'AI voice (AI4Bharat Indic Parler-TTS), computer-generated. A Pandit ji\'s recording will replace it.'
DESCRIPTION = ('Aryan speaks slowly and calmly in a deep, devotional voice with very clear Sanskrit pronunciation, '
               'like a priest reciting mantras. The recording is of very high quality, with no background noise.')

ap = argparse.ArgumentParser()
ap.add_argument('--slugs', default='', help='comma-separated slugs; empty = all without a real recording')
ap.add_argument('--minutes', type=float, default=300, help='stop starting new mantras after this many minutes')
ap.add_argument('--max-lines', type=int, default=120, help='skip texts longer than this (e.g. Vishnu Sahasranama) unless named in --slugs')
ap.add_argument('--redo', action='store_true', help='make the AI voice again even if one exists')
args = ap.parse_args()

seed_files = [SEED / 'mantras.json', *sorted((SEED / 'mantras').glob('*.json'))]
seeds = {f: json.loads(f.read_text(encoding='utf-8')) for f in seed_files}
mantras = [m for data in seeds.values() for m in data]
wanted = {s.strip() for s in args.slugs.split(',') if s.strip()}

def is_real(m):  # a human recording: never touch
    return bool(m.get('audioUrl')) and not str(m.get('audioCredit', '')).startswith('AI voice')

def clean_line(line: str) -> str:
    line = re.sub(r'[॥।]?\s*[०-९0-9]+\s*[॥।]?', ' ', line)           # verse numbers like ॥ १ ॥
    line = line.replace('ॐ', 'ओम्').replace('ऽ', '')
    line = re.sub(r'\s*॥\s*', '. ', line)
    line = re.sub(r'\s*।\s*', ', ', line)
    line = re.sub(r'[|\-–—_*()\[\]"“”]', ' ', line)
    return re.sub(r'\s+', ' ', line).strip(' ,.')

def lines_of(m):
    return [l for l in (clean_line(x) for x in m['sanskrit'].replace('\r', '').split('\n')) if l]

todo = []
for m in mantras:
    if wanted and m['slug'] not in wanted: continue
    if is_real(m): continue
    if m.get('audioUrl') and not args.redo and (AUDIO / Path(m['audioUrl']).name).exists(): continue
    ls = lines_of(m)
    if not ls: continue
    if len(ls) > args.max_lines and m['slug'] not in wanted:
        print(f'skip (too long, {len(ls)} lines): {m["slug"]}'); continue
    todo.append((m, ls))
todo.sort(key=lambda x: sum(len(l) for l in x[1]))
print(f'{len(todo)} mantras to voice')
if not todo: sys.exit(0)

import numpy as np, soundfile as sf, torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer

torch.set_num_threads(max(1, torch.get_num_threads()))
model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).eval()
tok = AutoTokenizer.from_pretrained(MODEL)
dtok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
sr = model.config.sampling_rate
desc = dtok(DESCRIPTION, return_tensors='pt')

def speak(text: str) -> np.ndarray:
    torch.manual_seed(7)   # same seed for every line keeps the voice steady
    p = tok(text, return_tensors='pt')
    with torch.no_grad():
        out = model.generate(input_ids=desc.input_ids, attention_mask=desc.attention_mask,
                             prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
    a = out.cpu().numpy().squeeze().astype(np.float32)
    # trim the silence the model leaves at both ends
    idx = np.where(np.abs(a) > 0.01)[0]
    return a[max(0, idx[0] - int(0.05 * sr)): idx[-1] + int(0.1 * sr)] if len(idx) else a

def syllables(w: str) -> int:
    n = 0; ch = list(w)
    for i, c in enumerate(ch):
        o = ord(c)
        if 0x904 <= o <= 0x914 or o == 0x950: n += 1
        elif 0x915 <= o <= 0x939 and (i + 1 >= len(ch) or ch[i + 1] != '्'): n += 1
    return max(1, n)

AUDIO.mkdir(parents=True, exist_ok=True)
start = time.time(); done = 0
for m, ls in todo:
    if (time.time() - start) / 60 > args.minutes:
        print('time budget reached; run the workflow again to continue'); break
    t0 = time.time()
    try:
        parts, timing, t_ms = [], [], 0
        raw_lines = [x for x in m['sanskrit'].replace('\r', '').split('\n') if x.strip()]
        for li, line in enumerate(ls):
            a = speak(line)
            parts.append(a)
            dur = len(a) / sr * 1000
            # word timing for the highlighting: spread the line over its words by syllables
            words = raw_lines[li].split() if li < len(raw_lines) and len(ls) == len(raw_lines) else line.split()
            total = sum(syllables(w) for w in words) or 1
            t = t_ms
            for w in words:
                d = dur * syllables(w) / total
                timing.append({'w': w, 's': round(t), 'e': round(t + d), 'l': li}); t += d
            gap = 0.9 if li < len(ls) - 1 else 0
            parts.append(np.zeros(int(gap * sr), dtype=np.float32))
            t_ms += dur + gap * 1000
        audio = np.concatenate(parts)
        audio = audio / max(1e-6, float(np.max(np.abs(audio)))) * 0.9
        wav = AUDIO / f'{m["slug"]}.wav'
        sf.write(wav, audio, sr)
        mp3 = AUDIO / f'{m["slug"]}.mp3'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-ac', '1', '-b:a', '64k', str(mp3)], check=True)
        wav.unlink()
        m['audioUrl'] = f'audio/{m["slug"]}.mp3'
        m['audioCredit'] = CREDIT
        if '\n\n' not in m['sanskrit'].strip(): m['timingJson'] = json.dumps(timing, ensure_ascii=False)
        done += 1
        print(f'✔ {m["slug"]}: {len(ls)} lines, {len(audio) / sr:.0f}s audio, {time.time() - t0:.0f}s')
        for f, data in seeds.items():   # save after every mantra, so a timeout keeps the work done
            f.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    except Exception as e:  # one bad text should not stop the rest
        print(f'✘ {m["slug"]}: {e}')
print(f'done: {done} mantras voiced in {(time.time() - start) / 60:.0f} min')
