import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

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
