import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GAMES } from "@/features/games/types";
import type { AgeGroup, GameKey } from "@/features/games/types";
import { GamePlayer } from "@/features/games/GamePlayer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { SITE_URL } from "@/lib/siteUrl";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "ألعاب وتعليم للأطفال — كيدزي" },
      {
        name: "description",
        content: "ألعاب ذكاء تفاعلية لتعليم الأطفال الأرقام والحروف والأشكال والألوان والتلوين.",
      },
      { property: "og:title", content: "ألعاب وتعليم — كيدزي" },
      { property: "og:description", content: "ألعاب تعليمية ممتعة لتنمية مهارات طفلك." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/games` }],
  }),
  component: GamesPage,
});

function GamesPage() {
  const [active, setActive] = useState<GameKey | null>(null);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("young");
  const game = GAMES.find((g) => g.key === active);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-bold">
            <Gamepad2 className="h-4 w-4" /> العب وتعلّم
          </span>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-foreground md:text-5xl">
            ألعاب وتعليم للأطفال
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            ألعاب ذكاء تفاعلية لتنمية مهارات الطفل: الأرقام، الحروف، الأشكال، الألوان والتلوين.
          </p>
        </div>

        <div className="mx-auto mb-6 flex max-w-md items-center justify-center gap-2 rounded-2xl bg-card p-2 shadow-sm">
          <span className="ps-2 text-sm font-bold">الفئة العمرية:</span>
          {(["young", "older"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setAgeGroup(g)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                ageGroup === g ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {g === "young" ? "٣ – ٦ سنوات" : "٧ – ٩ سنوات"}
            </button>
          ))}
        </div>

        {active && game ? (
          <div className="mx-auto max-w-3xl">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActive(null)}
              className="mb-3 rounded-full"
            >
              <ArrowRight className="ms-1 h-4 w-4" /> العودة للألعاب
            </Button>
            <h2 className="mb-3 font-display text-2xl font-bold">
              {game.emoji} {game.title}
            </h2>
            <GamePlayer gameKey={active} ageGroup={ageGroup} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((g) => (
              <button
                key={g.key}
                onClick={() => setActive(g.key)}
                className={`group rounded-3xl border-4 border-transparent p-6 text-start shadow-md transition-all hover:-translate-y-1 hover:border-primary ${g.color}`}
              >
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-3xl shadow">
                  {g.emoji}
                </div>
                <h3 className="font-display text-xl font-extrabold text-foreground">{g.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{g.desc}</p>
                <span className="mt-3 inline-block rounded-full bg-card px-3 py-1 text-xs font-bold text-primary">
                  ابدأ اللعب ←
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
