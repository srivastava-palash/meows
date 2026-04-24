# Meows of Mumbai — Agent Instructions

## Project

A community map website for Mumbai's stray cats. Anyone can add a photo + location. Optional name, story, and comments. No login required for contributions; optional username/password accounts available.

## Key Documents

| Document | Path | Purpose |
|---|---|---|
| Design spec | `docs/superpowers/specs/2026-04-23-meows-of-mumbai-design.md` | What we're building and why |
| Implementation plan | `docs/superpowers/plans/2026-04-23-meows-of-mumbai.md` | Step-by-step tasks with code |

**Always read both before touching code.** The spec defines requirements; the plan defines how to implement them.

## Golden Rule: Always Update the Plan

> **After every action — every step completed, every file changed, every decision made — update the plan immediately.**

The plan is a live document. It must always reflect the current state of the codebase. Another agent (or a future you) should be able to read the plan and know exactly what has been done and what comes next without looking at the git log.

**What this means in practice:**
- Completed a step? Check it off: `- [ ]` → `- [x]`
- Implemented something differently than the plan said? Edit the plan to match what you actually did
- Discovered a bug or gap mid-task? Add a new task for it before continuing
- A step turned out to be wrong (bad command, wrong path, outdated code)? Fix the step in the plan
- Skipped something intentionally? Note why, inline in the plan
- Changed a file path or function name? Update every reference to it in the plan

**The plan is wrong if it doesn't match the code. Fix it immediately — not later.**

## How to Work With the Plan

### Executing tasks

1. Open the plan file and find the next task where any step is unchecked (`- [ ]`)
2. Read the entire task before starting — understand what files it touches
3. Execute each step in order. After completing a step, mark it done:
   - `- [ ]` → `- [x]`
4. If you deviate from the plan (different code, different approach), update the plan step to match before moving on
5. Commit after each task using the commit command shown in the task
6. Move to the next task

**Never skip steps.** If a step says "run the tests", run them. If they fail, fix the failure before continuing.

### Updating the plan

When you discover something the plan missed or got wrong:

- **New task needed:** Add it at the end, or insert it before the task that depends on it
- **Step needs changing:** Edit it in place — update the code, command, or expected output
- **Task is complete:** All its steps should be checked `[x]`
- **Task is blocked:** Add a note under it explaining the blocker; do not mark it complete
- **Something was done differently:** Rewrite the step to reflect what was actually done

Keep the plan file as the single source of truth for what has been done and what comes next.

### Updating the spec

If requirements change during implementation:

1. Update `docs/superpowers/specs/2026-04-23-meows-of-mumbai-design.md` first
2. Then update the plan to match (add, edit, or remove tasks as needed)
3. Commit both together: `docs: update spec and plan for [change]`

Never implement something that contradicts the spec without updating the spec first.

## Stack Quick Reference

- **Framework:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Map:** Leaflet.js + leaflet.markercluster (dynamic import, client-only — `ssr: false`)
- **Database:** Supabase — PostgreSQL + PostGIS (`geography(Point, 4326)`)
- **Storage:** Supabase Storage (bucket: `cat-photos`)
- **Auth:** Custom `users` table + bcryptjs + iron-session (no email required)
- **Image processing:** sharp (generates 120×120px thumbnails)
- **Tests:** Jest — run with `npx jest`
- **Deploy:** Vercel

## File Conventions

- API routes: `app/api/`
- Shared TypeScript types: `types/index.ts` — check before defining new types
- Supabase admin client: `lib/db.ts` (uses service role key — server-side only)
- Auth session helpers: `lib/auth.ts`
- Geo utilities: `lib/geo.ts` (coordinate rounding, bounding box validation)
- The Leaflet `Map` component must always use `dynamic(() => import(...), { ssr: false })`

## Code Rules

- **TDD:** Write the failing test first, then write the implementation
- **YAGNI:** Implement exactly what the plan says — nothing more
- **No placeholders:** Every committed step ships working, tested code
- **Commit after every task** — small, focused commits
- **Never fetch all cats** — always filter by map bounding box (`/api/cats?swLat=&swLng=&neLat=&neLng=`)
- **Coordinate display rounding:** 3 decimal places (~100m precision) on the map; full precision stored in the database

## Environment Variables

Required in `.env.local` (or your platform's secret store):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=            # minimum 32 characters
ADMIN_PASSWORD=
```

## Running Locally

```bash
npm install
npx next dev        # dev server at http://localhost:3000
npx jest            # run tests
npx next build      # production build check
```
