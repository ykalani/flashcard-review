# Design System

## Palette

```css
--bg: #0a0a0f           /* deepest background — near-black, slight warmth */
--surface: #14141c       /* card/container surface */
--surface2: #1c1c28      /* hover states, subtle overlay */
--border: #262634        /* borders — visible but quiet */
--text: #e8e4dc          /* primary text — warm off-white */
--text2: #8a8680         /* secondary/meta text */
--accent: #7c8aff        /* primary accent — soft indigo-blue */
--accent-subtle: #7c8aff14  /* 8% opacity accent for backgrounds */
--correct: #3dd68c       /* success — muted emerald */
--correct-subtle: #3dd68c14
--wrong: #f87171         /* error — muted rose */
--wrong-subtle: #f8717114
```

The palette avoids cold slate/blue tones common in dark themes. The warm undertones in text and surfaces create an airier feel despite the darkness.

## Typography

- **Primary font:** Inter (Google Fonts) — precise, evenly-spaced, highly legible at small sizes
- **Scale:** 0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 rem
- **Lead:** 1.4 (tight for headings), 1.6 (body)
- **Weight:** 400 (regular body), 500 (medium labels), 600 (semibold headings)

## Spacing

- **Unit:** 4px grid
- **Page padding:** 24px mobile, 32px+ desktop
- **Stack:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 px

## Corners

- **Radius:** 10px (most components), 6px (small elements like badges), 999px (pills)
- Remove the generic 12px — too large for a precise look

## Motion

- **Duration:** 200ms for micro-interactions, 300ms for transitions
- **Easing:** cubic-bezier(0.16, 1, 0.3, 1) — snappy, natural
- Button press: subtle scale to 0.97 + bg shift
- Page transitions: crossfade
- Progress bar: smooth width transition

## Components

### Buttons
- Primary: filled accent bg, white text, 10px radius, 14px padding
- Ghost: transparent bg, border, text2 text
- No hover scale on desktop (only touch press)
- Focus ring: 2px accent with 2px offset

### Cards (set list, result boxes)
- bg: var(--surface), border: var(--border), radius: 10px
- No box shadows (breaks "airy" feel — use borders instead)
- Active state: border becomes accent, subtle bg shift

### Flashcard (review prompt)
- Centered content, generous padding (32px+)
- Label (TERM/DEFINITION) in uppercase, 0.65rem, text2
- Content in 1.2rem, text
- Subtle top border accent line instead of full border

### Inputs
- bg: var(--bg), border: 1.5px solid var(--border), radius: 10px
- Focus: 1.5px solid var(--accent), no outline shift
- Placeholder: var(--text2)

### Progress Bar
- Thin (4px), rounded, bg surface2, fill accent
- Smooth transition on width change

### Tab Bar (Paste / Photo)
- Segmented control style — pill-shaped
- Active tab: accent bg, white text
- Inactive: transparent, text2

### Judge Verdict
- Compact card with colored left border (correct/wrong) instead of full border-color
- Reasoning text in text2, smaller
- Two buttons: primary (accept) + ghost (override)
