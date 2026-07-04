import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // افتراضي أكثر تحفظاً من staleTime=0 الافتراضي في react-query — يقلل
        // إعادة الجلب المكرر لنفس البيانات عند التنقل/التركيز بدون داعٍ.
        // المكوّنات التي تحتاج بيانات أحدث (كالمخزون أو الطلبات الحيّة) تُحدِّد
        // staleTime أقصر خاص بها، وهذا موجود بالفعل في عدة مكوّنات.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // يجلب مسبقاً (prefetch) بيانات الصفحة عند تحويم/لمس الرابط بدل انتظار النقر
    defaultPreload: "intent",
  });

  return router;
};
