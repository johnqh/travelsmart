# TravelSmart Continuation Handoff

Last updated: 2026-08-28

This file is the restart point for a future coding session. Read it before
changing code. The repository is `/Users/johnhuang/projects/travelsmart` and
the Next.js/Convex app is in `/Users/johnhuang/projects/travelsmart/travelsmart`.

## Current Checkpoint

- Branch: `main`
- Remote: `git@github.com:johnqh/travelsmart.git`
- Latest commit: `97a63ce Synchronize map pins with map movement`
- Local app URL: `http://localhost:50665`
- Local Convex backend: port `3212`
- Working tree was clean at this checkpoint.
- No public deployment has been created yet.

The latest map implementation uses Leaflet with OpenStreetMap tiles. Markers,
meal locations, and route polylines are created in the same Leaflet map
instance, so they pan and zoom together. Browser-only session and active-trip
bootstrap is deferred until after hydration.

## What Is Implemented

1. Create a trip with destination, full-day dates, rental-car choice, pace, and
   meal preferences.
2. Discover attractions and restaurants through configured providers, or use
   the Tokyo fallback dataset when providers are unavailable.
3. View attractions in a list and on a real interactive map.
4. Open details containing description, practical notes, hours, cost, photos,
   official links, ticket links, and confidence/source information.
5. Rate attractions from zero to four.
6. Generate a multi-day plan with meals and deterministic transportation rules.
7. Refine route legs with Google Routes when configured; otherwise retain
   heuristic estimates and show a fallback message.
8. Use date tabs to inspect each day, with colored walk/transit/rideshare/car
   route legs.
9. Keep excluded attractions as selectable gray pins.
10. Save and reopen plans in Convex.
11. Recommend a hotel area from route anchors.
12. Send or record an itinerary email through AgentMail when configured.

## Architecture Map

### Frontend

- `travelsmart/app/page.tsx`: single map-first workspace and UI components.
- `travelsmart/app/globals.css`: Tailwind styles plus Leaflet CSS import.
- `travelsmart/components/ui/`: local shadcn-style primitives.
- `travelsmart/next.config.ts`: remote image hosts for provider/demo photos.

### Convex backend

- `convex/schema.ts`: trips, discovery runs, attractions, ratings,
  restaurants, plans, days, items, route legs, route cache, hotel
  recommendations, and outbound email records.
- `convex/trips.ts`: trip creation, demo data, workspace reads, and ratings.
- `convex/discovery.ts`: provider calls, structured normalization, fallback
  seed, and discovery run status.
- `convex/plans.ts`: deterministic itinerary generation, save behavior, and
  hotel recommendation.
- `convex/routing.ts`: Google Routes integration, transfer policy, route cache,
  and fallback route refinement.
- `convex/email.ts`: AgentMail action and persisted send status.
- `convex/convex.config.ts`: declared optional action environment variables.

### External providers

- Google Places Text Search: attraction/place discovery.
- Firecrawl Search: source and ticket-page discovery.
- OpenAI Chat Completions structured output: normalized attraction records.
- Google Routes `computeRoutes`: walking, driving, and transit route geometry.
- AgentMail: saved-plan email delivery.
- OpenStreetMap tiles: visible map background; no API key is needed for the
  current demo map layer.

## Start After A Computer Restart

Open two terminals.

Terminal 1, backend:

```bash
cd /Users/johnhuang/projects/travelsmart/travelsmart
CONVEX_AGENT_MODE=anonymous npx convex dev
```

Terminal 2, frontend:

```bash
cd /Users/johnhuang/projects/travelsmart/travelsmart
npm run dev -- --port 50665
```

Then open `http://localhost:50665`. If port `50665` is occupied, use another
port and update the URL in the handoff only if that port is intended to remain
the new default.

The current local backend is anonymous/ephemeral unless the user has linked a
persistent Convex deployment. Do not commit `.env.local` or provider secrets.
Use `.env.example` as the list of required names.

## Provider Setup

Set Convex action variables from the app directory:

```bash
npx convex env set GOOGLE_MAPS_API_KEY your-key
npx convex env set FIRECRAWL_API_KEY your-key
npx convex env set OPENAI_API_KEY your-key
npx convex env set OPENAI_MODEL gpt-5-mini
npx convex env set AGENTMAIL_API_KEY your-key
npx convex env set AGENTMAIL_INBOX_ID your-inbox-id
```

Without these keys, discovery falls back to Tokyo demo data, route refinement
returns a documented heuristic fallback, and email records `skipped`.

## Verification Before Any Commit

Run from `travelsmart/`:

```bash
npm run typecheck
npm run lint
npm run build
```

Run from the repository root:

```bash
git diff --check
git status --short
```

For a basic server check:

```bash
curl -I http://localhost:50665
```

## Completed Commit History

- `14e54b5`: initial provider research.
- `ed8feca`: product specs and implementation plans.
- `95088ff`: Convex/Next scaffold.
- `e81a428`: trip discovery workspace.
- `f0fed11`: route planner.
- `7e06ea9`: saved plans and email sharing.
- `80a0d6a`: provider discovery flow.
- `57a563d`: route refinement cache.
- `1b3db5e`: image handling and lint cleanup.
- `7a85978`: hydration bootstrap fix and temporary map layer.
- `97a63ce`: Leaflet map with synchronized markers/routes.

## Prioritized TODOs

### P0: Hackathon submission blockers

- [ ] Configure real Google, Firecrawl, OpenAI, and AgentMail keys in the
  intended Convex deployment.
- [ ] Run a fresh Tokyo demo with provider-backed data and verify source links,
  hours, prices, photos, tickets, and restaurant proximity.
- [ ] Deploy the app to an accepted public URL and record the URL here.
- [ ] Verify the public app from a fresh browser session, including save,
  reopen, plan-again, and email status.
- [ ] Record the under-three-minute demo and update the hackathon submission
  materials/social post checklist.

### P1: Product correctness

- [ ] Replace anonymous browser session IDs with Convex Auth or another
  persistent identity before treating saved plans as private user data.
- [ ] Add destination geocoding and use the destination center for initial map
  view instead of the current Tokyo default when no trip is loaded.
- [ ] Improve planner opening-hours validation, parking constraints, and
  all-day rental-car enforcement with real provider data.
- [ ] Make the hotel recommendation use provider-backed safety and lodging
  data; currently it is a route-anchor heuristic.
- [ ] Add explicit source URLs and confidence display to the attraction detail
  UI if the provider payload contains them but the design does not expose them.
- [ ] Add route-leg detail popovers with provider status, transfer count, and
  fallback explanation.

### P1: Reliability and tests

- [ ] Add Convex tests for ownership/session checks, rating idempotency,
  planner day caps, excluded pins, transfer fallback, and save behavior.
- [ ] Add frontend smoke coverage for hydration, map selection, date tabs,
  rating changes, plan again, and Leaflet marker movement.
- [ ] Add provider timeout, retry, quota, and malformed-response handling.
- [ ] Add bounded concurrency/rate limits around discovery and route calls.
- [ ] Add a migration strategy before changing existing Convex fields in a
  deployed environment.

### P2: UX polish

- [ ] Add a proper mobile bottom-sheet layout for list, itinerary, and details.
- [ ] Add loading states while Leaflet initializes and while provider discovery
  or route refinement is running.
- [ ] Add map fit-to-day and reset-view controls.
- [ ] Add restaurant detail links, cuisine chips, and booking links where
  available.
- [ ] Add plan naming, saved-plan list, duplicate, archive, and delete flows.
- [ ] Replace the current text `Phase 3` badge with the actual current product
  status before the demo.

## Rules For The Next Session

- Read this file, `docs/product-spec.md`, `docs/technical-spec.md`, and the
  latest `hackathon/hackathon.md` entry before implementing.
- Preserve existing user changes and inspect `git status` first.
- Read `convex/_generated/ai/guidelines.md` and use the Convex expert skill
  before editing any file in `convex/`.
- Keep provider secrets out of git.
- Update this file and `hackathon/hackathon.md` whenever a TODO changes state,
  a provider decision changes, or a phase is completed.
- Commit and push each coherent phase to `main`, with checks recorded in the
  hackathon log.
