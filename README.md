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
