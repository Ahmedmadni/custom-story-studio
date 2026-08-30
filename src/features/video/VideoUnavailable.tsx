import { Link } from "@tanstack/react-router";
import { VideoOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function VideoUnavailable() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <VideoOff className="mx-auto h-12 w-12 text-muted-foreground" />
      <h1 className="mt-4 font-display text-3xl font-extrabold">خدمة الفيديو غير متاحة حالياً</h1>
      <p className="mt-2 text-muted-foreground">
        نعمل على تجهيز التجربة بعناية وسنعلن عنها عند جاهزيتها.
      </p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/stories">تصفح القصص</Link>
      </Button>
    </div>
  );
}
