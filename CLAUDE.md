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
3. Execute each step in order. After completing a step, check it off:
   - `- [ ]` → `- [x]`
4. If you deviate from the plan (different code, different approach), update the plan step to match before moving on
5. Commit after each task (the plan includes the exact commit command)
6. Move to the next task

**Never skip steps.** If a step says "run the tests", run them. If they fail, fix the failure before moving on.

### Updating the plan

When you discover something the plan missed or got wrong:

- **New task needed:** Add it at the end, or insert it before the task that depends on it
- **Step needs changing:** Edit it in place — update the code, command, or expected output
- **Task is complete:** All its steps should be checked `[x]`
- **Task is blocked:** Add a note under it explaining the blocker; don't mark it complete
- **Something was done differently:** Rewrite the step to reflect what was actually done

Keep the plan file as the single source of truth for what's been done and what's next.

### Updating the spec

If requirements change during implementation:

1. Update `docs/superpowers/specs/2026-04-23-meows-of-mumbai-design.md` first
2. Then update the plan to match (add/edit/remove tasks)
3. Commit both together: `docs: update spec and plan for [change]`

Never implement something that contradicts the spec without updating the spec first.

## Stack Quick Reference

- **Framework:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Map:** Leaflet.js + leaflet.markercluster (dynamic import, client-only)
- **Database:** Supabase — PostgreSQL + PostGIS (`geography(Point, 4326)`)
- **Storage:** Supabase Storage (bucket: `cat-photos`)
- **Auth:** Custom `users` table + bcryptjs + iron-session (no email)
- **Image processing:** sharp (thumbnail 120×120px)
- **Tests:** Jest (`npx jest`)
- **Deploy:** Vercel

## File Conventions

- API routes live in `app/api/`
- Shared types live in `types/index.ts` — check before defining new ones
- Supabase admin client is in `lib/db.ts` (service role key — server only)
- Auth session helpers are in `lib/auth.ts`
- Geo utilities (rounding, bbox validation) are in `lib/geo.ts`
- The Leaflet `Map` component must be imported with `dynamic(..., { ssr: false })`

## Code Rules

- **TDD:** Write the failing test first, then implement
- **YAGNI:** Build exactly what the plan says, nothing more
- **No placeholders:** Every step ships working code
- **Commit after every task** — small, frequent, working commits
- **Never fetch all cats** — always filter by bounding box (`/api/cats?swLat=&swLng=&neLat=&neLng=`)
- **Coordinate rounding:** Display at 3dp (~100m precision); store full precision in DB

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=            # min 32 chars
ADMIN_PASSWORD=
```
