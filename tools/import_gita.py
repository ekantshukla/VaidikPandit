#!/usr/bin/env python3
"""
Builds SeedData/scriptures/gita.json: all 701 verses of the Bhagavad Gita.

Sources:
  Sanskrit text   github.com/gita/gita (data/verse.json), released into the public domain (Unlicense).
  English         Swami Sivananda's translation, from the same dataset. Swami Sivananda died in 1963;
                  under Indian copyright law (author's life + 60 years) his works entered the public domain
                  in India on 1 January 2024.
  Hindi           Only for the hand-picked verses in gita-curated.json (written for Vaidik Pandit). The content
                  store merges that file with this one, so those verses keep their Hindi and keywords.

Usage:
  python3 tools/import_gita.py path/to/verse.json path/to/translation.json
  (download both from https://raw.githubusercontent.com/gita/gita/main/data/)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/VedicPandit.WebAPI/SeedData/scriptures/gita.json"


def clean_sanskrit(text: str) -> str:
    t = text.replace("\r", "")
    t = re.sub(r"।।\s*\d+\.\d+\s*।।", "॥", t)          # verse-number marker -> double danda
    t = re.sub(r"।(?=[^\s।॥])", "।\n", t)               # split half-verses written on one line
    lines = [ln.strip() for ln in t.split("\n") if ln.strip()]
    return "\n".join(lines)


def main(verse_path: str, translation_path: str) -> None:
    verses = json.loads(Path(verse_path).read_text(encoding="utf-8"))
    translations = json.loads(Path(translation_path).read_text(encoding="utf-8"))
    sivananda = {t["verse_id"]: t["description"].strip() for t in translations
                 if t.get("authorName") == "Swami Sivananda" and t.get("lang") == "english"}

    out_verses = []
    for v in sorted(verses, key=lambda x: (x["chapter_number"], x["verse_number"])):
        en = sivananda.get(v["id"], "")
        if not en:
            raise SystemExit(f"Missing translation for {v['chapter_number']}.{v['verse_number']}")
        out_verses.append({
            "chapter": v["chapter_number"],
            "verse": str(v["verse_number"]),
            "sanskrit": clean_sanskrit(v["text"]),
            "translationEn": re.sub(r"\s+", " ", en),
            "translationHi": "",
            "keywords": "",
        })

    data = [{
        "code": "gita",
        "name": "Bhagavad Gita",
        "nameDevanagari": "श्रीमद्भगवद्गीता",
        "category": "Itihasa (Mahabharata, Bhishma Parva)",
        "description": "The dialogue between Shri Krishna and Arjuna on the battlefield of Kurukshetra, in 18 chapters.",
        "translationCredit": "English: Swami Sivananda. Hindi (selected verses): Vaidik Pandit.",
        "verses": out_verses,
    }]
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {len(out_verses)} verses to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
