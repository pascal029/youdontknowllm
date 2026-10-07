# Page override: Learn (`/learn/` + `/learn/*/`)

> Overrides MASTER.md for the guides. Inherits the Modern Dark surfaces/borders/radius from `pages/landing.md`.
> Source: ui-ux-pro-max `--domain ux` (line length, line height, breadcrumbs, heading hierarchy, keyboard nav),
> `--domain typography` ("technical documentation readable developer").

## Learn index — numbered learning path
- Lessons rendered from one list (`LESSONS` in site.config.ts), in order 01 → 06.
- Each row: mono number, title (h2), one-line description, reading time, arrow. Whole row is the link (≥ 44px target).
- "Start with lesson 01" primary CTA.

## Article
- Reading column 68ch max (UX: 65–75 chars), body 1.0625rem, line-height 1.75.
- Header: breadcrumb (Home / Learn / Lesson) · eyebrow "Lesson n of 6 · x min read" · h1 · lead.
- Code blocks: elevated surface, radius 12px, horizontal scroll inside the block only (never the page).
- "Try it" callout stays (accent hairline border, tinted surface).
- **Bottom navigation: Previous / Next cards with the lesson titles** (replaces "Keep learning").
  - `<nav aria-label="Lessons">`, two cards side by side (stack on mobile), labels "← Previous" / "Next →" in mono.
  - First lesson: Previous card links back to "All guides". Last lesson: Next card links to "Open the playground".
  - `rel="prev"` / `rel="next"` on the links.
- Heading levels sequential (h1 → h2), keyboard order = visual order.
