# Flashcard Review

Quizlet Learn-style flashcard app with SM-2 spaced repetition, AI card generation from text & images (Groq + DSPy), deployed on Vercel.

**Production:** https://flashcard-review-tau.vercel.app

## Quick Start

```bash
cd flashcard-review
# set GROQ_API_KEY in .env or env
py app.py
# opens on http://0.0.0.0:5000
```

## Structure

| File | Role |
|---|---|
| `app.py` | Flask backend, API routes, env var strip (Vercel workaround) |
| `models.py` | SQLite schema, queries — uses `/tmp` on Vercel |
| `spaced_repetition.py` | SM-2 algorithm (ease factor, interval calc) |
| `groq_client.py` | Groq text + vision (`llama-3.3-70b-versatile`, `llama-3.2-90b-vision-preview`) |
| `dspy_parser.py` | DSPy signatures (`Predict`, `ChainOfThought`) — structured text parsing |
| `optimize_parser.py` | `BootstrapFewShot` training → `dspy_optimized.json` |
| `api/index.py` | Vercel serverless handler (wraps Flask) |
| `vercel.json` | Route all traffic to serverless function |
| `static/app.js` | Mobile-first SPA (home, create text/photo, review, results) |
| `static/style.css` | Dark theme, responsive |
| `templates/index.html` | SPA shell |

## LLM Judge

After the user rates themselves, an LLM (`llama-3.3-70b-versatile`) independently evaluates their written answer against the correct definition. The judge returns a quality score (0-3) with reasoning. The user can accept the LLM's rating or override with their own.

- `POST /api/judge` — `{term, definition, answer}` → `{quality, reasoning}`
- Judge prompt: `groq_client.py:JUDGE_PROMPT` — step-by-step reasoning, strict criteria per quality level
- Frontend: `app.js:renderJudge()` — shows judge verdict, accept/override buttons
- LLM rating does NOT auto-override the user — user always has final say

## Deploy

```bash
vercel --prod --yes
# Vercel env needs: GROQ_API_KEY (set via `vercel env add`)
```

## Persistent Storage

Currently data is ephemeral on Vercel (SQLite in `/tmp`). To make data persist:

1. Go to [neon.tech](https://neon.tech) — sign up free (no card)
2. Create a project, copy the connection string
3. Run: `vercel env add DATABASE_URL production` and paste it
4. Redeploy: `vercel --prod --yes`

The app auto-detects `DATABASE_URL` and switches from SQLite to PostgreSQL. No code changes needed.

Vercel quirks: env vars may get trailing newlines (stripped in `app.py`), cold starts ~5s.

## API

`POST /api/parse` — text → cards (`method: groq|dspy|dspy-cot`)
`POST /api/parse-image` — multipart image → cards (Groq vision)
`GET /api/sets` / `POST /api/sets` — list/create sets
`GET /api/sets/:id` / `DELETE /api/sets/:id` — get/delete
`POST /api/sets/:id/cards` — add cards
`GET /api/sets/:id/review` — due cards
`POST /api/sets/:id/review` — submit review (`card_id`, `quality` 0-3)

## SM-2

Quality → interval: 0=1min, 1=10min, 2=×ef, 3=×ef×1.3; ef floors at 1.3.

## Groq API

- Model: `llama-3.3-70b-versatile` (text), `llama-3.2-90b-vision-preview` (vision)
- Set `GROQ_API_KEY` in `.env` (local) or Vercel env vars (production)

## Secrets & Credentials

| Secret | Where |
|---|---|
| `GROQ_API_KEY` | `.env` (local), Vercel env (production) |
| Vercel token | OS keychain (`gho_*`), user `ykalani` |

## Skills Used

- `impeccable` — mobile-first UI, dark theme, touch targets, responsive layout
- `customize-opencode` — opencode agent/plugin config (Vercel MCP)

## Next Steps (apply without asking)

- Add persistent DB (Supabase/Neon) instead of ephemeral SQLite on Vercel
- Add Gemini as alternative AI parser (`gemini-client.py`)
- Add Gemini vision as fallback for image parsing
- Set up GitHub Actions for auto-deploy on push
- Add user auth (Google OAuth) for multi-user
- Batch import from CSV/PDF
