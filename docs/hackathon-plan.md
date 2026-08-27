# Hackathon Plan

## Positioning

TravelSmart should be submitted as an everyday-use travel app, not a developer
tool. The demo should emphasize the practical loop:

1. Pick a destination and dates.
2. See real attractions with photos and details.
3. Rate what matters.
4. Generate a route-aware itinerary.
5. Save, email, and choose a hotel area.

## Sponsor Technology Usage

### Convex

Use Convex for:

- Trip state.
- Real-time discovery/planning progress.
- Attractions, ratings, plans, route legs, and saved plans.
- Server-side actions for OpenAI, Firecrawl, Google Maps, and AgentMail.
- Persistent route and source caches.

Convex should be visible in the demo through live updates:

- Discovery progress changes.
- Ratings immediately update.
- Planning state updates while the route is generated.
- Saved plans reopen without static local state.

### OpenAI

Use OpenAI for:

- Structured extraction from crawled pages.
- Attraction summaries and practical notes.
- Itinerary explanation.
- Hotel-area recommendation.

Avoid using OpenAI for:

- Blind route feasibility.
- Final opening-hours checks.
- Fake facts without source support.

### Firecrawl

Use Firecrawl for:

- Official tourism pages.
- Attraction pages.
- Ticket pages.
- Restaurant/neighborhood source pages when needed.

Demo point:

- Show source URLs in attraction details to prove discovery is grounded.

### AgentMail

Use AgentMail for:

- Emailing saved itinerary to the user.
- Optional reminder email for booking ticketed attractions.

Demo point:

- Save plan, click email, show send status.

## Demo Storyboard

Target length:

- Under three minutes.

Suggested flow:

1. Start with trip setup for Tokyo, three full days, no rental car, Japanese and
   local food preferences.
2. Run discovery or show completed discovery state.
3. Click several attraction pins and detail panels.
4. Rate a few attractions:
   - Mark one as must-see.
   - Lower-rate one far-away attraction.
5. Click `Plan`.
6. Show date tabs and colored route lines.
7. Click a transit leg and mention no-transfer rule.
8. Show lunch/dinner inserted near the day's route.
9. Show gray pins for places not included.
10. Increase rating for a gray attraction and click `Plan Again`.
11. Save plan.
12. Show hotel-area recommendation.
13. Send itinerary email.

## MVP Submission Scope

Must include:

- Public GitHub repo.
- Public deployed app URL.
- Video demo.
- `hackathon.md` build log.
- Social post tagging required accounts.

Product must include:

- Destination/date/rental-car/preference form.
- Discovery with real source-backed attractions.
- Map and list.
- Ratings.
- Plan and plan again.
- Date-tabbed itinerary.
- Colored transport routes.
- Gray pins for excluded attractions.
- Meal insertion.
- Save/reopen.
- Hotel-area recommendation.
- AgentMail itinerary email.

## Cut Line

If time gets tight, keep:

- One polished demo destination.
- Strong map itinerary.
- Saved plan and email.
- Real source-backed attraction details.

Cut or simplify:

- Auth, if anonymous saved plans are acceptable for demo.
- Multiple destination perfection.
- Exact rideshare pricing.
- Exact parking details.
- Advanced hotel safety scoring.
- Restaurant booking links.

## Judging Notes To Emphasize

- Everyday traveler value.
- Real Convex backend and live updates.
- OpenAI is used for structured extraction and explanation, not superficial copy.
- Firecrawl makes attraction/ticket data grounded in sources.
- AgentMail sends the saved plan.
- Google routing makes transportation constraints real.
- Replanning responds to user ratings.

## Build Log Discipline

Maintain `/hackathon/hackathon.md` during implementation.

Each entry should include:

- Date/time.
- Feature built.
- Tools used.
- Convex/OpenAI/Firecrawl/AgentMail usage.
- Interesting tradeoff or bug fixed.
- Current demo status.

Example entry shape:

```markdown
## 2026-08-27

- Built trip setup and Convex trip schema.
- Added discovery run status model for live progress.
- Decision: keep planner deterministic and use OpenAI only for extraction and
  explanations.
```

## Public Launch Checklist

- GitHub repo is public.
- App is deployed to an accepted public URL.
- Required API keys are set in deployment environment.
- Demo city works from a fresh browser session.
- Build succeeds.
- Typecheck/lint pass or known issues are documented.
- `hackathon.md` is current.
- Video is under three minutes.
- Social post tags `@convex`, `@OpenAI`, `@firecrawl`, and `@agentmail`.
