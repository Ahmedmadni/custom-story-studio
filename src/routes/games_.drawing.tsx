import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FilePlus2, Layers } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { collections, sheets, type Sheet } from "@/features/games/drawing/catalog";
import { DrawingDesk } from "@/features/games/drawing/DrawingDesk";
import { SITE_URL } from "@/lib/siteUrl";
import deskStyles from "@/features/games/drawing/drawing.css?url";

interface DrawingSearch {
  group?: Sheet["group"];
  sheet?: string;
}

export const Route = createFileRoute("/games_/drawing")({
  validateSearch: (input: Record<string, unknown>): DrawingSearch => ({
    group: collections.find((c) => c.id === input.group)?.id,
    sheet: input.sheet === "blank" ? "blank" : sheets.find((s) => s.id === input.sheet)?.id,
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
  const { group, sheet } = Route.useSearch();
  const current = sheets.find((s) => s.id === sheet);
  const collection = collections.find((c) => c.id === group);
  const visible = group ? sheets.filter((s) => s.group === group) : sheets;
  return (
    <div dir="rtl" className="min-h-screen">
      <Header />
      <main className="studio-shell">
        {sheet ? (
          <>
            <Link to="/games/drawing" search={{ group }} className="studio-back">
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
                <Link to="/games/drawing" search={{ group, sheet: "blank" }}>
                  <FilePlus2 size={18} /> ورقة رسم حرّة
                </Link>
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
                search={{}}
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
                  search={{ group: c.id }}
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
              <h2>{collection?.title ?? "كل الرسمات"}</h2>
              <span>{visible.length.toLocaleString("ar-EG")} رسمة</span>
            </div>
            <div className="studio-sheets">
              {visible.map((s) => (
                <Link
                  key={s.id}
                  to="/games/drawing"
                  search={{ group, sheet: s.id }}
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
