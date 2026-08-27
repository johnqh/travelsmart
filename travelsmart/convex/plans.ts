import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const planStatusValidator = v.union(
  v.literal("generated"),
  v.literal("saved"),
  v.literal("archived"),
);

const routeModeValidator = v.union(
  v.literal("walk"),
  v.literal("transit"),
  v.literal("rideshare"),
  v.literal("car"),
);

const planItemTypeValidator = v.union(
  v.literal("attraction"),
  v.literal("lunch"),
  v.literal("dinner"),
  v.literal("break"),
);

const planItemValidator = v.object({
  _id: v.id("planItems"),
  _creationTime: v.number(),
  type: planItemTypeValidator,
  attractionId: v.optional(v.id("attractions")),
  restaurantId: v.optional(v.id("restaurants")),
  name: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  durationMinutes: v.number(),
  notes: v.string(),
  bookingUrl: v.optional(v.string()),
  lat: v.number(),
  lng: v.number(),
  sortOrder: v.number(),
});

const routeLegValidator = v.object({
  _id: v.id("routeLegs"),
  _creationTime: v.number(),
  fromItemId: v.id("planItems"),
  toItemId: v.id("planItems"),
  mode: routeModeValidator,
  durationMinutes: v.number(),
  distanceMeters: v.number(),
  polyline: v.array(v.object({ lat: v.number(), lng: v.number() })),
  instructionsSummary: v.string(),
  transitLineNames: v.array(v.string()),
  transferCount: v.number(),
  fallbackReason: v.optional(v.string()),
  sortOrder: v.number(),
});

const planDayValidator = v.object({
  _id: v.id("planDays"),
  _creationTime: v.number(),
  date: v.string(),
  dayIndex: v.number(),
  transportPolicy: v.union(
    v.literal("walkTransitRideshare"),
    v.literal("carOnly"),
  ),
  summary: v.string(),
  score: v.number(),
  items: v.array(planItemValidator),
  legs: v.array(routeLegValidator),
});

const planValidator = v.object({
  _id: v.id("plans"),
  _creationTime: v.number(),
  tripId: v.id("trips"),
  name: v.string(),
  status: planStatusValidator,
  plannerVersion: v.string(),
  score: v.number(),
  summary: v.string(),
  excludedAttractionIds: v.array(v.id("attractions")),
  diagnostics: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  savedAt: v.optional(v.number()),
  days: v.array(planDayValidator),
});

const savedPlanValidator = v.object({
  _id: v.id("plans"),
  _creationTime: v.number(),
  tripId: v.id("trips"),
  name: v.string(),
  destinationName: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  score: v.number(),
  summary: v.string(),
  savedAt: v.optional(v.number()),
});

const hotelRecommendationValidator = v.object({
  _id: v.id("hotelRecommendations"),
  _creationTime: v.number(),
  areaName: v.string(),
  centerLat: v.number(),
  centerLng: v.number(),
  summary: v.string(),
  safetyNotes: v.string(),
  transportNotes: v.string(),
  nearbyTransitHubs: v.array(v.string()),
  searchUrl: v.string(),
  score: v.number(),
  createdAt: v.number(),
});

const emailPayloadValidator = v.object({
  subject: v.string(),
  text: v.string(),
  html: v.string(),
});

type RatedAttraction = Doc<"attractions"> & { rating: 0 | 1 | 2 | 3 | 4 };
type Restaurant = Doc<"restaurants">;
type Point = { lat: number; lng: number; name: string };
type PlannedItem = {
  type: "attraction" | "lunch" | "dinner";
  attractionId?: Id<"attractions">;
  restaurantId?: Id<"restaurants">;
  name: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  notes: string;
  bookingUrl?: string;
  lat: number;
  lng: number;
};

type RouteEstimate = {
  mode: "walk" | "transit" | "rideshare" | "car";
  durationMinutes: number;
  distanceMeters: number;
  polyline: Array<{ lat: number; lng: number }>;
  instructionsSummary: string;
  transitLineNames: string[];
  transferCount: number;
  fallbackReason?: string;
};

export const getCurrentPlan = query({
  args: {
    tripId: v.id("trips"),
    sessionId: v.string(),
  },
  returns: v.union(v.null(), planValidator),
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.sessionId !== args.sessionId) {
      return null;
    }

    const plans = await ctx.db
      .query("plans")
      .withIndex("by_tripId_and_updatedAt", (q) => q.eq("tripId", args.tripId))
      .order("desc")
      .take(10);

    const plan = plans.find((candidate) => candidate.status !== "archived");
    if (!plan) {
      return null;
    }

    const days = await ctx.db
      .query("planDays")
      .withIndex("by_planId_and_dayIndex", (q) => q.eq("planId", plan._id))
      .order("asc")
      .take(10);

    const daysWithItems = [];
    for (const day of days) {
      const items = await ctx.db
        .query("planItems")
        .withIndex("by_planDayId_and_sortOrder", (q) =>
          q.eq("planDayId", day._id),
        )
        .order("asc")
        .take(20);

      const legs = await ctx.db
        .query("routeLegs")
        .withIndex("by_planDayId_and_sortOrder", (q) =>
          q.eq("planDayId", day._id),
        )
        .order("asc")
        .take(20);

      daysWithItems.push({
        _id: day._id,
        _creationTime: day._creationTime,
        date: day.date,
        dayIndex: day.dayIndex,
        transportPolicy: day.transportPolicy,
        summary: day.summary,
        score: day.score,
        items: items.map((item) => ({
          _id: item._id,
          _creationTime: item._creationTime,
          type: item.type,
          attractionId: item.attractionId,
          restaurantId: item.restaurantId,
          name: item.name,
          startTime: item.startTime,
          endTime: item.endTime,
          durationMinutes: item.durationMinutes,
          notes: item.notes,
          bookingUrl: item.bookingUrl,
          lat: item.lat,
          lng: item.lng,
          sortOrder: item.sortOrder,
        })),
        legs: legs.map((leg) => ({
          _id: leg._id,
          _creationTime: leg._creationTime,
          fromItemId: leg.fromItemId,
          toItemId: leg.toItemId,
          mode: leg.mode,
          durationMinutes: leg.durationMinutes,
          distanceMeters: leg.distanceMeters,
          polyline: leg.polyline,
          instructionsSummary: leg.instructionsSummary,
          transitLineNames: leg.transitLineNames,
          transferCount: leg.transferCount,
          fallbackReason: leg.fallbackReason,
          sortOrder: leg.sortOrder,
        })),
      });
    }

    return {
      _id: plan._id,
      _creationTime: plan._creationTime,
      tripId: plan.tripId,
      name: plan.name,
      status: plan.status,
      plannerVersion: plan.plannerVersion,
      score: plan.score,
      summary: plan.summary,
      excludedAttractionIds: plan.excludedAttractionIds,
      diagnostics: plan.diagnostics,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      savedAt: plan.savedAt,
      days: daysWithItems,
    };
  },
});

export const listSavedPlans = query({
  args: { sessionId: v.string() },
  returns: v.array(savedPlanValidator),
  handler: async (ctx, args) => {
    const plans = await ctx.db
      .query("plans")
      .withIndex("by_sessionId_and_status_and_updatedAt", (q) =>
        q.eq("sessionId", args.sessionId).eq("status", "saved"),
      )
      .order("desc")
      .take(20);

    const savedPlans = [];
    for (const plan of plans) {
      const trip = await ctx.db.get(plan.tripId);
      if (!trip || trip.sessionId !== args.sessionId) {
        continue;
      }

      savedPlans.push({
        _id: plan._id,
        _creationTime: plan._creationTime,
        tripId: plan.tripId,
        name: plan.name,
        destinationName: trip.destinationName,
        startDate: trip.startDate,
        endDate: trip.endDate,
        score: plan.score,
        summary: plan.summary,
        savedAt: plan.savedAt,
      });
    }

    return savedPlans;
  },
});

export const getHotelRecommendation = query({
  args: {
    planId: v.id("plans"),
    sessionId: v.string(),
  },
  returns: v.union(v.null(), hotelRecommendationValidator),
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.sessionId !== args.sessionId) {
      return null;
    }

    const recommendation = await ctx.db
      .query("hotelRecommendations")
      .withIndex("by_planId", (q) => q.eq("planId", args.planId))
      .order("desc")
      .first();

    if (!recommendation || recommendation.sessionId !== args.sessionId) {
      return null;
    }

    return {
      _id: recommendation._id,
      _creationTime: recommendation._creationTime,
      areaName: recommendation.areaName,
      centerLat: recommendation.centerLat,
      centerLng: recommendation.centerLng,
      summary: recommendation.summary,
      safetyNotes: recommendation.safetyNotes,
      transportNotes: recommendation.transportNotes,
      nearbyTransitHubs: recommendation.nearbyTransitHubs,
      searchUrl: recommendation.searchUrl,
      score: recommendation.score,
      createdAt: recommendation.createdAt,
    };
  },
});

export const generatePlan = mutation({
  args: {
    tripId: v.id("trips"),
    sessionId: v.string(),
  },
  returns: v.id("plans"),
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.sessionId !== args.sessionId) {
      throw new Error("Trip not found.");
    }

    const dates = enumerateDates(trip.startDate, trip.endDate);
    if (dates.length === 0 || dates.length > 7) {
      throw new Error("Trip must be 1-7 full days for this planner.");
    }

    const attractions = await ctx.db
      .query("attractions")
      .withIndex("by_tripId", (q) => q.eq("tripId", args.tripId))
      .take(40);
    const ratings = await ctx.db
      .query("attractionRatings")
      .withIndex("by_tripId_and_sessionId", (q) =>
        q.eq("tripId", args.tripId).eq("sessionId", args.sessionId),
      )
      .take(60);
    const restaurants = await ctx.db
      .query("restaurants")
      .withIndex("by_tripId", (q) => q.eq("tripId", args.tripId))
      .take(40);

    if (attractions.length === 0) {
      throw new Error("Run discovery before planning.");
    }

    const previousPlans = await ctx.db
      .query("plans")
      .withIndex("by_tripId_and_updatedAt", (q) => q.eq("tripId", args.tripId))
      .order("desc")
      .take(10);

    for (const previousPlan of previousPlans) {
      if (previousPlan.status === "generated") {
        await ctx.db.patch(previousPlan._id, { status: "archived" });
      }
    }

    const ratingByAttraction = new Map(
      ratings.map((rating) => [rating.attractionId, rating.rating]),
    );
    const ratedAttractions = attractions.map((attraction) => ({
      ...attraction,
      rating: ratingByAttraction.get(attraction._id) ?? 2,
    }));

    const planDraft = buildPlanDraft({
      dates,
      trip,
      attractions: ratedAttractions,
      restaurants,
    });

    const now = Date.now();
    const planId = await ctx.db.insert("plans", {
      tripId: args.tripId,
      sessionId: args.sessionId,
      name: `${trip.destinationName} route plan`,
      status: "generated",
      plannerVersion: "heuristic-v1",
      score: planDraft.score,
      summary: planDraft.summary,
      excludedAttractionIds: planDraft.excludedAttractionIds,
      diagnostics: planDraft.diagnostics,
      createdAt: now,
      updatedAt: now,
    });

    for (const dayDraft of planDraft.days) {
      const planDayId = await ctx.db.insert("planDays", {
        planId,
        tripId: args.tripId,
        date: dayDraft.date,
        dayIndex: dayDraft.dayIndex,
        transportPolicy: trip.hasRentalCar ? "carOnly" : "walkTransitRideshare",
        summary: dayDraft.summary,
        score: dayDraft.score,
      });

      const itemIds: Id<"planItems">[] = [];
      for (let index = 0; index < dayDraft.items.length; index += 1) {
        const item = dayDraft.items[index];
        const itemId = await ctx.db.insert("planItems", {
          planId,
          planDayId,
          tripId: args.tripId,
          type: item.type,
          attractionId: item.attractionId,
          restaurantId: item.restaurantId,
          name: item.name,
          startTime: formatTime(item.startMinutes),
          endTime: formatTime(item.endMinutes),
          durationMinutes: item.durationMinutes,
          notes: item.notes,
          bookingUrl: item.bookingUrl,
          lat: item.lat,
          lng: item.lng,
          sortOrder: index,
        });
        itemIds.push(itemId);
      }

      for (let index = 0; index < dayDraft.legs.length; index += 1) {
        const leg = dayDraft.legs[index];
        await ctx.db.insert("routeLegs", {
          planId,
          planDayId,
          tripId: args.tripId,
          fromItemId: itemIds[index],
          toItemId: itemIds[index + 1],
          mode: leg.mode,
          durationMinutes: leg.durationMinutes,
          distanceMeters: leg.distanceMeters,
          polyline: leg.polyline,
          instructionsSummary: leg.instructionsSummary,
          transitLineNames: leg.transitLineNames,
          transferCount: leg.transferCount,
          fallbackReason: leg.fallbackReason,
          sortOrder: index,
        });
      }
    }

    await ctx.db.patch(args.tripId, {
      status: "planned",
      updatedAt: now,
    });

    return planId;
  },
});

export const savePlan = mutation({
  args: {
    planId: v.id("plans"),
    sessionId: v.string(),
  },
  returns: v.id("plans"),
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.sessionId !== args.sessionId) {
      throw new Error("Plan not found.");
    }

    const trip = await ctx.db.get(plan.tripId);
    if (!trip || trip.sessionId !== args.sessionId) {
      throw new Error("Trip not found.");
    }

    const now = Date.now();
    await ctx.db.patch(args.planId, {
      status: "saved",
      savedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(plan.tripId, {
      status: "saved",
      updatedAt: now,
    });

    await upsertHotelRecommendation(ctx, {
      planId: args.planId,
      trip,
      sessionId: args.sessionId,
      now,
    });

    return args.planId;
  },
});

export const getPlanEmailPayload = internalQuery({
  args: {
    planId: v.id("plans"),
    tripId: v.id("trips"),
    sessionId: v.string(),
  },
  returns: v.union(v.null(), emailPayloadValidator),
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    const plan = await ctx.db.get(args.planId);
    if (
      !trip ||
      !plan ||
      trip.sessionId !== args.sessionId ||
      plan.sessionId !== args.sessionId ||
      plan.tripId !== args.tripId ||
      plan.status !== "saved"
    ) {
      return null;
    }

    const days = await loadPlanDays(ctx, args.planId);
    return buildEmailPayload({ trip, plan, days });
  },
});

async function loadPlanDays(ctx: QueryCtx, planId: Id<"plans">) {
  const days = await ctx.db
    .query("planDays")
    .withIndex("by_planId_and_dayIndex", (q) => q.eq("planId", planId))
    .order("asc")
    .take(10);

  const result = [];
  for (const day of days) {
    const items = await ctx.db
      .query("planItems")
      .withIndex("by_planDayId_and_sortOrder", (q) => q.eq("planDayId", day._id))
      .order("asc")
      .take(20);
    const legs = await ctx.db
      .query("routeLegs")
      .withIndex("by_planDayId_and_sortOrder", (q) => q.eq("planDayId", day._id))
      .order("asc")
      .take(20);

    result.push({ day, items, legs });
  }

  return result;
}

async function upsertHotelRecommendation(
  ctx: MutationCtx,
  {
    now,
    planId,
    sessionId,
    trip,
  }: {
    now: number;
    planId: Id<"plans">;
    sessionId: string;
    trip: Doc<"trips">;
  },
) {
  const days = await ctx.db
    .query("planDays")
    .withIndex("by_planId_and_dayIndex", (q) => q.eq("planId", planId))
    .order("asc")
    .take(10);

  const anchors: Doc<"planItems">[] = [];
  for (const day of days) {
    const items = await ctx.db
      .query("planItems")
      .withIndex("by_planDayId_and_sortOrder", (q) => q.eq("planDayId", day._id))
      .order("asc")
      .take(20);
    const attractionItems = items.filter((item) => item.type === "attraction");
    if (attractionItems[0]) {
      anchors.push(attractionItems[0]);
    }
    if (attractionItems.length > 1) {
      anchors.push(attractionItems[attractionItems.length - 1]);
    }
  }

  const center =
    anchors.length > 0
      ? {
          lat: anchors.reduce((sum, item) => sum + item.lat, 0) / anchors.length,
          lng: anchors.reduce((sum, item) => sum + item.lng, 0) / anchors.length,
        }
      : { lat: trip.destinationLat, lng: trip.destinationLng };
  const area = chooseHotelArea(center);
  const firstStops = anchors
    .filter((_, index) => index % 2 === 0)
    .map((item) => item.name)
    .slice(0, 3)
    .join(", ");
  const lastStops = anchors
    .filter((_, index) => index % 2 === 1)
    .map((item) => item.name)
    .slice(0, 3)
    .join(", ");
  const searchUrl = `https://www.google.com/travel/hotels/${encodeURIComponent(
    `${area.name} ${trip.destinationName}`,
  )}`;

  const existing = await ctx.db
    .query("hotelRecommendations")
    .withIndex("by_planId", (q) => q.eq("planId", planId))
    .order("desc")
    .first();
  const recommendation = {
    tripId: trip._id,
    planId,
    sessionId,
    areaName: area.name,
    centerLat: area.lat,
    centerLng: area.lng,
    summary: `${area.name} is the best first hotel zone for this plan because it keeps the daily starts and finishes balanced without forcing a far first leg.`,
    safetyNotes:
      "Use hotels close to major stations, well-lit main streets, and current traveler reviews. This is a planning heuristic, not a live safety guarantee.",
    transportNotes: `Good base for reaching first stops such as ${firstStops || "the morning anchors"} and returning from last stops such as ${lastStops || "the evening anchors"}.`,
    nearbyTransitHubs: area.hubs,
    searchUrl,
    score: area.score,
    createdAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, recommendation);
  } else {
    await ctx.db.insert("hotelRecommendations", recommendation);
  }
}

function chooseHotelArea(center: { lat: number; lng: number }) {
  if (center.lng < 139.725) {
    return {
      name: "Shibuya or Omotesando",
      lat: 35.6628,
      lng: 139.705,
      hubs: ["Shibuya Station", "Omotesando Station", "Harajuku Station"],
      score: 86,
    };
  }
  if (center.lng > 139.79) {
    return {
      name: "Asakusa or Ueno",
      lat: 35.7124,
      lng: 139.781,
      hubs: ["Ueno Station", "Asakusa Station", "Oshiage Station"],
      score: 84,
    };
  }
  if (center.lng > 139.755) {
    return {
      name: "Ginza or Tokyo Station",
      lat: 35.678,
      lng: 139.7645,
      hubs: ["Tokyo Station", "Ginza Station", "Shimbashi Station"],
      score: 90,
    };
  }
  return {
    name: "Akasaka or Roppongi",
    lat: 35.668,
    lng: 139.737,
    hubs: ["Akasaka Station", "Roppongi Station", "Tameike-sanno Station"],
    score: 82,
  };
}

function buildEmailPayload({
  days,
  plan,
  trip,
}: {
  days: Array<{
    day: Doc<"planDays">;
    items: Doc<"planItems">[];
    legs: Doc<"routeLegs">[];
  }>;
  plan: Doc<"plans">;
  trip: Doc<"trips">;
}) {
  const subject = `TravelSmart itinerary for ${trip.destinationName}`;
  const dayText = days
    .map(({ day, items, legs }) => {
      const itemLines = items.map((item, index) => {
        const leg = index > 0 ? legs[index - 1] : null;
        const legText = leg
          ? `\n   ${routeModeLabel(leg.mode)} ${leg.durationMinutes} min, ${Math.round(leg.distanceMeters / 100) / 10} km`
          : "";
        return `${legText}\n- ${item.startTime}-${item.endTime}: ${item.name} (${item.type})`;
      });
      return `\n${day.date}\n${day.summary}\n${itemLines.join("\n")}`;
    })
    .join("\n");
  const text = `${plan.summary}\n\n${dayText}\n\nOpen ticket and official links from the saved TravelSmart plan.`;
  const html = `
    <main style="font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.55">
      <h1 style="margin:0 0 8px">TravelSmart itinerary for ${escapeHtml(trip.destinationName)}</h1>
      <p>${escapeHtml(plan.summary)}</p>
      ${days
        .map(
          ({ day, items, legs }) => `
            <section style="margin:24px 0;padding:16px;border:1px solid #cbd5e1;border-radius:8px">
              <h2 style="margin:0 0 6px">${escapeHtml(day.date)}</h2>
              <p style="margin:0 0 12px;color:#475569">${escapeHtml(day.summary)}</p>
              ${items
                .map((item, index) => {
                  const leg = index > 0 ? legs[index - 1] : null;
                  return `
                    ${
                      leg
                        ? `<div style="font-size:12px;color:#2563eb;margin:8px 0">${escapeHtml(routeModeLabel(leg.mode))}: ${leg.durationMinutes} min, ${Math.round(leg.distanceMeters / 100) / 10} km</div>`
                        : ""
                    }
                    <div style="padding:10px 0;border-top:1px solid #e2e8f0">
                      <strong>${escapeHtml(item.startTime)}-${escapeHtml(item.endTime)}</strong>
                      ${escapeHtml(item.name)}
                      <span style="color:#64748b">(${escapeHtml(item.type)})</span>
                    </div>
                  `;
                })
                .join("")}
            </section>
          `,
        )
        .join("")}
    </main>
  `;

  return { subject, text, html };
}

function routeModeLabel(mode: "walk" | "transit" | "rideshare" | "car") {
  if (mode === "walk") {
    return "Walk";
  }
  if (mode === "transit") {
    return "Direct transit";
  }
  if (mode === "car") {
    return "Drive";
  }
  return "Taxi/rideshare";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPlanDraft({
  dates,
  trip,
  attractions,
  restaurants,
}: {
  dates: string[];
  trip: Doc<"trips">;
  attractions: RatedAttraction[];
  restaurants: Restaurant[];
}) {
  const eligible = attractions
    .filter((attraction) => attraction.rating > 0)
    .sort((a, b) => attractionScore(b) - attractionScore(a));
  const remaining = [...eligible];
  const maxStops = trip.pace === "relaxed" ? 3 : trip.pace === "packed" ? 5 : 4;
  const days = [];
  const includedAttractionIds = new Set<Id<"attractions">>();
  let totalTransportMinutes = 0;
  let totalAttractionMinutes = 0;

  for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
    const selected = selectDayAttractions(remaining, maxStops);
    const scheduledItems = scheduleDay({
      attractions: selected,
      restaurants,
      hasRentalCar: trip.hasRentalCar,
      dayIndex,
    });
    const scheduledAttractionIds = new Set(
      scheduledItems
        .map((item) => item.attractionId)
        .filter((id): id is Id<"attractions"> => Boolean(id)),
    );
    const includedAttractions = selected.filter((attraction) =>
      scheduledAttractionIds.has(attraction._id),
    );
    for (const attraction of includedAttractions) {
      includedAttractionIds.add(attraction._id);
      totalAttractionMinutes += attraction.estimatedVisitMinutes;
    }

    const legs = buildLegs(scheduledItems, trip.hasRentalCar);
    totalTransportMinutes += legs.reduce(
      (sum, leg) => sum + leg.durationMinutes,
      0,
    );

    const mealCount = scheduledItems.filter((item) => item.type !== "attraction")
      .length;
    const dayScore =
      includedAttractions.reduce(
        (sum, attraction) => sum + attractionScore(attraction),
        0,
      ) -
      legs.reduce((sum, leg) => sum + leg.durationMinutes, 0) +
      mealCount * 20;

    days.push({
      date: dates[dayIndex],
      dayIndex,
      summary:
        includedAttractions.length > 0
          ? `${includedAttractions.length} attractions, ${mealCount} meals, ${Math.round(
              legs.reduce((sum, leg) => sum + leg.durationMinutes, 0),
            )} minutes in transit.`
          : "Open day reserved for optional sites or rest.",
      score: Math.round(dayScore),
      items: scheduledItems,
      legs,
    });
  }

  const excludedAttractionIds = attractions
    .filter((attraction) => !includedAttractionIds.has(attraction._id))
    .map((attraction) => attraction._id);
  const includedCount = includedAttractionIds.size;
  const score =
    includedCount * 100 +
    eligible.reduce((sum, attraction) => sum + attraction.rating * 10, 0) -
    totalTransportMinutes;

  return {
    days,
    score: Math.round(score),
    summary: `Visits ${includedCount} of ${eligible.length} rated attractions across ${dates.length} full days with lunch and dinner placed near each route.`,
    excludedAttractionIds,
    diagnostics: JSON.stringify({
      planner: "heuristic-v1",
      attractionsConsidered: attractions.length,
      attractionsEligible: eligible.length,
      attractionsIncluded: includedCount,
      attractionsExcluded: excludedAttractionIds.length,
      totalAttractionMinutes,
      totalTransportMinutes,
      rentalCar: trip.hasRentalCar,
      pace: trip.pace,
    }),
  };
}

function selectDayAttractions(
  remaining: RatedAttraction[],
  maxStops: number,
): RatedAttraction[] {
  const anchor = remaining.shift();
  if (!anchor) {
    return [];
  }

  const selected = [anchor];
  while (selected.length < maxStops && remaining.length > 0) {
    const centroid = getCentroid(selected);
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distancePenalty =
        distanceMeters(centroid, candidate) / (candidate.rating >= 4 ? 2600 : 1500);
      const score = attractionScore(candidate) - distancePenalty;
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return orderNearestNeighbor(selected);
}

function scheduleDay({
  attractions,
  restaurants,
  hasRentalCar,
  dayIndex,
}: {
  attractions: RatedAttraction[];
  restaurants: Restaurant[];
  hasRentalCar: boolean;
  dayIndex: number;
}): PlannedItem[] {
  const items: PlannedItem[] = [];
  let currentMinutes = 9 * 60;
  let lunchInserted = false;

  for (let index = 0; index < attractions.length; index += 1) {
    const attraction = attractions[index];
    const nextPoint = toPoint(attraction);
    const previousPoint = items.length > 0 ? items[items.length - 1] : null;
    if (previousPoint) {
      currentMinutes += estimateRoute(previousPoint, nextPoint, hasRentalCar)
        .durationMinutes;
    }

    if (
      !lunchInserted &&
      items.length > 0 &&
      (currentMinutes >= 11 * 60 + 30 ||
        currentMinutes + attraction.estimatedVisitMinutes >= 12 * 60 + 15)
    ) {
      const lunch = pickRestaurant(restaurants, previousPoint ?? nextPoint, "lunch");
      if (lunch) {
        currentMinutes = Math.max(currentMinutes, 11 * 60 + 45);
        items.push(makeMealItem(lunch, "lunch", currentMinutes));
        currentMinutes += 60;
        lunchInserted = true;
      }
    }

    const visitMinutes = attraction.estimatedVisitMinutes;
    items.push({
      type: "attraction",
      attractionId: attraction._id,
      name: attraction.name,
      startMinutes: currentMinutes,
      endMinutes: currentMinutes + visitMinutes,
      durationMinutes: visitMinutes,
      notes: buildAttractionPlanNotes(attraction, dayIndex),
      bookingUrl: attraction.ticketUrl ?? attraction.officialUrl,
      lat: attraction.lat,
      lng: attraction.lng,
    });
    currentMinutes += visitMinutes + 10;
  }

  if (!lunchInserted) {
    const lunchAnchor = items[Math.min(1, Math.max(items.length - 1, 0))];
    const lunch = lunchAnchor
      ? pickRestaurant(restaurants, lunchAnchor, "lunch")
      : null;
    if (lunch) {
      items.splice(Math.min(2, items.length), 0, makeMealItem(lunch, "lunch", 12 * 60));
    }
  }

  const dinnerAnchor = items[items.length - 1];
  const dinner = dinnerAnchor
    ? pickRestaurant(restaurants, dinnerAnchor, "dinner")
    : restaurants[0];
  if (dinner) {
    const dinnerStart = Math.max(17 * 60 + 45, items[items.length - 1]?.endMinutes ?? 17 * 60 + 45);
    items.push(makeMealItem(dinner, "dinner", dinnerStart));
  }

  let scheduled = rescheduleWithLegs(items, hasRentalCar);
  while (
    (scheduled[scheduled.length - 1]?.endMinutes ?? 0) > 20 * 60 + 30 &&
    scheduled.filter((item) => item.type === "attraction").length > 2
  ) {
    const lastAttraction = [...scheduled]
      .reverse()
      .find((item) => item.type === "attraction");
    if (!lastAttraction?.attractionId) {
      break;
    }

    scheduled = rescheduleWithLegs(
      scheduled.filter((item) => item.attractionId !== lastAttraction.attractionId),
      hasRentalCar,
    );
  }

  return scheduled;
}

function rescheduleWithLegs(items: PlannedItem[], hasRentalCar: boolean) {
  const scheduled: PlannedItem[] = [];
  let currentMinutes = 9 * 60;

  for (const item of items) {
    if (scheduled.length > 0) {
      currentMinutes += estimateRoute(
        scheduled[scheduled.length - 1],
        item,
        hasRentalCar,
      ).durationMinutes;
    }

    if (item.type === "lunch") {
      currentMinutes = Math.max(currentMinutes, 11 * 60 + 45);
    }
    if (item.type === "dinner") {
      currentMinutes = Math.max(currentMinutes, 17 * 60 + 45);
    }

    scheduled.push({
      ...item,
      startMinutes: currentMinutes,
      endMinutes: currentMinutes + item.durationMinutes,
    });
    currentMinutes += item.durationMinutes + 10;
  }

  return scheduled;
}

function buildLegs(items: PlannedItem[], hasRentalCar: boolean) {
  const legs: RouteEstimate[] = [];
  for (let index = 0; index < items.length - 1; index += 1) {
    legs.push(estimateRoute(items[index], items[index + 1], hasRentalCar));
  }
  return legs;
}

function estimateRoute(
  origin: Point,
  destination: Point,
  hasRentalCar: boolean,
): RouteEstimate {
  const distance = Math.round(distanceMeters(origin, destination));
  const polyline = bendPolyline(origin, destination);

  if (hasRentalCar) {
    return {
      mode: "car",
      durationMinutes: Math.max(8, Math.round(distance / 430) + 7),
      distanceMeters: distance,
      polyline,
      instructionsSummary: `Drive from ${origin.name} to ${destination.name}; keep the car for the full day and allow time for parking.`,
      transitLineNames: [],
      transferCount: 0,
    };
  }

  const walkMinutes = Math.round(distance / 80);
  if (walkMinutes <= 15) {
    return {
      mode: "walk",
      durationMinutes: Math.max(4, walkMinutes),
      distanceMeters: distance,
      polyline,
      instructionsSummary: `Walk from ${origin.name} to ${destination.name}.`,
      transitLineNames: [],
      transferCount: 0,
    };
  }

  if (hasDirectTransit(origin, destination, distance)) {
    return {
      mode: "transit",
      durationMinutes: Math.max(14, Math.round(distance / 310) + 8),
      distanceMeters: distance,
      polyline,
      instructionsSummary: `Use a direct transit leg from ${origin.name} to ${destination.name}; no transfers included in this estimate.`,
      transitLineNames: [guessTransitLine(origin, destination)],
      transferCount: 0,
    };
  }

  return {
    mode: "rideshare",
    durationMinutes: Math.max(10, Math.round(distance / 470) + 6),
    distanceMeters: distance,
    polyline,
    instructionsSummary: `Use taxi or rideshare from ${origin.name} to ${destination.name}.`,
    transitLineNames: [],
    transferCount: 0,
    fallbackReason: "Walking was long and no direct no-transfer transit estimate was accepted.",
  };
}

function attractionScore(attraction: RatedAttraction) {
  return (
    attraction.rating * 120 +
    attraction.confidence * 35 +
    Math.min(attraction.estimatedVisitMinutes, 150) / 10 -
    (attraction.requiresTicket && attraction.rating < 3 ? 12 : 0)
  );
}

function orderNearestNeighbor(attractions: RatedAttraction[]) {
  if (attractions.length <= 2) {
    return attractions;
  }

  const ordered = [attractions[0]];
  const remaining = attractions.slice(1);

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidateDistance = distanceMeters(current, remaining[index]);
      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearestIndex = index;
      }
    }
    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }

  return ordered;
}

function pickRestaurant(
  restaurants: Restaurant[],
  anchor: Point,
  mealType: "lunch" | "dinner",
) {
  const preferred = restaurants.filter((restaurant) =>
    mealType === "dinner"
      ? /izakaya|casual|ramen|japanese/i.test(restaurant.cuisine)
      : /seafood|ramen|japanese/i.test(restaurant.cuisine),
  );
  const candidates = preferred.length > 0 ? preferred : restaurants;
  return [...candidates].sort(
    (a, b) => distanceMeters(anchor, a) - distanceMeters(anchor, b),
  )[0];
}

function makeMealItem(
  restaurant: Restaurant,
  type: "lunch" | "dinner",
  startMinutes: number,
): PlannedItem {
  const durationMinutes = type === "lunch" ? 60 : 75;
  return {
    type,
    restaurantId: restaurant._id,
    name: restaurant.name,
    startMinutes,
    endMinutes: startMinutes + durationMinutes,
    durationMinutes,
    notes: `${restaurant.cuisine} in ${restaurant.neighborhood}. ${restaurant.notes}`,
    lat: restaurant.lat,
    lng: restaurant.lng,
  };
}

function buildAttractionPlanNotes(attraction: RatedAttraction, dayIndex: number) {
  const priority =
    attraction.rating >= 4
      ? "Must-see stop"
      : attraction.rating >= 3
        ? "High-priority stop"
        : "Efficient fit";
  return `${priority} for day ${dayIndex + 1}. ${attraction.openingHoursSummary} ${attraction.requiresTicket ? "Book ahead if possible." : ""}`;
}

function hasDirectTransit(origin: Point, destination: Point, distance: number) {
  if (distance < 1200 || distance > 12500) {
    return false;
  }

  const latDelta = Math.abs(origin.lat - destination.lat);
  const lngDelta = Math.abs(origin.lng - destination.lng);
  return latDelta < 0.065 || lngDelta < 0.08 || distance < 6500;
}

function guessTransitLine(origin: Point, destination: Point) {
  const combined = `${origin.name} ${destination.name}`.toLowerCase();
  if (combined.includes("shibuya") || combined.includes("meiji")) {
    return "JR Yamanote Line";
  }
  if (combined.includes("odaiba") || combined.includes("toyosu")) {
    return "Yurikamome direct segment";
  }
  if (combined.includes("asakusa") || combined.includes("skytree")) {
    return "Tokyo Metro Ginza/Asakusa direct segment";
  }
  return "Direct metro/JR segment";
}

function bendPolyline(origin: Point, destination: Point) {
  const midLat = (origin.lat + destination.lat) / 2;
  const midLng = (origin.lng + destination.lng) / 2;
  const offset = Math.min(
    0.015,
    Math.abs(origin.lat - destination.lat) + Math.abs(origin.lng - destination.lng),
  );

  return [
    { lat: origin.lat, lng: origin.lng },
    { lat: midLat + offset / 3, lng: midLng - offset / 4 },
    { lat: destination.lat, lng: destination.lng },
  ];
}

function toPoint(attraction: RatedAttraction): Point {
  return {
    lat: attraction.lat,
    lng: attraction.lng,
    name: attraction.name,
  };
}

function getCentroid(points: Point[]): Point {
  return {
    name: "current route",
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

function distanceMeters(a: Point, b: Point) {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const value =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function enumerateDates(startDate: string, endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return [];
  }

  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return [];
  }

  const dates = [];
  for (
    let current = start;
    current <= end;
    current += 24 * 60 * 60 * 1000
  ) {
    dates.push(new Date(current).toISOString().slice(0, 10));
  }
  return dates;
}

function formatTime(minutes: number) {
  const normalized = Math.max(0, Math.round(minutes));
  const hours24 = Math.floor(normalized / 60) % 24;
  const mins = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${suffix}`;
}
