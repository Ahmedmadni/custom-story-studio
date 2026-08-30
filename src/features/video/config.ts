/**
 * Public kill switch for future Kidzy Video discovery and order entry points.
 * Disabled by default so deploying the foundation cannot change current flows.
 */
export const isKidzyVideoEnabled = (): boolean =>
  import.meta.env.VITE_KIDZY_VIDEO_ENABLED === "true";
