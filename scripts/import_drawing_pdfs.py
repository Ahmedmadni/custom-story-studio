"""Build the Kidzy coloring gallery from the PDF books supplied by the owner.

Run from the repository root with: python scripts/import_drawing_pdfs.py /path/to/upload
The original PDFs stay outside the site; only cropped, browser-sized pages are published.
"""

from pathlib import Path
import argparse
import json

import fitz
from PIL import Image, ImageOps


# PDF basename, id, Arabic collection title, inclusive page range, normalized art crop,
# cover page (one-based), pastel tint. Cover/duplicated pages are intentionally omitted.
BOOKS = [
    ("arabic-letters-book.pdf", "letters", "حروف وحيوانات", 1, 28, (0.11, .045, .89, .94), 1, "#e1f4ed"),
    ("كتاب-تلوين-الاولاد-والابطال-pdf.pdf", "heroes", "الأبطال والمغامرات", 1, 20, (.07, .095, .93, .82), 1, "#dfeefe"),
    ("كتاب-تلوين-البنات-والأميرات-A4.pdf", "princesses", "الأميرات والخيال", 1, 15, (.07, .10, .93, .82), 1, "#f7e5f3"),
    ("كتاب-تلوين-الديناصورات-للاطفال-pdf.pdf", "dinosaurs", "الديناصورات", 1, 10, (.07, .10, .93, .82), 1, "#e4f2d8"),
    ("كتاب-تلوين-الفواكه-والخضروات-للاطفال-pdf.pdf", "produce", "الفواكه والخضروات", 1, 10, (.07, .10, .93, .82), 1, "#fff0d0"),
    ("كتاب-تلوين-المهن-والوظائف-للاطفال-pdf.pdf", "professions", "المهن", 1, 10, (.07, .10, .93, .82), 1, "#e5efff"),
    ("كتاب-تلوين-رسومات-كيوت-للاطفال-pdf.pdf", "cute", "رسومات كيوت", 2, 31, (.065, .11, .935, .905), 2, "#f5e7fe"),
    ("كتاب-تلوين-رمضان-والاعياد-للاطفال-pdf.pdf", "holidays", "رمضان والأعياد", 1, 10, (.07, .10, .93, .82), 1, "#e8f4e7"),
    ("كتاب-تلوين-سيارات-ووسائل-النقل-للاطفال-pdf.pdf", "vehicles", "السيارات والمواصلات", 2, 21, (.09, .135, .91, .77), 2, "#e5f4f7"),
    ("كتاب-تلوين-ماندالا-للكبار-والاسترخاء.pdf", "mandala", "الزخارف والماندالا", 2, 21, (.065, .18, .935, .84), 2, "#f1e8fa"),
]
SINGLES = [
    ("المرح في الشمس_ Otter.pdf", "sunny-otter", "ثعلب الماء في الشمس"),
    ("حب الكوالا!.pdf", "koala-love", "الكوالا المحبوب"),
    ("حديث الحيتان.pdf", "whales", "حديث الحيتان"),
    ("حرف التعلم A.pdf", "letter-a", "تعلّم حرف A"),
    ("حفلة شاي على البحر.pdf", "beach-tea", "حفلة شاي على البحر"),
    ("فتاة صغيرة - بقلم كيتورا أرييل.pdf", "little-girl", "الفتاة الصغيرة"),
    ("كل ما يتعلق بعيد الأم.pdf", "mothers-day", "عيد الأم"),
    ("مخطط مونستر للواجبات المنزلية.pdf", "monster-planner", "مخطط الواجبات"),
    ("مرحبًا بالصيف!.pdf", "hello-summer", "مرحبًا بالصيف"),
]
ARABIC_LETTERS = "أ ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن هـ و ي".split()


def page_title(page, slug, title, ordinal):
    if slug == "letters":
        return f"حرف {ARABIC_LETTERS[ordinal - 1]}"
    if slug in {"heroes", "princesses", "dinosaurs", "produce", "professions", "holidays"}:
        # The caption is supplied as Arabic in reverse visual word order by these PDFs.
        lines = page.get_text().splitlines()
        caption = lines[2].split("(")[-1].strip()
        readable = " ".join(reversed(caption.split()))
        for old, new in {"اأ": "الأ", "اآ": "الآ", "اإ": "الإ", "االن": "الان"}.items():
            readable = readable.replace(old, new)
        for old, new in {"الإلطفاء": "الإطفاء", "الإلنقاذ": "الإنقاذ", "الانطالق": "الانطلاق"}.items():
            readable = readable.replace(old, new)
        return readable
    return f"{title} {ordinal}"


def make_sheet(page, crop, dest):
    rect = page.rect
    clip = fitz.Rect(rect.x1 * crop[0], rect.y1 * crop[1], rect.x1 * crop[2], rect.y1 * crop[3])
    scale = max(900 / clip.width, 1200 / clip.height) * 1.35
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False)
    original = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    # Extract ink only; the colored book header/caption are outside the crop.
    gray = ImageOps.grayscale(original)
    gray = gray.point(lambda value: min(255, max(0, int((value - 120) * 2.1))))
    gray.thumbnail((824, 1100), Image.Resampling.LANCZOS)
    sheet = Image.new("L", (900, 1200), 255)
    sheet.paste(gray, ((900 - gray.width) // 2, (1200 - gray.height) // 2))
    sheet.save(dest.with_suffix(".webp"), "WEBP", quality=88, method=5)
    thumbnail = sheet.copy()
    thumbnail.thumbnail((300, 400), Image.Resampling.LANCZOS)
    thumbnail.save(dest.parent / (dest.name + "-cover.webp"), "WEBP", quality=78, method=5)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("upload", type=Path)
    args = parser.parse_args()
    destination = Path("public/drawing")
    destination.mkdir(parents=True, exist_ok=True)
    collections = []
    sheets = []
    credits = ["مصادر صفحات التلوين التي قدمها صاحب الموقع (اسم ملف PDF الأصلي):", ""]
    for name, slug, title, first, last, crop, cover, tint in BOOKS:
        source = args.upload / name
        doc = fitz.open(source)
        assert len(doc) >= last, f"Missing pages: {source}"
        collections.append({"id": slug, "title": title, "cover": f"{slug}-{cover:02}", "tint": tint})
        credits.append(f"{title}: {name} — الصفحات {first}–{last}")
        for number in range(first, last + 1):
            key = f"{slug}-{number:02}"
            make_sheet(doc[number - 1], crop, destination / key)
            sheets.append({"id": key, "title": page_title(doc[number - 1], slug, title, number - first + 1), "group": slug})
        doc.close()
    collections.append({"id": "special", "title": "رسومات متنوعة", "cover": "sunny-otter", "tint": "#fff0d9"})
    for name, slug, title in SINGLES:
        doc = fitz.open(args.upload / name)
        assert len(doc) == 1
        make_sheet(doc[0], (.025, .025, .975, .975), destination / slug)
        sheets.append({"id": slug, "title": title, "group": "special"})
        credits.append(f"{title}: {name}")
        doc.close()
    credits.extend(["", "ملف professions-book.pdf نسخة مكررة من كتاب المهن؛ لم نكرر رسوماته.",
                    "أزيلت أغلفة الكتب من المعرض، واستُخدمت فقط صفحات التلوين.",
                    "colorbook.ma و printables.hp.com من المصادر الظاهرة في الصفحات المرفقة.",
                    "", "تُنسب مجموعة الرسومات المتجهة الـ75 إلى أصحاب الأعمال المذكورين في /drawing/svg-credits.txt.",
                    "مصادر الدفعة الإضافية (19 رسمة): /drawing/attachment-credits.txt."])
    (destination / "credits.txt").write_text("\n".join(credits) + "\n", encoding="utf-8")
    catalog = ("// Generated by scripts/import_drawing_pdfs.py from the owner's supplied PDFs.\n"
               "import { svgCollections, svgSheets } from './svg-catalog';\n"
               "import { extraSheets } from './extra-catalog';\n\n"
               "const pdfCollections = " + json.dumps(collections, ensure_ascii=False, indent=2) + " as const;\n\n"
               "export const collections = [...pdfCollections, ...svgCollections] as const;\n\n"
               "export interface Sheet {\n  id: string;\n  title: string;\n"
               "  group: (typeof collections)[number][\"id\"];\n}\n\n"
               "const pdfSheets = " + json.dumps(sheets, ensure_ascii=False, indent=2) + " as const;\n\n"
               "export const sheets: Sheet[] = [...extraSheets, ...svgSheets, ...pdfSheets];\n")
    Path("src/features/games/drawing/catalog.ts").write_text(catalog, encoding="utf-8")
    print(f"Created {len(sheets)} coloring pages in {len(collections)} collections")


if __name__ == "__main__":
    main()
