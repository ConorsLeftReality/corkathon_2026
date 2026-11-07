---
name: designing-ui
description: Use when building or restyling any user interface, page, component, layout, theme, landing page or visual asset, or choosing colours, type, spacing or motion
---

# Designing UI

If a screenshot could pass for any AI-generated template, the design failed.
Pick a direction that belongs to the product, then hold it with tokens. For a
new direction, REQUIRED: frontend-design:frontend-design.

## The default look to avoid

- Purple, blue and cyan gradients, violet glow, the stock crypto gradient.
- Unstyled shadcn zinc, stock Aceternity effects, a free 3D icon pack.
- A centred hero, then three feature cards, then a logo strip, as a reflex.
- Eyebrow labels above headings, ALL CAPS labels, trailing arrows on buttons.
- Fade-up on scroll, hover lift on every card, anything that moves while idle.
- Emoji as icons. Gradient text on body copy. Glass with nothing behind it.

## Tokens

- Colours, spacing, radius, shadows and durations are tokens (Tailwind v4
  `@theme` in `theme.css`). No raw hex in components. No `tailwind.config.js`.
- A small palette where every colour has a job. Brand and outcome colours
  (success, error) never share a hue. The accent is scarce: three uses per screen at most.
- Body text meets 4.5:1 contrast, checked at the worst stop of any gradient
  behind it. Where practical, a test recomputes contrast from the tokens.
- One family for UI text. Numbers use tabular figures, mono for money and stats.

## Layout

- Mobile first. Works at 360px with no horizontal scroll, checked again at 1440px.
- Every flow has loading, empty and error states, plus stale for live data.
- Keyboard reachable with a visible focus ring. Behaviour and ARIA come from
  Radix through shadcn: do not rewrite them.
- Body text sits on solid surfaces, never on blur. Content scrolls under fixed chrome.
- Spacing comes from the scale. Alignment is deliberate, not centred by default.

## Components

Copy-in libraries (shadcn, Aceternity, Magic UI) are a starting point. Once
imported they are our code: restyled to tokens, renamed to repo conventions,
read in full for `dangerouslySetInnerHTML` and heavy dependencies. Stock
styling never ships.

## Motion

- One library per job: `motion` for React state, GSAP for scroll and
  timelines, canvas libraries own their own frame loop. Two libraries never
  animate the same property on the same element.
- Animate `transform` and `opacity` only. Never `width`, `height`, `top`,
  `left`, `filter` or `backdrop-filter`.
- `prefers-reduced-motion` gets a static version. `prefers-reduced-transparency`
  gets solid surfaces.
- Effects stay out of forms and anywhere a user reads a number.

## Verify

Playwright screenshots at 360px and 1440px, opened and looked at. axe clean.
Copy follows `writing-without-slop`.
