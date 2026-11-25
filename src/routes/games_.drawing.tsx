import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FilePlus2, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { collections, sheets, type Sheet } from "@/features/games/drawing/catalog";
import { DrawingDesk } from "@/features/games/drawing/DrawingDesk";
import { PwaInstallButton } from "@/features/games/drawing/PwaInstallButton";
import { drawingStorageKey, hasSavedArtwork } from "@/features/games/drawing/progress";
import { SITE_URL } from "@/lib/siteUrl";
import deskStyles from "@/features/games/drawing/drawing.css?url";

interface DrawingSearch {
  group?: Sheet["group"];
  sheet?: string;
  mine?: boolean;
}

export const Route = createFileRoute("/games_/drawing")({
  validateSearch: (input: Record<string, unknown>): DrawingSearch => ({
    group: collections.find((c) => c.id === input.group)?.id,
    sheet: input.sheet === "blank" ? "blank" : sheets.find((s) => s.id === input.sheet)?.id,
    mine: input.mine === true || input.mine === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "مرسم كيدزي | لعبة الرسم والتلوين للأطفال" },
      {
        name: "description",
        content:
          "اختر رسمة من كتب التلوين في مجموعات الحيوانات والأميرات والديناصورات والمهن وغيرها، ولوّنها بفرشاتك وأقلامك.",
      },
    ],
    links: [
      { rel: "stylesheet", href: deskStyles },
      { rel: "canonical", href: SITE_URL + "/games/drawing" },
    ],
  }),
  component: Studio,
});

function Studio() {
  const { group, sheet, mine } = Route.useSearch();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [checkedSaved, setCheckedSaved] = useState(false);
  useEffect(() => {
    if (sheet) return;
    const refresh = () => {
      const found = new Set<string>();
      try {
        for (const id of ["blank", ...sheets.map((item) => item.id)]) {
          if (hasSavedArtwork(localStorage.getItem(drawingStorageKey(id)))) found.add(id);
        }
      } catch {
        // The gallery remains available if local storage is disabled.
      }
      setSavedIds(found);
      setCheckedSaved(true);
    };
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [sheet]);
  const current = sheets.find((s) => s.id === sheet);
  const collection = collections.find((c) => c.id === group);
  const visible = sheets.filter(
    (s) => (!group || s.group === group) && (!mine || savedIds.has(s.id)),
  );
  const freeDrawing = !!mine && !group && savedIds.has("blank");
  return (
    <div dir="rtl" className="min-h-screen">
      <Header />
      <main className="studio-shell">
        {sheet ? (
          <>
            <Link to="/games/drawing" search={{ group, mine }} className="studio-back">
              <ArrowRight size={17} /> معرض الرسمات
            </Link>
            <DrawingDesk key={sheet} id={sheet} title={current?.title ?? "ورقتي الحرة"} />
          </>
        ) : (
          <>
            <Link to="/games" className="studio-back">
              <ArrowRight size={17} /> الألعاب
            </Link>
            <header className="studio-hero">
              <div>
                <h1>مرسم كيدزي</h1>
                <p>اختر رسمتك، وافتح علبة ألوانك.</p>
                <Link to="/games/drawing" search={{ group, sheet: "blank", mine }}>
                  <FilePlus2 size={18} /> ورقة رسم حرّة
                </Link>
                <PwaInstallButton />
              </div>
              <div className="studio-fan" aria-hidden="true">
                {["dinosaurs-01", "princesses-01", "cute-02"].map((id) => (
                  <img key={id} src={"/drawing/" + id + "-cover.webp"} alt="" />
                ))}
              </div>
            </header>
            <nav className="studio-collections" aria-label="مجموعات الرسم">
              <Link
                to="/games/drawing"
                search={{ mine }}
                resetScroll={false}
                data-selected={!group}
                aria-current={!group ? "true" : undefined}
              >
                <span className="studio-disc studio-all">
                  <Layers size={28} />
                </span>
                كل الرسمات
              </Link>
              {collections.map((c) => (
                <Link
                  key={c.id}
                  to="/games/drawing"
                  search={{ group: c.id, mine }}
                  resetScroll={false}
                  data-selected={group === c.id}
                  aria-current={group === c.id ? "true" : undefined}
                >
                  <span className="studio-disc" style={{ backgroundColor: c.tint }}>
                    <img src={"/drawing/" + c.cover + "-cover.webp"} alt="" />
                  </span>
                  {c.title}
                </Link>
              ))}
            </nav>
            <div className="studio-list-head">
              <h2>{mine ? "رسوماتي" : (collection?.title ?? "كل الرسمات")}</h2>
              <span>
                {!mine || checkedSaved
                  ? `${(visible.length + Number(freeDrawing)).toLocaleString("ar-EG")} رسمة`
                  : "جارٍ البحث عن رسوماتك…"}
              </span>
            </div>
            <nav className="studio-progress-filter" aria-label="تصفية الرسمات">
              <Link
                to="/games/drawing"
                search={{ group }}
                resetScroll={false}
                aria-current={!mine ? "page" : undefined}
              >
                كل الرسمات
              </Link>
              <Link
                to="/games/drawing"
                search={{ group, mine: true }}
                resetScroll={false}
                aria-current={mine ? "page" : undefined}
              >
                رسوماتي ({savedIds.size.toLocaleString("ar-EG")})
              </Link>
            </nav>
            {mine && <p className="studio-progress-note">رسوماتك محفوظة على هذا الجهاز.</p>}
            {mine && checkedSaved && visible.length === 0 && !freeDrawing && (
              <div className="studio-empty">
                <p>لا توجد رسومات محفوظة هنا بعد. اختر رسمة وابدأ تلوينها!</p>
                <Link to="/games/drawing" search={{ group }}>
                  تصفّح الرسمات
                </Link>
              </div>
            )}
            <div className="studio-sheets">
              {freeDrawing && (
                <Link
                  to="/games/drawing"
                  search={{ sheet: "blank", mine: true }}
                  className="studio-card studio-free-card"
                >
                  <div>
                    <FilePlus2 size={64} aria-hidden="true" />
                  </div>
                  <span>
                    ورقتي الحرة <ArrowLeft size={16} />
                  </span>
                </Link>
              )}
              {visible.map((s) => (
                <Link
                  key={s.id}
                  to="/games/drawing"
                  search={{ group, sheet: s.id, mine }}
                  className="studio-card"
                >
                  <div>
                    <img
                      src={"/drawing/" + s.id + "-cover.webp"}
                      alt=""
                      loading="lazy"
                      width={300}
                      height={400}
                    />
                    {savedIds.has(s.id) && <small className="studio-saved">قيد التلوين</small>}
                  </div>
                  <span>
                    {s.title}
                    <ArrowLeft size={16} />
                  </span>
                </Link>
              ))}
            </div>
            <a className="studio-credits" href="/drawing/credits.txt">
              مصادر الرسومات
            </a>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
