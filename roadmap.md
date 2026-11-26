# Video activation
- [x] Replace external scene provider with Lovable credit-backed video jobs.
- [x] Enable production and update availability, private storage, and failure handling.
- [x] Provider contract tests pass; authenticated admin action reached Lovable and displayed its safe error.
- [ ] Verify completed generation and private playback: blocked by HTTP 402; the tested 10-second scene requires about 4.06 workspace AI credits. Retry only after credits are added and the owner explicitly starts generation.

# PWA
- [x] Manifest, icons, head tags, offline page, and app-shell worker verified live on kidzy.life.
- [x] Registration wrapper refuses dev, iframe, and every Lovable preview host; unregisters the app worker there.
- [x] OAuth handoffs excluded from cached navigation fallback.

# Remaining improvements
- [ ] Connect reward points to authoritative order discounts and verify redemption.
- [ ] Review remaining game-progress and formatting work; complete safe corrections.
- [ ] Fix the listed vulnerable PDF dependency and verify export compatibility.
- [ ] Provide a handoff of completed work and any remaining blockers.