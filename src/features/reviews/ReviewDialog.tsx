import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitReview } from "@/features/reviews/reviews.functions";

export function ReviewDialog({
  orderId,
  storyTitle,
  open,
  onOpenChange,
}: {
  orderId: string | null;
  storyTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const submitFn = useServerFn(submitReview);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () => submitFn({ data: { orderId: orderId!, rating, body: body.trim() || null } }),
    onSuccess: () => {
      toast.success("شكراً لتقييمك! 💛 حصلت على 30 نقطة مكافأة");
      onOpenChange(false);
      setBody("");
      setRating(5);
      void queryClient.invalidateQueries({ queryKey: ["my-reviewed-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>قيّم تجربتك {storyTitle ? `مع «${storyTitle}»` : ""}</DialogTitle>
          <DialogDescription>رأيك يساعد أهالي آخرين على الثقة بكيدزي 🌟</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1 py-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} نجوم`}
                className="p-1"
              >
                <Star
                  className={cn(
                    "h-8 w-8 transition-colors",
                    n <= rating ? "fill-accent text-accent" : "text-muted-foreground/40",
                  )}
                />
              </button>
            );
          })}
        </div>

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="اكتب رأيك (اختياري)..."
          maxLength={1000}
          rows={4}
        />

        <DialogFooter>
          <Button
            className="w-full rounded-full font-bold"
            disabled={mutation.isPending || !orderId}
            onClick={() => mutation.mutate()}
          >
            إرسال التقييم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
