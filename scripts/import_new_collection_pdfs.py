"""Curate the owner's newest PDF attachments for the Kidzy coloring gallery.

Run from the repository root:
    python scripts/import_new_collection_pdfs.py /path/to/upload

The owner confirmed permission to republish the colorbook.ma sheets; the
SketchJoy permission was confirmed for the previous batch. Source PDFs stay
outside the site, while their attribution is kept in new-credits.txt.
"""

import argparse
import hashlib
import json
from pathlib import Path

import fitz

from import_drawing_pdfs import make_sheet


ANIMALS = ["الأسد", "الفيل", "الأرنب", "السلحفاة", "الباندا", "البومة", "الثعلب", "الكلب", "الزرافة", "الدلفين"]
TODDLERS = ["القطة", "النجمة", "الجرو", "البالون", "الشمس", "البطة", "التفاحة", "السمكة", "الزهرة", "المنزل", "القارب", "الشجرة", "الفراشة", "السيارة", "الفيل", "الكرة", "العصفور", "القمر", "القلب", "السحابة"]
ENGLISH = [
    (2, "A والتفاحة"), (3, "B والدب"), (4, "B والكرة"), (5, "C والقطة"),
    (6, "D والكلب"), (7, "E والفيل"), (8, "F والسمكة"), (9, "G والعنب"),
    (10, "H والقبعة"), (11, "I والمثلجات"), (12, "J وقنديل البحر"),
    (13, "K والطائرة الورقية"), (14, "L والأسد"), (15, "M والقمر"),
    (16, "N والعش"), (17, "O والأخطبوط"), (18, "P والبطريق"),
    (19, "Q والملكة"), (20, "R والأرنب"), (21, "S والشمس"),
    (22, "T والسلحفاة"), (23, "U والمظلة"), (24, "V والشاحنة"),
    (26, "W والبطيخ"), (27, "X والإكسيلوفون"), (29, "Y واليويو"),
    (30, "Z والحمار الوحشي"),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("upload", type=Path)
    args = parser.parse_args()
    destination = Path("public/drawing")
    destination.mkdir(parents=True, exist_ok=True)
    sheets = []
    credits = [
        "دفعة الصور التي قدمها صاحب الموقع، 69 رسمة من ملفات PDF:",
        "أكد صاحب الموقع امتلاكه تصريح إعادة النشر لرسومات colorbook.ma وSketchJoy.",
        "تحويلات الصور إلى WebP للاستخدام في التلوين؛ المصدر الأصلي موضح أدناه.", "",
    ]

    books = [
        ("كتاب-صور-الحيوانات-للاطفال-pdf.pdf", "animals", "animals", [(i + 2, f"حيوان {title}") for i, title in enumerate(ANIMALS)], (.01, .01, .99, .99)),
        ("كتاب-تلوين-الحروف-الانجليزية-للاطفال-pdf.pdf", "english", "english", [(n, f"حرف {title}") for n, title in ENGLISH], (.02, .01, .98, .98)),
        ("تلوين للاطفال 3 سنوات PDF.pdf", "toddlers", "toddlers", [(i + 2, f"للصغار: {title}") for i, title in enumerate(TODDLERS)], (.01, .01, .99, .99)),
        ("أوراق عمل تلوين الأرقام للأطفال pdf وتلوين الأعداد للطباعة _ كولر بوك.pdf", "numbers", "numbers", [(i, f"تلوين الرقم {i}") for i in range(1, 11)], (.08, .08, .92, .79)),
    ]
    for filename, prefix, group, pages, crop in books:
        document = fitz.open(args.upload / filename)
        assert max(number for number, _ in pages) <= len(document), filename
        for number, title in pages:
            key = f"batch-{prefix}-{number:02}"
            make_sheet(document[number - 1], crop, destination / key)
            sheets.append({"id": key, "title": title, "group": group})
        credits.append(f"{filename} — colorbook.ma — الصفحات: {', '.join(str(number) for number, _ in pages)}")
        document.close()

    singles = [
        ("Swinging-Past-the-Moon-coloring.pdf", "moon-swing", "تأرجح قرب القمر"),
        ("Moonlit-Walk-With-Catwoman-coloring.pdf", "catwoman-walk", "نزهة ليلية مع كاتوومان"),
    ]
    for filename, slug, title in singles:
        document = fitz.open(args.upload / filename)
        assert len(document) == 1, filename
        key = "batch-" + slug
        make_sheet(document[0], (.01, .01, .99, .99), destination / key)
        sheets.append({"id": key, "title": title, "group": "heroes"})
        credits.append(f"{filename} — SketchJoy")
        document.close()

    assert len(sheets) == len({sheet["id"] for sheet in sheets}) == 69
    duplicate_files = [
        ("coloring-pages-master.zip", "coloring-pages-master(1).zip"),
        ("كتاب-تلوين-الفواكه-والخضروات-للاطفال-pdf.pdf", "كتاب-تلوين-الفواكه-والخضروات-للاطفال-pdf (1).pdf"),
    ]
    for original, copied in duplicate_files:
        digest = lambda name: hashlib.sha256((args.upload / name).read_bytes()).digest()
        assert digest(original) == digest(copied), f"Expected duplicate: {copied}"
    credits.extend([
        "", "استُبعد غلاف كل كتاب والصفحة البيضاء الأخيرة من كتاب الأرقام.",
        "استُبعد نموذجا V وX المتشابهان جدًا مع صفحتين أخريين في كتاب الإنجليزية.",
        "coloring-pages-master(1).zip وكتاب الفواكه والخضروات (1) نسختان مطابقتان لمحتوى منشور سابقًا.",
        "ملفات ZIP الأخرى تطبيقات وأمثلة برمجية، ورسومات Android القديمة أقل جودة من الكتب المختارة؛ لم تُنشر ضمن هذه الدفعة.",
    ])
    (destination / "new-credits.txt").write_text("\n".join(credits) + "\n", encoding="utf-8")
    collections = [
        {"id": "toddlers", "title": "تلوين للصغار", "cover": "batch-toddlers-02", "tint": "#ffedda"},
        {"id": "numbers", "title": "الأرقام", "cover": "batch-numbers-01", "tint": "#e8ebff"},
    ]
    Path("src/features/games/drawing/next-catalog.ts").write_text(
        "// Generated by scripts/import_new_collection_pdfs.py from permitted attachments.\n"
        "export const nextCollections = " + json.dumps(collections, ensure_ascii=False, indent=2) + " as const;\n\n"
        "export const nextSheets = " + json.dumps(sheets, ensure_ascii=False, indent=2) + " as const;\n",
        encoding="utf-8",
    )
    print(f"Imported {len(sheets)} new coloring pages")


if __name__ == "__main__":
    main()
