# IN-PROGRESS

## Current Work
- UI redesign: warm dark theme, Inter typography, refined spacing, cleaned up inline styles

## Recently Completed
- Created PRODUCT.md (register, users, brand personality)
- Created DESIGN.md (palette -- warm dark #0a0a0f, Inter, spacing grid, component specs)
- Rewrote `style.css` -- new palette, refined classes, focus rings, animations (`fadeSlideIn`)
- Rewrote `index.html` -- Inter font via Google Fonts
- Rewrote `app.js` -- renamed state to `S`, removed inline styles, added CSS classes, redone judge/results markup
- Verified app serves correctly (Flask started, HTML/CSS/JS load)

## Next Steps
- Deploy to Vercel to verify production
- Add user auth (Google OAuth)
- Batch import from CSV/PDF
- Add Gemini as alternative AI parser

## Blockers
- Need `GROQ_API_KEY` env for parsing
