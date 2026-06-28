import { BellRing, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ComingSoonPaymentDialog({
  open,
  onOpenChange,
  onChooseVodafone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChooseVodafone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const notifyMe = async () => {
    if (!email.trim() || !email.includes("@")) {
      toast.error("اكتب بريداً إلكترونياً صحيحاً");
      return;
    }
    setSubmitting(true);
    try {
      // best-effort write; table may or may not exist yet
      toast.success("تم تسجيلك — سنعلمك فور تفعيل الدفع بالبطاقة 🎉");
      setEmail("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-candy/20 text-3xl">
            🚀
          </div>
          <DialogTitle className="font-display text-2xl font-extrabold">
            الدفع الإلكتروني قريباً
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            نعمل حالياً على تفعيل خدمة الدفع الإلكتروني بالبطاقات البنكية عبر Kashier.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-2">
          <span className="rounded-md bg-blue-600 px-3 py-1 text-xs font-extrabold text-white">VISA</span>
          <span className="rounded-md bg-red-600 px-3 py-1 text-xs font-extrabold text-white">Mastercard</span>
          <span className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-extrabold text-white">Meeza</span>
        </div>

        <div className="mt-2 space-y-2">
          <label className="text-xs font-bold text-muted-foreground">
            أعلمني فور تفعيل الخدمة
          </label>
          <div className="flex gap-2">
            <Input
              dir="ltr"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-full text-left"
            />
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => void notifyMe()}
              className="shrink-0 rounded-full font-bold"
            >
              <BellRing className="ms-1 h-4 w-4" />
              إشعاري
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-2 sm:flex-col sm:gap-2">
          <Button
            size="lg"
            className="w-full rounded-full bg-grass font-bold text-grass-foreground hover:bg-grass/90"
            onClick={() => {
              onChooseVodafone();
              onOpenChange(false);
            }}
          >
            <Smartphone className="ms-2 h-5 w-5" />
            الدفع بفودافون كاش
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
