# TravelSmart

TravelSmart is a proposed Convex All Gas Hackathon app for building editable,
map-first travel itineraries from real attraction data, user ratings, travel
dates, meal preferences, and transportation constraints.

## Product Shape

1. User enters destination, full-day start/end dates, meal preferences, and
   whether they have a rental car.
2. Discovery agent finds attractions, opening hours, costs, photos, ticket
   links, descriptions, locations, and transportation notes.
3. User rates each attraction.
4. Planning agent creates a multi-day itinerary that prioritizes highly rated
   sites while respecting time, opening hours, meals, and transport rules.
5. Map displays each day with colored route segments by transportation mode.
6. Attractions excluded from the route remain visible as disabled map pins.
7. User can adjust ratings and plan again.
8. User can save and reopen plans.
9. After saving, the app recommends a hotel area optimized for safety and easy
   travel to each day's first and last stops.

## Current Recommendation

Use Google Maps Platform for routing and transit coverage, with Convex as the
backend and OpenAI/Firecrawl/AgentMail integrated into the product flow.

See [docs/research.md](docs/research.md) for current findings.

## Current Build

The app lives in `travelsmart/`. It currently supports draft trip creation,
provider-aware discovery with a Tokyo fallback dataset, attraction ratings,
route planning, Google Routes-ready route refinement with fallback estimates,
save/reopen, hotel-area recommendation, and AgentMail-ready itinerary email
records.

Run checks from `travelsmart/`:

```bash
npm run typecheck
npm run lint
npm run build
```

## Planning Docs

- [Product spec](docs/product-spec.md)
- [Technical spec](docs/technical-spec.md)
- [Itinerary planner spec](docs/itinerary-planner-spec.md)
- [Implementation plan](docs/implementation-plan.md)
- [Hackathon plan](docs/hackathon-plan.md)
