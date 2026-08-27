import { v } from "convex/values";
import {
  action,
  env,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const routeModeValidator = v.union(
  v.literal("walk"),
  v.literal("transit"),
  v.literal("rideshare"),
  v.literal("car"),
);

const routePointValidator = v.object({
  name: v.string(),
  lat: v.number(),
  lng: v.number(),
});

const legInputValidator = v.object({
  legId: v.id("routeLegs"),
  mode: routeModeValidator,
  from: routePointValidator,
  to: routePointValidator,
});

const routeEstimateValidator = v.object({
  mode: routeModeValidator,
  durationMinutes: v.number(),
  distanceMeters: v.number(),
  polyline: v.array(v.object({ lat: v.number(), lng: v.number() })),
  instructionsSummary: v.string(),
  transitLineNames: v.array(v.string()),
  transferCount: v.number(),
  fallbackReason: v.optional(v.string()),
  provider: v.union(v.literal("googleRoutes"), v.literal("heuristic")),
  status: v.union(
    v.literal("ready"),
    v.literal("fallback"),
    v.literal("error"),
  ),
  error: v.optional(v.string()),
});

const cachedEstimateValidator = v.object({
  _id: v.id("routeEstimates"),
  _creationTime: v.number(),
  cacheKey: v.string(),
  requestedMode: routeModeValidator,
  mode: routeModeValidator,
  providerMode: v.string(),
  originLat: v.number(),
  originLng: v.number(),
  destinationLat: v.number(),
  destinationLng: v.number(),
  durationMinutes: v.number(),
  distanceMeters: v.number(),
  polyline: v.array(v.object({ lat: v.number(), lng: v.number() })),
  instructionsSummary: v.string(),
  transitLineNames: v.array(v.string()),
  transferCount: v.number(),
  fallbackReason: v.optional(v.string()),
  provider: v.union(v.literal("googleRoutes"), v.literal("heuristic")),
  status: v.union(
    v.literal("ready"),
    v.literal("fallback"),
    v.literal("error"),
  ),
  fetchedAt: v.number(),
  error: v.optional(v.string()),
});

type RouteMode = "walk" | "transit" | "rideshare" | "car";
type RouteProvider = "googleRoutes" | "heuristic";
type RouteStatus = "ready" | "fallback" | "error";
type Point = { name: string; lat: number; lng: number };
type LegInput = {
  legId: Id<"routeLegs">;
  mode: RouteMode;
  from: Point;
  to: Point;
};
type RouteEstimate = {
  mode: RouteMode;
  durationMinutes: number;
  distanceMeters: number;
  polyline: Array<{ lat: number; lng: number }>;
  instructionsSummary: string;
  transitLineNames: string[];
  transferCount: number;
  fallbackReason?: string;
  provider: RouteProvider;
  status: RouteStatus;
  error?: string;
};
type CachedEstimate = RouteEstimate & {
  cacheKey: string;
  requestedMode: RouteMode;
  providerMode: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  fetchedAt: number;
};
type PlanLegInputs = {
  tripId: Id<"trips">;
  hasRentalCar: boolean;
  legs: LegInput[];
};
type RefineResult = {
  status: "ready" | "fallback" | "partial";
  message: string;
  updatedLegCount: number;
  cachedLegCount: number;
};

export const refinePlanRoutes = action({
  args: {
    tripId: v.id("trips"),
    planId: v.id("plans"),
    sessionId: v.string(),
  },
  returns: v.object({
    status: v.union(
      v.literal("ready"),
      v.literal("fallback"),
      v.literal("partial"),
    ),
    message: v.string(),
    updatedLegCount: v.number(),
    cachedLegCount: v.number(),
  }),
  handler: async (ctx, args): Promise<RefineResult> => {
    const planInputs: PlanLegInputs | null = await ctx.runQuery(
      internal.routing.getPlanLegInputs,
      args,
    );
    if (!planInputs) {
      throw new Error("Plan not found.");
    }

    const googleKey = env.GOOGLE_MAPS_API_KEY;
    if (!googleKey) {
      return {
        status: "fallback" as const,
        message:
          "Google Routes is not configured, so the itinerary is using heuristic route estimates.",
        updatedLegCount: 0,
        cachedLegCount: 0,
      };
    }

    let updatedLegCount = 0;
    let cachedLegCount = 0;
    for (const leg of planInputs.legs.slice(0, 30)) {
      const cacheKey = routeCacheKey(leg);
      const cached: CachedEstimate | null = await ctx.runQuery(
        internal.routing.getCachedEstimate,
        { cacheKey },
      );
      if (cached && Date.now() - cached.fetchedAt < 1000 * 60 * 60 * 24 * 14) {
        await ctx.runMutation(internal.routing.patchLegFromEstimate, {
          cacheKey,
          legId: leg.legId,
          estimate: routeEstimateFromCached(cached),
        });
        cachedLegCount += 1;
        continue;
      }

      const estimate = await estimateWithGoogleRoutes(googleKey, leg);
      await ctx.runMutation(internal.routing.patchLegFromEstimate, {
        cacheKey,
        legId: leg.legId,
        estimate,
      });
      updatedLegCount += 1;
    }

    const total = planInputs.legs.length;
    return {
      status: updatedLegCount + cachedLegCount === total ? "ready" : "partial",
      message: `Google Routes refined ${updatedLegCount} route legs and reused ${cachedLegCount} cached legs.`,
      updatedLegCount,
      cachedLegCount,
    };
  },
});

export const getPlanLegInputs = internalQuery({
  args: {
    tripId: v.id("trips"),
    planId: v.id("plans"),
    sessionId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      tripId: v.id("trips"),
      hasRentalCar: v.boolean(),
      legs: v.array(legInputValidator),
    }),
  ),
  handler: async (ctx, args): Promise<PlanLegInputs | null> => {
    const trip = await ctx.db.get(args.tripId);
    const plan = await ctx.db.get(args.planId);
    if (
      !trip ||
      !plan ||
      trip.sessionId !== args.sessionId ||
      plan.sessionId !== args.sessionId ||
      plan.tripId !== args.tripId
    ) {
      return null;
    }

    const days = await ctx.db
      .query("planDays")
      .withIndex("by_planId_and_dayIndex", (q) => q.eq("planId", args.planId))
      .order("asc")
      .take(10);

    const legs: LegInput[] = [];
    for (const day of days) {
      const items = await ctx.db
        .query("planItems")
        .withIndex("by_planDayId_and_sortOrder", (q) =>
          q.eq("planDayId", day._id),
        )
        .order("asc")
        .take(20);
      const itemById = new Map(items.map((item) => [item._id, item]));
      const dayLegs = await ctx.db
        .query("routeLegs")
        .withIndex("by_planDayId_and_sortOrder", (q) =>
          q.eq("planDayId", day._id),
        )
        .order("asc")
        .take(20);

      for (const leg of dayLegs) {
        const from = itemById.get(leg.fromItemId);
        const to = itemById.get(leg.toItemId);
        if (!from || !to) {
          continue;
        }
        legs.push({
          legId: leg._id,
          mode: leg.mode,
          from: {
            name: from.name,
            lat: from.lat,
            lng: from.lng,
          },
          to: {
            name: to.name,
            lat: to.lat,
            lng: to.lng,
          },
        });
      }
    }

    return {
      tripId: args.tripId,
      hasRentalCar: trip.hasRentalCar,
      legs,
    };
  },
});

export const getCachedEstimate = internalQuery({
  args: { cacheKey: v.string() },
  returns: v.union(v.null(), cachedEstimateValidator),
  handler: async (ctx, args) => {
    const estimate = await ctx.db
      .query("routeEstimates")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .order("desc")
      .first();

    if (!estimate) {
      return null;
    }

    return {
      _id: estimate._id,
      _creationTime: estimate._creationTime,
      cacheKey: estimate.cacheKey,
      requestedMode: estimate.requestedMode,
      providerMode: estimate.providerMode,
      originLat: estimate.originLat,
      originLng: estimate.originLng,
      destinationLat: estimate.destinationLat,
      destinationLng: estimate.destinationLng,
      mode: estimate.requestedMode,
      durationMinutes: estimate.durationMinutes,
      distanceMeters: estimate.distanceMeters,
      polyline: estimate.polyline,
      instructionsSummary: estimate.instructionsSummary,
      transitLineNames: estimate.transitLineNames,
      transferCount: estimate.transferCount,
      fallbackReason: estimate.fallbackReason,
      provider: estimate.provider,
      status: estimate.status,
      fetchedAt: estimate.fetchedAt,
      error: estimate.error,
    };
  },
});

export const patchLegFromEstimate = internalMutation({
  args: {
    cacheKey: v.string(),
    legId: v.id("routeLegs"),
    estimate: routeEstimateValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const leg = await ctx.db.get(args.legId);
    if (!leg) {
      return null;
    }

    await ctx.db.patch(args.legId, {
      mode: args.estimate.mode,
      durationMinutes: args.estimate.durationMinutes,
      distanceMeters: args.estimate.distanceMeters,
      polyline: args.estimate.polyline,
      instructionsSummary: args.estimate.instructionsSummary,
      transitLineNames: args.estimate.transitLineNames,
      transferCount: args.estimate.transferCount,
      fallbackReason: args.estimate.fallbackReason,
    });

    const now = Date.now();
    const existing = await ctx.db
      .query("routeEstimates")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .order("desc")
      .first();
    const estimateDoc = {
      cacheKey: args.cacheKey,
      requestedMode: args.estimate.mode,
      providerMode: providerMode(args.estimate.mode),
      originLat: args.estimate.polyline[0]?.lat ?? 0,
      originLng: args.estimate.polyline[0]?.lng ?? 0,
      destinationLat:
        args.estimate.polyline[args.estimate.polyline.length - 1]?.lat ?? 0,
      destinationLng:
        args.estimate.polyline[args.estimate.polyline.length - 1]?.lng ?? 0,
      durationMinutes: args.estimate.durationMinutes,
      distanceMeters: args.estimate.distanceMeters,
      polyline: args.estimate.polyline,
      instructionsSummary: args.estimate.instructionsSummary,
      transitLineNames: args.estimate.transitLineNames,
      transferCount: args.estimate.transferCount,
      fallbackReason: args.estimate.fallbackReason,
      provider: args.estimate.provider,
      status: args.estimate.status,
      fetchedAt: now,
      error: args.estimate.error,
    };

    if (existing) {
      await ctx.db.patch(existing._id, estimateDoc);
    } else {
      await ctx.db.insert("routeEstimates", estimateDoc);
    }

    return null;
  },
});

async function estimateWithGoogleRoutes(
  apiKey: string,
  leg: LegInput,
): Promise<RouteEstimate> {
  try {
    const route = await computeGoogleRoute(apiKey, leg, providerMode(leg.mode));
    if (leg.mode === "transit" && route.transferCount > 0) {
      const driveFallback = await computeGoogleRoute(apiKey, leg, "DRIVE");
      return {
        ...driveFallback,
        mode: "rideshare",
        fallbackReason:
          "Google transit route required a transfer, so this leg was switched to taxi/rideshare.",
      };
    }

    return {
      ...route,
      mode: leg.mode,
    };
  } catch (error) {
    return {
      ...heuristicEstimate(leg),
      provider: "heuristic",
      status: "error",
      error: errorMessage(error),
      fallbackReason: `Google Routes unavailable: ${errorMessage(error)}`,
    };
  }
}

async function computeGoogleRoute(
  apiKey: string,
  leg: LegInput,
  mode: "WALK" | "TRANSIT" | "DRIVE",
): Promise<RouteEstimate> {
  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.transitDetails.transitLine.name,routes.legs.steps.transitDetails.transitLine.shortName",
      },
      body: JSON.stringify({
        origin: waypoint(leg.from),
        destination: waypoint(leg.to),
        travelMode: mode,
        computeAlternativeRoutes: false,
        polylineQuality: "OVERVIEW",
        languageCode: "en-US",
        units: "METRIC",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Google Routes HTTP ${response.status}`);
  }

  const payload = asRecord(await response.json());
  const routes = asArray(payload?.routes);
  const route = asRecord(routes[0]);
  if (!route) {
    throw new Error("Google Routes returned no route");
  }

  const encodedPolyline = getNestedString(
    asRecord(route.polyline),
    "encodedPolyline",
  );
  const polyline = encodedPolyline
    ? decodePolyline(encodedPolyline)
    : bendPolyline(leg.from, leg.to);
  const distanceMeters =
    getNumber(route, "distanceMeters") ?? Math.round(distanceMetersBetween(leg));
  const transitLineNames = transitLines(route);
  const transferCount = Math.max(0, transitLineNames.length - 1);

  return {
    mode: leg.mode,
    durationMinutes: Math.max(1, Math.ceil(durationSeconds(route) / 60)),
    distanceMeters,
    polyline,
    instructionsSummary: routeSummary(leg, mode, transitLineNames),
    transitLineNames,
    transferCount,
    provider: "googleRoutes",
    status: "ready",
  };
}

function waypoint(point: Point) {
  return {
    location: {
      latLng: {
        latitude: point.lat,
        longitude: point.lng,
      },
    },
  };
}

function providerMode(mode: RouteMode): "WALK" | "TRANSIT" | "DRIVE" {
  if (mode === "walk") {
    return "WALK";
  }
  if (mode === "transit") {
    return "TRANSIT";
  }
  return "DRIVE";
}

function routeSummary(
  leg: LegInput,
  mode: "WALK" | "TRANSIT" | "DRIVE",
  transitLineNames: string[],
) {
  if (mode === "TRANSIT") {
    return `Use direct transit from ${leg.from.name} to ${leg.to.name}${transitLineNames.length > 0 ? ` via ${transitLineNames.join(", ")}` : ""}.`;
  }
  if (mode === "WALK") {
    return `Walk from ${leg.from.name} to ${leg.to.name}.`;
  }
  if (leg.mode === "car") {
    return `Drive from ${leg.from.name} to ${leg.to.name}; keep the car for the full day and allow time for parking.`;
  }
  return `Use taxi or rideshare from ${leg.from.name} to ${leg.to.name}.`;
}

function heuristicEstimate(leg: LegInput): RouteEstimate {
  const distanceMeters = Math.round(distanceMetersBetween(leg));
  const polyline = bendPolyline(leg.from, leg.to);
  if (leg.mode === "walk") {
    return {
      mode: "walk",
      durationMinutes: Math.max(4, Math.round(distanceMeters / 80)),
      distanceMeters,
      polyline,
      instructionsSummary: `Walk from ${leg.from.name} to ${leg.to.name}.`,
      transitLineNames: [],
      transferCount: 0,
      provider: "heuristic",
      status: "fallback",
    };
  }

  if (leg.mode === "transit") {
    return {
      mode: "transit",
      durationMinutes: Math.max(14, Math.round(distanceMeters / 310) + 8),
      distanceMeters,
      polyline,
      instructionsSummary: `Use a direct transit estimate from ${leg.from.name} to ${leg.to.name}.`,
      transitLineNames: ["Direct transit"],
      transferCount: 0,
      provider: "heuristic",
      status: "fallback",
    };
  }

  return {
    mode: leg.mode,
    durationMinutes: Math.max(10, Math.round(distanceMeters / 470) + 6),
    distanceMeters,
    polyline,
    instructionsSummary:
      leg.mode === "car"
        ? `Drive from ${leg.from.name} to ${leg.to.name}; allow time for parking.`
        : `Use taxi or rideshare from ${leg.from.name} to ${leg.to.name}.`,
    transitLineNames: [],
    transferCount: 0,
    provider: "heuristic",
    status: "fallback",
  };
}

function routeCacheKey(leg: LegInput) {
  return [
    leg.mode,
    coordinateKey(leg.from.lat),
    coordinateKey(leg.from.lng),
    coordinateKey(leg.to.lat),
    coordinateKey(leg.to.lng),
  ].join(":");
}

function routeEstimateFromCached(cached: CachedEstimate): RouteEstimate {
  return {
    mode: cached.mode,
    durationMinutes: cached.durationMinutes,
    distanceMeters: cached.distanceMeters,
    polyline: cached.polyline,
    instructionsSummary: cached.instructionsSummary,
    transitLineNames: cached.transitLineNames,
    transferCount: cached.transferCount,
    fallbackReason: cached.fallbackReason,
    provider: cached.provider,
    status: cached.status,
    error: cached.error,
  };
}

function coordinateKey(value: number) {
  return value.toFixed(5);
}

function durationSeconds(route: Record<string, unknown>) {
  const duration = getString(route, "duration");
  if (!duration) {
    return 0;
  }
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration);
  return match ? Number(match[1]) : 0;
}

function transitLines(route: Record<string, unknown>) {
  const legs = asArray(route.legs);
  const names = new Set<string>();
  for (const leg of legs) {
    const steps = asArray(asRecord(leg)?.steps);
    for (const step of steps) {
      const record = asRecord(step);
      if (getString(record, "travelMode") !== "TRANSIT") {
        continue;
      }
      const transitDetails = asRecord(record?.transitDetails);
      const transitLine = asRecord(transitDetails?.transitLine);
      const name =
        getString(transitLine, "shortName") ?? getString(transitLine, "name");
      if (name) {
        names.add(name);
      }
    }
  }
  return [...names];
}

function decodePolyline(encoded: string) {
  const coordinates: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const latResult = decodeCoordinate(encoded, index);
    index = latResult.nextIndex;
    lat += latResult.delta;

    const lngResult = decodeCoordinate(encoded, index);
    index = lngResult.nextIndex;
    lng += lngResult.delta;

    coordinates.push({ lat: lat / 100000, lng: lng / 100000 });
  }

  return coordinates;
}

function decodeCoordinate(encoded: string, startIndex: number) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;

  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20 && index < encoded.length);

  const delta = result & 1 ? ~(result >> 1) : result >> 1;
  return { delta, nextIndex: index };
}

function bendPolyline(from: Point, to: Point) {
  const midLat = (from.lat + to.lat) / 2 + (to.lng - from.lng) * 0.12;
  const midLng = (from.lng + to.lng) / 2 - (to.lat - from.lat) * 0.12;
  return [
    { lat: from.lat, lng: from.lng },
    { lat: midLat, lng: midLng },
    { lat: to.lat, lng: to.lng },
  ];
}

function distanceMetersBetween(leg: LegInput) {
  const earthRadiusMeters = 6371000;
  const fromLat = toRadians(leg.from.lat);
  const toLat = toRadians(leg.to.lat);
  const latDelta = toRadians(leg.to.lat - leg.from.lat);
  const lngDelta = toRadians(leg.to.lng - leg.from.lng);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getNestedString(record: Record<string, unknown> | null, key: string) {
  return getString(record, key);
}

function getNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
