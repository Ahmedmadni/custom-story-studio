import { Link } from "@tanstack/react-router";
import { BookOpen, MessageCircle } from "lucide-react";

import { adminWaLink } from "@/features/orders/whatsapp";

export function Footer() {
  return (
    <footer className="mt-16 border-t-4 border-secondary bg-card no-print">
      <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="font-display text-xl font-bold text-primary">
              كيدزي
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            قصص أطفال نبيلة وإنسانية، بطلها طفلك! اختر قصة، ارفع صورة طفلك،
            واستلم كتاباً مصوراً بأسلوب كرتوني ثلاثي الأبعاد ساحر.
          </p>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">روابط سريعة</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/stories" className="text-muted-foreground hover:text-primary">
                مكتبة القصص
              </Link>
            </li>
            <li>
              <Link to="/books" className="text-muted-foreground hover:text-primary">
                الكتب التعليمية
              </Link>
            </li>
            <li>
              <Link to="/cart" className="text-muted-foreground hover:text-primary">
                سلة المشتريات
              </Link>
            </li>
            <li>
              <Link to="/my-orders" className="text-muted-foreground hover:text-primary">
                متابعة طلباتي
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">تواصل معنا</h3>
          <a
            href={adminWaLink("مرحباً! لدي استفسار عن قصص كيدزي 📖")}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-grass px-5 py-2.5 text-sm font-bold text-grass-foreground shadow-md transition-transform hover:scale-105"
          >
            <MessageCircle className="h-4 w-4" />
            واتساب: 01120016502
          </a>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} كيدزي — قصص تزرع القيم في قلوب الأطفال
      </div>
    </footer>
  );
}
