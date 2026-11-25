"""Extract the coloring art, rather than UI assets, from the owner's app archives.

Run from the repository root: python scripts/import_archive_art.py /path/to/upload
The source ZIP from the GPLv3 Android archive is published beside the converted art.
"""

import argparse
import io
import json
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import fitz
from PIL import Image, ImageOps


ANDROID_TITLES = [
    "مناطيد الهواء", "سفينة الفضاء", "الخيول", "القلعة", "المنزل الريفي", "الديناصور",
    "الزهور والفراشات", "الحياة البحرية", "حديقة الحيوانات", "السيارة والمطعم", "الطائرة",
    "كعكة الميلاد", "الشاحنة الكبيرة", "الدراجة النارية", "الطائرة المقاتلة", "الكلب",
    "الفراشة", "الحلزون", "المروحية", "النحلة", "العنكبوت", "المدينة القديمة",
    "الفضاء الخارجي", "خريطة العالم",
]
EXAMPLES = [
    ("astronaut.png", "خوذة رائد الفضاء", "heroes"),
    ("eagle.png", "النسر على الغصن", "animals"),
    ("glass.jpg", "زخارف الزجاج", "mandala"),
]
INLINE = [
    ("cat", "قطة بسيطة", "animals"),
    ("flower", "زهرة بسيطة", "nature"),
    ("house", "منزل بسيط", "shapes"),
    ("butterfly", "فراشة بسيطة", "nature"),
]


def save_sheet(original, destination, *, lighten=False):
    rgba = original.convert("RGBA")
    backdrop = Image.new("RGBA", rgba.size, "white")
    gray = ImageOps.grayscale(Image.alpha_composite(backdrop, rgba))
    if lighten:
        # The example astronaut has a printed checkerboard behind its outline.
        gray = gray.point(lambda pixel: 255 if pixel > 190 else pixel)
    gray.thumbnail((824, 1100), Image.Resampling.LANCZOS)
    sheet = Image.new("L", (900, 1200), 255)
    sheet.paste(gray, ((900 - gray.width) // 2, (1200 - gray.height) // 2))
    sheet.save(destination.with_suffix(".webp"), "WEBP", quality=88, method=5)
    sheet.thumbnail((300, 400), Image.Resampling.LANCZOS)
    sheet.save(destination.parent / (destination.name + "-cover.webp"), "WEBP", quality=78, method=5)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("upload", type=Path)
    args = parser.parse_args()
    destination = Path("public/drawing")
    sheets = []
    collections = [
        {"id": "classic", "title": "رسومات كلاسيكية", "cover": "archive-android-01", "tint": "#e6f2fa"},
    ]
    credits = [
        "31 قالب تلوين من التطبيقات المرفقة؛ لم تُضف أي شعارات أو لقطات للشاشة:", "",
        "رسومات Android الأصلية (24): Peter Dornbach، من niccokunzmann/coloring-book.",
        "التحويل إلى WebP سنة 2026؛ الرسومات مشتقة من مصادر GPLv3 المرفقة بالمستودع.",
        "ملف المصدر والنسخة الأصلية من LICENSE وNOTICE: /drawing/coloring-book-outlines-source.zip", "",
    ]
    with ZipFile(args.upload / "coloring-book-master.zip") as source:
        originals = sorted(n for n in source.namelist() if "/drawable-mdpi/outline" in n and n.endswith(".png"))
        assert len(originals) == len(ANDROID_TITLES) == 24
        with ZipFile(destination / "coloring-book-outlines-source.zip", "w", ZIP_DEFLATED) as output:
            for number, path in enumerate(originals, 1):
                key = f"archive-android-{number:02}"
                save_sheet(Image.open(io.BytesIO(source.read(path))), destination / key)
                sheets.append({"id": key, "title": ANDROID_TITLES[number - 1], "group": "classic"})
                output.writestr(Path(path).name, source.read(path))
                credits.append(f"{ANDROID_TITLES[number - 1]} — {Path(path).name}")
            for name in ["LICENSE", "NOTICE"]:
                output.writestr(name, source.read("coloring-book-master/" + name))

    credits.extend([
        "", "رسومات مثال JL Coloring Book (3): Copyright Joe Love / primoweb.com؛ المشروع متاح للاستخدام في المواقع وفق README المرفق.",
        "https://github.com/collinph/jl-coloringbook",
    ])
    with ZipFile(args.upload / "jl-coloringbook-master.zip") as source:
        for filename, title, group in EXAMPLES:
            path = "jl-coloringbook-master/example/images/" + filename
            key = "archive-jl-" + Path(filename).stem
            save_sheet(Image.open(io.BytesIO(source.read(path))), destination / key, lighten=filename == "astronaut.png")
            sheets.append({"id": key, "title": title, "group": group})
            credits.append(f"{title} — {path}")

    credits.extend([
        "", "أربعة قوالب SVG مضمنة في TemplateSelector.tsx من yajuarya/coloring-book.",
        "يشير README إلى MIT، لكن ملف LICENSE غير موجود في النسخة المرفقة؛ احتُفظ بالمصدر والنسبة هنا.",
        "https://github.com/yajuarya/coloring-book",
    ])
    with ZipFile(args.upload / "coloring-book-main.zip") as source:
        code = source.read("coloring-book-main/src/components/TemplateSelector.tsx").decode()
        for name, title, group in INLINE:
            match = re.search(r"id: '" + name + r"'.*?btoa\(`(.*?)`\)", code, re.S)
            assert match, f"Missing original inline SVG: {name}"
            svg = match.group(1).strip().encode()
            document = fitz.open(stream=svg, filetype="svg")
            page = document[0]
            scale = min(824 / page.rect.width, 1100 / page.rect.height)
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            original = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            key = "archive-inline-" + name
            save_sheet(original, destination / key)
            sheets.append({"id": key, "title": title, "group": group})
            credits.append(f"{title} — TemplateSelector.tsx#{name}")
            document.close()

    assert len(sheets) == len({s["id"] for s in sheets}) == 31
    credits.extend([
        "", "coloring-pages-master(1).zip نسخة مطابقة للمجموعة الـ75 المنشورة في /drawing/svg-credits.txt.",
        "صور PNG داخلها تمثل الرسومات SVG نفسها، لذلك لم تتكرر في المعرض.",
        "coloring-books-for-kids-main.zip يولّد الصور عند الطلب ولا يحوي صفحات تلوين ثابتة.",
        "صور الواجهة والأيقونات ولقطات التطبيق في باقي الملفات ليست صفحات قابلة للتلوين.",
    ])
    (destination / "archive-credits.txt").write_text("\n".join(credits) + "\n", encoding="utf-8")
    Path("src/features/games/drawing/archive-catalog.ts").write_text(
        "// Generated by scripts/import_archive_art.py from the owner's app archives.\n"
        "export const archiveCollections = " + json.dumps(collections, ensure_ascii=False, indent=2) + " as const;\n\n"
        "export const archiveSheets = " + json.dumps(sheets, ensure_ascii=False, indent=2) + " as const;\n",
        encoding="utf-8",
    )
    print(f"Imported {len(sheets)} unique archived coloring templates")


if __name__ == "__main__":
    main()
