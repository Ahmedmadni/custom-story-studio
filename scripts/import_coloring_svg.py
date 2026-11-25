"""Import the 75 vector coloring sheets from pavelkukov/coloring-pages.

Usage: python scripts/import_coloring_svg.py /path/to/coloring-pages-master.zip
The source archive is not copied into the site. Rasterized art avoids embedding SVG
scripts or network references in children's pages and matches the portrait paint desk.
"""

import argparse
import json
import re
from pathlib import Path
from zipfile import ZipFile

import fitz
from PIL import Image, ImageOps


TITLES = {
    "a_is_for_airplane": "حرف A والطائرة", "abstract_mandala": "ماندالا تجريدية", "abstract_mandala_1": "ماندالا متشابكة",
    "alpaca": "الألبكة", "b_is_for_bird": "حرف B والطائر", "bear_with_flower": "الدب والزهرة",
    "bitten_apple": "التفاحة المقضومة", "blank": "صفحة بيضاء", "boy_surfer": "راكب الأمواج",
    "bunny_and_eggs": "الأرنب والبيض", "butterfly_tattoo": "الفراشة المزخرفة", "c_is_for_cake": "حرف C والكعكة",
    "camel": "الجمل", "cartoon_frog": "الضفدع المرح", "celtic_mandala": "ماندالا سلتيّة",
    "celtic_ornament_book_of_kells": "زخارف كتاب كيلز", "chibi_princess": "الأميرة الصغيرة",
    "creazilla_dragon": "التنين المجنح", "cute_butterfly": "الفراشة المبتسمة",
    "cute_butterfly_flies_over_pumpkin": "الفراشة واليقطينة", "cute_cow": "البقرة الصغيرة",
    "cute_horse": "الحصان والفراشة", "d_is_for_donut": "حرف D والدونات", "donkey": "الحمار الصغير",
    "dove": "الحمامة", "dragon": "التنين الطائر", "e_is_for_egg": "حرف E والبيضة",
    "easter_basket": "سلة البيض", "easter_egg": "بيضة مزخرفة", "easter_egg_with_stars": "بيضة النجوم",
    "elephant_mandala": "فيل مزخرف", "fairy_tattoo": "الجنية المزخرفة", "fishing_fish": "السمكة الصيادة",
    "five_pointed_star": "نجمة خماسية", "flowers_with_paisley_patterns": "زهور البايزلي",
    "gingerbread_man": "رجل الزنجبيل", "girl_with_a_pearl_earring": "الفتاة ذات القرط اللؤلؤي",
    "grape": "عنقود العنب", "hasma": "كف مزخرف", "heart": "قلب بسيط",
    "horse_caricature": "الحصان الظريف", "hummingbird": "الطائر الطنان", "jellyfish": "قنديل البحر",
    "juice_and_cake": "العصير والكعكة", "kawaii_unicorn_cloud": "وحيد القرن والغيمة",
    "knight_on_horse": "الفارس على الحصان", "ladybug_on_leaf": "دعسوقة على ورقة",
    "little_pony": "المهر الصغير", "locked_heart": "القلب المقفل", "mandala_pattern_1": "نقش ماندالا ١",
    "mandala_pattern_2": "نقش ماندالا ٢", "mosaic_heart": "قلب الفسيفساء",
    "octo": "أخطبوط عيد الميلاد", "octopus": "الأخطبوط", "owl": "البومة", "p_is_for_princess": "حرف P والأميرة",
    "peace_dove_by_picasso": "حمامة السلام", "poppies_coloring_page": "زهور الخشخاش",
    "pumpkin": "اليقطينة", "s_s_edmund_fitzgerald": "السفينة إدموند فيتزجيرالد",
    "santa_and_rudolf": "سانتا ورادولف", "shark_jaws": "سمكة القرش", "sleeping_cat": "القطة النائمة",
    "snowman": "رجل الثلج", "spring_bird": "طائر الربيع", "spring_flowers": "زهور الربيع",
    "spring_rain": "مطر الربيع", "square": "مربع للتلوين", "summer_beach": "شاطئ الصيف",
    "sun_mandala": "ماندالا الشمس", "sun_mandala_2": "شمس مزخرفة",
    "tessellation_with_triangle_and_square": "فسيفساء المثلث والمربع", "trees": "الأشجار",
    "two_easter_bunnies": "أرنبا العيد", "zentangle_fruits_and_chalice": "فاكهة مزخرفة",
}

GROUPS = {
    "english": {"a_is_for_airplane", "b_is_for_bird", "c_is_for_cake", "d_is_for_donut", "e_is_for_egg", "p_is_for_princess"},
    "animals": {"alpaca", "bear_with_flower", "camel", "cartoon_frog", "cute_cow", "cute_horse", "donkey", "dove", "horse_caricature", "hummingbird", "little_pony", "owl", "sleeping_cat"},
    "sea": {"boy_surfer", "fishing_fish", "jellyfish", "octo", "octopus", "shark_jaws", "summer_beach"},
    "nature": {"butterfly_tattoo", "cute_butterfly", "cute_butterfly_flies_over_pumpkin", "flowers_with_paisley_patterns", "ladybug_on_leaf", "poppies_coloring_page", "spring_bird", "spring_flowers", "spring_rain", "trees"},
    "seasonal": {"bunny_and_eggs", "easter_basket", "easter_egg", "easter_egg_with_stars", "gingerbread_man", "pumpkin", "santa_and_rudolf", "snowman", "two_easter_bunnies"},
    "shapes": {"blank", "five_pointed_star", "hasma", "heart", "locked_heart", "mosaic_heart", "square", "tessellation_with_triangle_and_square"},
    "mandala": {"abstract_mandala", "abstract_mandala_1", "celtic_mandala", "celtic_ornament_book_of_kells", "elephant_mandala", "mandala_pattern_1", "mandala_pattern_2", "sun_mandala", "sun_mandala_2", "zentangle_fruits_and_chalice"},
    "princesses": {"chibi_princess", "fairy_tattoo"},
    "heroes": {"creazilla_dragon", "dragon", "knight_on_horse"},
    "produce": {"bitten_apple", "grape"},
    "cute": {"juice_and_cake", "kawaii_unicorn_cloud"},
    "vehicles": {"s_s_edmund_fitzgerald"},
    "special": {"girl_with_a_pearl_earring", "peace_dove_by_picasso"},
}

NEW_COLLECTIONS = [
    {"id": "animals", "title": "الحيوانات", "cover": "vector-bear_with_flower", "tint": "#fbeed9"},
    {"id": "sea", "title": "البحر والشاطئ", "cover": "vector-jellyfish", "tint": "#e2f3f9"},
    {"id": "nature", "title": "الطبيعة والزهور", "cover": "vector-spring_flowers", "tint": "#e7f4dc"},
    {"id": "english", "title": "الحروف الإنجليزية", "cover": "vector-a_is_for_airplane", "tint": "#fff1dd"},
    {"id": "seasonal", "title": "المواسم والاحتفالات", "cover": "vector-snowman", "tint": "#e9efff"},
    {"id": "shapes", "title": "الأشكال البسيطة", "cover": "vector-five_pointed_star", "tint": "#ffebeb"},
]


ROTATE_COUNTERCLOCKWISE = {"juice_and_cake", "s_s_edmund_fitzgerald", "trees"}


def render(svg_bytes, full, cover, name):
    document = fitz.open(stream=svg_bytes, filetype="svg")
    assert len(document) == 1
    page = document[0]
    scale = min(840 / page.rect.width, 1120 / page.rect.height)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    gray = ImageOps.grayscale(image)
    if name in ROTATE_COUNTERCLOCKWISE:
        gray = gray.rotate(90, expand=True)
        gray.thumbnail((840, 1120), Image.Resampling.LANCZOS)
    sheet = Image.new("L", (900, 1200), 255)
    sheet.paste(gray, ((900 - gray.width) // 2, (1200 - gray.height) // 2))
    sheet.save(full, "WEBP", quality=88, method=5)
    sheet.thumbnail((300, 400), Image.Resampling.LANCZOS)
    sheet.save(cover, "WEBP", quality=78, method=5)
    document.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    destination = Path("public/drawing")
    manifest = Path("src/features/games/drawing/svg-catalog.ts")
    group_for = {name: group for group, names in GROUPS.items() for name in names}
    assert len(group_for) == sum(map(len, GROUPS.values())) == 75
    with ZipFile(args.archive) as source:
        entries = sorted(n for n in source.namelist() if n.startswith("coloring-pages-master/images/") and n.endswith(".svg"))
        assert len(entries) == 75
        assert {Path(n).stem for n in entries} == set(TITLES) == set(group_for)
        metadata = json.loads(source.read("coloring-pages-master/collection.json"))
        sheets = []
        credits = ["مكتبة SVG من pavelkukov/coloring-pages (75 رسمًا):",
                   "https://github.com/pavelkukov/coloring-pages",
                   "صور WebP مشتقة من SVG لتناسب مساحة التلوين الطولية؛ احتُفظ بأسماء الفنانين وروابط الأعمال.",
                   "الترخيص العام للمستودع: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/",
                   "النص الكامل: /drawing/svg-license.txt", ""]
        for entry in entries:
            name = Path(entry).stem
            key = "vector-" + name
            svg = source.read(entry)
            render(svg, destination / (key + ".webp"), destination / (key + "-cover.webp"), name)
            sheets.append({"id": key, "title": TITLES[name], "group": group_for[name]})
            original_license = re.search(rb'<cc:license[^>]*rdf:resource="([^"]+)', svg)
            license_url = original_license.group(1).decode() if original_license else "See repository license"
            note = "؛ أذن مالك الموقع بالاستخدام الإضافي" if name in {"girl_with_a_pearl_earring", "peace_dove_by_picasso"} else ""
            record = metadata[Path(entry).name]
            credits.append(f"{TITLES[name]} ({Path(entry).name}) — {record['author']} — {record['source'] or 'المستودع الأصلي'} — {license_url}{note}")
        (destination / "svg-license.txt").write_bytes(source.read("coloring-pages-master/LICENSE"))
        (destination / "svg-credits.txt").write_text("\n".join(credits) + "\n", encoding="utf-8")
        manifest.write_text("// Generated from pavelkukov/coloring-pages by scripts/import_coloring_svg.py.\n"
                            "export const svgCollections = " + json.dumps(NEW_COLLECTIONS, ensure_ascii=False, indent=2) + " as const;\n\n"
                            "export const svgSheets = " + json.dumps(sheets, ensure_ascii=False, indent=2) + " as const;\n", encoding="utf-8")
    print(f"Imported {len(sheets)} vector sheets into {len(NEW_COLLECTIONS)} new collections")


if __name__ == "__main__":
    main()
