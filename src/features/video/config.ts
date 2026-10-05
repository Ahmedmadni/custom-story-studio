/**
 * Public Kidzy Video rollout gate.
 *
 * - Production defaults to OFF unless VITE_KIDZY_VIDEO_ENABLED=true.
 * - Development/preview defaults to ON for QA unless explicitly disabled.
 * Template availability is still controlled separately by template_product_offerings.
 */
export const isKidzyVideoEnabled = (): boolean => {
  const configured = import.meta.env.VITE_KIDZY_VIDEO_ENABLED;
  if (configured === "true") return true;
  if (configured === "false") return false;
  return !import.meta.env.PROD;
};
