# Page override: Landing (`/`)

> Overrides MASTER.md for the marketing landing page only. Source: ui-ux-pro-max
> (`--design-system "educational developer tool interactive learning platform AI dark" --variance 6 --motion 3 --density 4`,
> `--domain landing`, `--domain style`). The playground (`/app/`) keeps MASTER.md as-is.

## Pattern — Product Demo + Features
Section order: 1. Hero with live-looking product demo (the agent loop) · 2. "Inside the model" feature bento ·
3. How it works (3 steps) · 4. Learning path (01–06) · 5. FAQ · 6. Final CTA.
Primary CTA "Open the playground" in hero + final section; secondary "Start learning".

## Style — Modern layered (light cream/green palette)
- Palette from MASTER.md (cream `#FBF5DD`, khaki `#E7E1B1`, green `#306D29`, dark green `#0D530E`); originally Modern Dark, switched to light at the user's request.
- Layered surfaces: page `--color-bg`, elevated cards `--color-surface`, glass header `rgba(251,245,221,.82)` + `backdrop-filter: blur(12px)`.
- Hairline borders `rgba(13,83,14,.10–.18)`; hover border → accent.
- Radius 16px for cards/windows (`--radius-lg`), 999px for pills.
- Ambient light: 1–2 static radial-gradient glows (accent / info), opacity ≤ .18. No animated blobs (perf).
- Accent glow behind the primary button only.
- Easing `cubic-bezier(0.16, 1, 0.3, 1)`, 150–300ms.

## Motion (dial 3 — subtle)
- Hero demo: steps fade + rise 8px in sequence (CSS `animation-delay`), once. No JS.
- Content is in the DOM and visible to crawlers; `prefers-reduced-motion: reduce` → everything shown immediately.

## Typography
- Display: Inter 700, letter-spacing -0.03em, `clamp(2.25rem, 6vw, 4rem)`.
- Labels/eyebrows/numbers: JetBrains Mono 500, uppercase, +0.08em tracking.
- Body 16–18px, line-height 1.6.

## Avoid
Emoji icons · hover-only affordances · text < 12px · layout shift from fonts/animation.
