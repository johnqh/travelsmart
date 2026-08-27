# Itinerary Planner Spec

## Goal

Generate a route-aware, date-tabbed itinerary that visits as many highly rated
attractions as practical while respecting opening hours, visit durations,
transport constraints, lunch, dinner, and user pacing.

The planner should be deterministic first and AI-assisted second. OpenAI may
explain, summarize, and fill notes, but the actual feasibility constraints
should be enforced by code.

## Inputs

Trip:

- Destination.
- Start date.
- End date.
- Rental car availability.
- Pace.
- Meal preferences.

Attractions:

- Location.
- Category.
- User rating.
- Opening hours by trip date.
- Estimated visit duration.
- Ticket requirement.
- Cost summary.
- Source confidence.

Restaurants:

- Location.
- Cuisine.
- Opening hours.
- Price level.
- Rating/confidence.

Routing:

- Walking estimates.
- Transit estimates and transfer counts.
- Driving estimates.
- Final route geometry for selected legs.

## Outputs

- A plan with one plan day per date.
- Ordered attraction and meal items per day.
- Route legs between adjacent items.
- Excluded attraction IDs.
- Daily summaries.
- Whole-trip planning summary.
- Planner score and diagnostics.

## Planning Constants

Default day window:

- Start: 9:00 AM.
- End: 8:30 PM.

Meal windows:

- Lunch target: 12:00 PM to 1:00 PM.
- Lunch acceptable: 11:30 AM to 1:45 PM.
- Dinner target: 6:00 PM to 7:30 PM.
- Dinner acceptable: 5:30 PM to 8:15 PM.

Walking:

- Preferred when travel time is 15 minutes or less.
- Absolute walking cap defaults to 25 minutes unless the pace is packed.

Transit:

- Direct transit only for MVP.
- A transit route is accepted only when transfer count is 0.
- If provider data is unavailable, transit is treated as unavailable.

Rideshare:

- Used when walking is too long and direct transit is unavailable or too slow.
- Estimated from driving time and distance.

Rental car:

- If a day uses car mode, all non-walking route legs for that day use car mode.
- Car mode should include parking notes when available.

Pace:

- Relaxed: fewer stops, longer buffers, lower walking cap.
- Balanced: default.
- Packed: more stops, shorter buffers, higher walking cap.

## Attraction Scoring

Base score:

```text
score =
  ratingWeight +
  categoryWeight +
  confidenceWeight +
  hoursFitWeight -
  travelPenalty -
  duplicateCategoryPenalty -
  unknownHoursPenalty -
  ticketFrictionPenalty
```

Rating weight:

- 0: exclude unless user explicitly re-enables.
- 1: low.
- 2: neutral.
- 3: high.
- 4: must-see.
- Unrated: neutral-low.

Hours fit:

- Strong bonus if open for the likely visit window.
- Penalty if hours are unknown.
- Exclude if known closed for the only feasible visit window.

Travel penalty:

- Penalize isolated attractions that force long travel legs.
- Penalize high transfer transit; MVP excludes transfer transit entirely.

Category diversity:

- Avoid filling a day with too many similar sites unless all are high-rated.

## Route Mode Selection

For each origin/destination leg:

1. If walking time is <= threshold, choose walking.
2. If rental car mode is active for the day, choose car.
3. Request or load direct-transit route.
4. If transit has 0 transfers and acceptable duration, choose transit.
5. Otherwise choose rideshare.

Transit acceptance:

- `transferCount === 0`.
- Duration is not more than 2x rideshare time unless user preference says to
  avoid cars.
- Arrival time still leaves enough time for the next item.

Rideshare acceptance:

- Driving route exists.
- Estimated arrival fits next item's open window.

## Daily Planning Algorithm

For MVP, use a heuristic planner:

1. Pre-filter unusable attractions:
   - Missing location.
   - Rating 0.
   - Known closed on all trip dates.
2. Cluster attractions by geography.
3. Estimate day clusters:
   - Assign each date one or more nearby clusters.
   - Keep must-see attractions in the closest feasible day.
4. Build each day greedily:
   - Start with the highest-rated feasible attraction in the cluster.
   - Add nearby high-scoring attractions that fit hours and day budget.
   - Reorder within the day to reduce travel time and satisfy opening hours.
5. Insert lunch:
   - Find the current item around noon.
   - Search nearby restaurants matching meal preferences.
   - Insert the restaurant that minimizes detour and is open.
6. Insert dinner:
   - Prefer restaurants near the final attraction or near the evening cluster.
   - Match cuisine when possible.
7. Compute final route legs and geometry.
8. Score the day.
9. Move infeasible low-score stops to excluded list.

## Replanning Behavior

When the user changes ratings and clicks `Plan Again`:

- Keep the same trip and attractions.
- Reuse route cache.
- Generate a new plan version.
- Do not mutate the saved plan unless the user explicitly saves the new version.
- Make changed ratings visually affect the result.

Expected effects:

- Higher-rated attractions move into route if feasible.
- Lower-rated attractions may become gray pins.
- Meals may change if the route geography changes.

## Hotel-Area Recommendation

Generate after a plan is saved.

Inputs:

- First and last stop of each day.
- Transit hubs near those stops.
- Destination center.
- Neighborhood candidates from sources/places.
- Safety notes from reputable sources.

Heuristic:

1. Compute centroid of daily first and last stops.
2. Identify nearby neighborhoods or transit hubs.
3. Score each candidate area by:
   - Average travel time to daily first stops.
   - Average travel time from daily last stops.
   - Direct transit availability.
   - Safety/source confidence.
   - Restaurant and transit density.
4. Ask OpenAI to summarize the top recommendation from structured evidence.

Output:

- Area name.
- Short explanation.
- Safety notes.
- Transit/access notes.
- Search link for hotels in that area.

## Diagnostics

Each generated plan should store planner diagnostics:

- Attractions considered.
- Attractions included.
- Attractions excluded and why.
- Route calls made.
- Cache hits.
- Transit legs accepted/rejected.
- Total attraction time.
- Total transport time.
- Score.

These diagnostics will make demos, debugging, and hackathon writeups easier.
