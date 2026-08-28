"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  Footprints,
  Hotel,
  Mail,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Send,
  Sparkles,
  Star,
  Train,
  Utensils,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Pace = "relaxed" | "balanced" | "packed";
type RatingValue = 0 | 1 | 2 | 3 | 4;
type RouteMode = "walk" | "transit" | "rideshare" | "car";
type Category =
  | "temple"
  | "viewpoint"
  | "museum"
  | "market"
  | "neighborhood"
  | "park"
  | "waterfront"
  | "experience";

type Attraction = {
  _id: Id<"attractions">;
  name: string;
  category: Category;
  description: string;
  practicalNotes: string;
  lat: number;
  lng: number;
  address: string;
  officialUrl?: string;
  ticketUrl?: string;
  sourceUrls: string[];
  photoUrls: string[];
  openingHoursSummary: string;
  costSummary: string;
  estimatedVisitMinutes: number;
  requiresTicket: boolean;
  confidence: number;
  rating: RatingValue;
};

type MapPoint = {
  lat: number;
  lng: number;
  name: string;
};

type MapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

type PlanItem = MapPoint & {
  _id: Id<"planItems">;
  type: "attraction" | "lunch" | "dinner" | "break";
  attractionId?: Id<"attractions">;
  restaurantId?: Id<"restaurants">;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string;
  bookingUrl?: string;
  sortOrder: number;
};

type RouteLeg = {
  _id: Id<"routeLegs">;
  fromItemId: Id<"planItems">;
  toItemId: Id<"planItems">;
  mode: RouteMode;
  durationMinutes: number;
  distanceMeters: number;
  polyline: Array<{ lat: number; lng: number }>;
  instructionsSummary: string;
  transitLineNames: string[];
  transferCount: number;
  fallbackReason?: string;
  sortOrder: number;
};

type PlanDay = {
  _id: Id<"planDays">;
  date: string;
  dayIndex: number;
  transportPolicy: "walkTransitRideshare" | "carOnly";
  summary: string;
  score: number;
  items: PlanItem[];
  legs: RouteLeg[];
};

type Plan = {
  _id: Id<"plans">;
  tripId: Id<"trips">;
  name: string;
  status: "generated" | "saved" | "archived";
  plannerVersion: string;
  score: number;
  summary: string;
  excludedAttractionIds: Id<"attractions">[];
  diagnostics: string;
  days: PlanDay[];
};

type HotelRecommendation = {
  _id: Id<"hotelRecommendations">;
  areaName: string;
  centerLat: number;
  centerLng: number;
  summary: string;
  safetyNotes: string;
  transportNotes: string;
  nearbyTransitHubs: string[];
  searchUrl: string;
  score: number;
  createdAt: number;
};

type OutboundEmail = {
  _id: Id<"outboundEmails">;
  to: string;
  subject: string;
  status: "queued" | "sent" | "skipped" | "error";
  providerMessageId?: string;
  error?: string;
  createdAt: number;
  sentAt?: number;
};

type DiscoveryRun = {
  _id: Id<"discoveryRuns">;
  status: "queued" | "running" | "ready" | "fallback" | "partial" | "error";
  message: string;
  source: "providers" | "demoSeed" | "mixed" | "none";
  providerStats: {
    google: string;
    firecrawl: string;
    openai: string;
    attractionCount: number;
    restaurantCount: number;
    sourceUrlCount: number;
  };
  startedAt: number;
  finishedAt?: number;
  error?: string;
};

const ratingOptions = [0, 1, 2, 3, 4] as const;

const routeStyles: Record<
  RouteMode,
  { label: string; stroke: string; bg: string; text: string; icon: React.ReactNode }
> = {
  walk: {
    label: "Walk",
    stroke: "#16a34a",
    bg: "bg-green-50 border-green-200",
    text: "text-green-800",
    icon: <Footprints className="size-3.5" />,
  },
  transit: {
    label: "Transit",
    stroke: "#2563eb",
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    icon: <Train className="size-3.5" />,
  },
  rideshare: {
    label: "Rideshare",
    stroke: "#9333ea",
    bg: "bg-purple-50 border-purple-200",
    text: "text-purple-800",
    icon: <Navigation className="size-3.5" />,
  },
  car: {
    label: "Car",
    stroke: "#ea580c",
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-800",
    icon: <Car className="size-3.5" />,
  },
};

const categoryStyles: Record<
  Category,
  { label: string; pin: string; chip: string }
> = {
  temple: {
    label: "Temple",
    pin: "bg-rose-600",
    chip: "border-rose-200 bg-rose-50 text-rose-800",
  },
  viewpoint: {
    label: "Viewpoint",
    pin: "bg-sky-600",
    chip: "border-sky-200 bg-sky-50 text-sky-800",
  },
  museum: {
    label: "Museum",
    pin: "bg-violet-600",
    chip: "border-violet-200 bg-violet-50 text-violet-800",
  },
  market: {
    label: "Market",
    pin: "bg-amber-600",
    chip: "border-amber-200 bg-amber-50 text-amber-900",
  },
  neighborhood: {
    label: "District",
    pin: "bg-teal-600",
    chip: "border-teal-200 bg-teal-50 text-teal-800",
  },
  park: {
    label: "Park",
    pin: "bg-emerald-600",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  waterfront: {
    label: "Waterfront",
    pin: "bg-cyan-700",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  experience: {
    label: "Experience",
    pin: "bg-fuchsia-600",
    chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  },
};

const paceOptions: Array<{ value: Pace; label: string }> = [
  { value: "relaxed", label: "Relaxed" },
  { value: "balanced", label: "Balanced" },
  { value: "packed", label: "Packed" },
];

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTripId, setActiveTripId] = useState<Id<"trips"> | null>(null);
  const [selectedAttractionId, setSelectedAttractionId] =
    useState<Id<"attractions"> | null>(null);
  const [destinationName, setDestinationName] = useState("Tokyo, Japan");
  const [startDate, setStartDate] = useState("2026-09-10");
  const [endDate, setEndDate] = useState("2026-09-12");
  const [hasRentalCar, setHasRentalCar] = useState(false);
  const [pace, setPace] = useState<Pace>("balanced");
  const [mealPreferences, setMealPreferences] = useState(
    "Japanese seafood, ramen, izakaya",
  );
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [routingMessage, setRoutingMessage] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = window.setTimeout(() => {
      let storedSessionId = window.localStorage.getItem(
        "travelsmart.sessionId",
      );
      if (!storedSessionId) {
        storedSessionId = window.crypto.randomUUID();
        window.localStorage.setItem("travelsmart.sessionId", storedSessionId);
      }
      setSessionId(storedSessionId);

      const storedTripId = window.localStorage.getItem(
        "travelsmart.activeTripId",
      );
      if (storedTripId) {
        setActiveTripId(storedTripId as Id<"trips">);
      }
    }, 0);

    return () => window.clearTimeout(bootstrap);
  }, []);

  const createTripMutation = useMutation(api.trips.createTrip);
  const setRating = useMutation(api.trips.setRating);
  const generatePlan = useMutation(api.plans.generatePlan);
  const savePlan = useMutation(api.plans.savePlan);
  const discoverAttractions = useAction(api.discovery.discoverAttractions);
  const refinePlanRoutes = useAction(api.routing.refinePlanRoutes);
  const sendSavedPlan = useAction(api.email.sendSavedPlan);

  const trips = useQuery(
    api.trips.listTrips,
    sessionId ? { sessionId } : "skip",
  );
  const workspace = useQuery(
    api.trips.getTripWorkspace,
    sessionId && activeTripId ? { sessionId, tripId: activeTripId } : "skip",
  );
  const plan = useQuery(
    api.plans.getCurrentPlan,
    sessionId && activeTripId ? { sessionId, tripId: activeTripId } : "skip",
  );
  const hotelRecommendation = useQuery(
    api.plans.getHotelRecommendation,
    sessionId && plan ? { sessionId, planId: plan._id } : "skip",
  );
  const outboundEmails = useQuery(
    api.email.listForPlan,
    sessionId && plan ? { sessionId, planId: plan._id } : "skip",
  );
  const discoveryRun = useQuery(
    api.discovery.getLatestRun,
    sessionId && activeTripId ? { sessionId, tripId: activeTripId } : "skip",
  );

  const attractions = useMemo(() => workspace?.attractions ?? [], [workspace]);
  const activeDay = plan?.days[activeDayIndex] ?? plan?.days[0] ?? null;
  const selectedAttraction =
    attractions.find((attraction) => attraction._id === selectedAttractionId) ??
    attractions[0] ??
    null;

  const sortedAttractions = useMemo(
    () =>
      [...attractions].sort(
        (a, b) =>
          b.rating - a.rating ||
          Number(b.requiresTicket) - Number(a.requiresTicket) ||
          b.confidence - a.confidence,
      ),
    [attractions],
  );

  const mapBounds = useMemo(() => {
    const activeDayItems = activeDay?.items ?? [];
    const points = [...attractions, ...activeDayItems];
    if (points.length === 0) {
      return null;
    }
    return {
      minLat: Math.min(...points.map((point) => point.lat)),
      maxLat: Math.max(...points.map((point) => point.lat)),
      minLng: Math.min(...points.map((point) => point.lng)),
      maxLng: Math.max(...points.map((point) => point.lng)),
    };
  }, [activeDay, attractions]);

  async function createTrip() {
    if (!sessionId || creating) {
      return;
    }

    setCreating(true);
    setDiscoveryMessage(null);
    try {
      const tripId = await createTripMutation({
        sessionId,
        destinationName: destinationName.trim() || "Tokyo, Japan",
        startDate,
        endDate,
        hasRentalCar,
        pace,
        mealPreferences: mealPreferences
          .split(",")
          .map((preference) => preference.trim())
          .filter(Boolean),
      });
      window.localStorage.setItem("travelsmart.activeTripId", tripId);
      setActiveTripId(tripId);
      setSelectedAttractionId(null);
      setActiveDayIndex(0);
      setRoutingMessage(null);
      const result = await discoverAttractions({ sessionId, tripId });
      setDiscoveryMessage(result.message);
    } catch (error) {
      setDiscoveryMessage(
        error instanceof Error ? error.message : "Discovery failed.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function updateRating(
    attractionId: Id<"attractions">,
    rating: RatingValue,
  ) {
    if (!sessionId || !workspace) {
      return;
    }

    await setRating({
      tripId: workspace.trip._id,
      attractionId,
      sessionId,
      rating,
    });
  }

  async function createPlan() {
    if (!sessionId || !workspace || planning) {
      return;
    }

    setPlanning(true);
    try {
      const planId = await generatePlan({
        tripId: workspace.trip._id,
        sessionId,
      });
      try {
        const routingResult = await refinePlanRoutes({
          tripId: workspace.trip._id,
          planId,
          sessionId,
        });
        setRoutingMessage(routingResult.message);
      } catch (error) {
        setRoutingMessage(
          error instanceof Error
            ? error.message
            : "Route refinement could not run.",
        );
      }
      setActiveDayIndex(0);
      setEmailMessage(null);
    } finally {
      setPlanning(false);
    }
  }

  async function saveCurrentPlan() {
    if (!sessionId || !plan || savingPlan) {
      return;
    }

    setSavingPlan(true);
    try {
      await savePlan({ planId: plan._id, sessionId });
      setEmailMessage("Plan saved. Hotel area recommendation is ready.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function emailCurrentPlan() {
    if (!sessionId || !plan || sendingEmail) {
      return;
    }

    setSendingEmail(true);
    setEmailMessage(null);
    try {
      const result = await sendSavedPlan({
        tripId: plan.tripId,
        planId: plan._id,
        sessionId,
        to: emailTo,
      });
      setEmailMessage(result.message);
    } catch (error) {
      setEmailMessage(
        error instanceof Error ? error.message : "Email send failed.",
      );
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-950">
      <div className="flex min-h-screen flex-col bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_42%,#fff7ed_100%)]">
        <header className="border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm">
                <MapPin className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-950">
                  TravelSmart
                </h1>
                <div className="text-sm text-slate-600">
                  {workspace
                    ? `${workspace.trip.destinationName} | ${workspace.trip.startDate} to ${workspace.trip.endDate}`
                    : "Map-first itinerary planning"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900">
              <Sparkles className="size-4" />
              Phase 3
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[380px_minmax(0,1fr)_360px] lg:p-5">
          <aside className="flex min-h-0 flex-col gap-4">
            <TripSetupPanel
              activeTripId={activeTripId}
              creating={creating}
              destinationName={destinationName}
              discoveryMessage={discoveryMessage}
              discoveryRun={discoveryRun}
              endDate={endDate}
              hasRentalCar={hasRentalCar}
              mealPreferences={mealPreferences}
              pace={pace}
              sessionReady={Boolean(sessionId)}
              startDate={startDate}
              trips={trips ?? []}
              onCreateTrip={createTrip}
              onDestinationNameChange={setDestinationName}
              onEndDateChange={setEndDate}
              onHasRentalCarChange={setHasRentalCar}
              onMealPreferencesChange={setMealPreferences}
              onPaceChange={setPace}
              onSelectTrip={(tripId) => {
                window.localStorage.setItem("travelsmart.activeTripId", tripId);
                setActiveTripId(tripId);
                setSelectedAttractionId(null);
                setActiveDayIndex(0);
                setDiscoveryMessage(null);
                setRoutingMessage(null);
              }}
              onStartDateChange={setStartDate}
            />

            <PlanControls
              attractionCount={attractions.length}
              canPlan={Boolean(workspace && attractions.length > 0)}
              plan={plan}
              planning={planning}
              routingMessage={routingMessage}
              savingPlan={savingPlan}
              onPlan={createPlan}
              onSave={saveCurrentPlan}
            />

            <AttractionList
              attractions={sortedAttractions}
              selectedAttractionId={selectedAttraction?._id ?? null}
              onSelect={setSelectedAttractionId}
              onRate={updateRating}
            />
          </aside>

          <section className="min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:min-h-0">
            <TravelMap
              attractions={attractions}
              bounds={mapBounds}
              plan={plan}
              activeDayIndex={activeDayIndex}
              selectedAttractionId={selectedAttraction?._id ?? null}
              onSelect={setSelectedAttractionId}
            />
          </section>

          <aside className="min-h-0 space-y-4">
            <PlanPanel
              plan={plan}
              activeDayIndex={activeDayIndex}
              onActiveDayIndexChange={setActiveDayIndex}
              onSelectAttraction={(attractionId) =>
                setSelectedAttractionId(attractionId)
              }
            />
            <HotelAndSharePanel
              emails={outboundEmails ?? []}
              emailMessage={emailMessage}
              emailTo={emailTo}
              hotelRecommendation={hotelRecommendation}
              plan={plan}
              sendingEmail={sendingEmail}
              onEmailToChange={setEmailTo}
              onSendEmail={emailCurrentPlan}
            />
            <AttractionDetails attraction={selectedAttraction} />
          </aside>
        </div>
      </div>
    </main>
  );
}

function TripSetupPanel({
  activeTripId,
  creating,
  destinationName,
  discoveryMessage,
  discoveryRun,
  endDate,
  hasRentalCar,
  mealPreferences,
  pace,
  sessionReady,
  startDate,
  trips,
  onCreateTrip,
  onDestinationNameChange,
  onEndDateChange,
  onHasRentalCarChange,
  onMealPreferencesChange,
  onPaceChange,
  onSelectTrip,
  onStartDateChange,
}: {
  activeTripId: Id<"trips"> | null;
  creating: boolean;
  destinationName: string;
  discoveryMessage: string | null;
  discoveryRun: DiscoveryRun | null | undefined;
  endDate: string;
  hasRentalCar: boolean;
  mealPreferences: string;
  pace: Pace;
  sessionReady: boolean;
  startDate: string;
  trips: Array<{
    _id: Id<"trips">;
    title: string;
    destinationName: string;
    startDate: string;
    endDate: string;
    hasRentalCar: boolean;
    status: string;
  }>;
  onCreateTrip: () => void;
  onDestinationNameChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onHasRentalCarChange: (value: boolean) => void;
  onMealPreferencesChange: (value: string) => void;
  onPaceChange: (value: Pace) => void;
  onSelectTrip: (tripId: Id<"trips">) => void;
  onStartDateChange: (value: string) => void;
}) {
  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardHeader className="space-y-1 p-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-teal-700" />
          Trip Setup
        </CardTitle>
        <CardDescription>
          Provider discovery falls back to the Tokyo demo dataset.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="space-y-2">
          <Label htmlFor="destination">Destination</Label>
          <Input
            id="destination"
            value={destinationName}
            onChange={(event) => onDestinationNameChange(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Pace</Label>
          <div className="grid grid-cols-3 gap-2">
            {paceOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={pace === option.value ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-9",
                  pace === option.value &&
                    "bg-teal-700 text-white hover:bg-teal-800",
                )}
                onClick={() => onPaceChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meals">Meals</Label>
          <Textarea
            id="meals"
            value={mealPreferences}
            rows={2}
            onChange={(event) => onMealPreferencesChange(event.target.value)}
          />
        </div>

        <Button
          type="button"
          className="h-10 w-full bg-[#e85d4f] text-white hover:bg-[#d94f43]"
          disabled={!sessionReady || creating}
          onClick={onCreateTrip}
        >
          <Sparkles className={cn("size-4", creating && "animate-pulse")} />
          {creating ? "Discovering" : "Start Discovery"}
        </Button>

        <DiscoveryStatusPanel
          activeTripId={activeTripId}
          message={discoveryMessage}
          run={discoveryRun}
        />

        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
            hasRentalCar
              ? "border-orange-300 bg-orange-50 text-orange-950"
              : "border-slate-200 bg-slate-50 text-slate-700",
          )}
          onClick={() => onHasRentalCarChange(!hasRentalCar)}
        >
          <span className="flex items-center gap-2 font-medium">
            {hasRentalCar ? <Car className="size-4" /> : <Train className="size-4" />}
            {hasRentalCar ? "Rental car" : "Walk, transit, rideshare"}
          </span>
          <span className="text-xs">{hasRentalCar ? "On" : "Off"}</span>
        </button>

        {trips.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recent Trips
            </div>
            <div className="space-y-2">
              {trips.map((trip) => (
                <button
                  key={trip._id}
                  type="button"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition",
                    activeTripId === trip._id
                      ? "border-teal-300 bg-teal-50"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  )}
                  onClick={() => onSelectTrip(trip._id)}
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {trip.destinationName}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span>
                      {trip.startDate} to {trip.endDate}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">
                      {trip.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiscoveryStatusPanel({
  activeTripId,
  message,
  run,
}: {
  activeTripId: Id<"trips"> | null;
  message: string | null;
  run: DiscoveryRun | null | undefined;
}) {
  if (!activeTripId || (!run && !message)) {
    return null;
  }

  const status = run?.status ?? "running";
  const statusClass =
    status === "ready" || status === "partial"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "fallback"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : status === "error"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={cn("space-y-2 rounded-lg border p-3 text-sm", statusClass)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          {status === "ready" || status === "partial" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <RefreshCw
              className={cn("size-4", status === "running" && "animate-spin")}
            />
          )}
          Discovery {status}
        </span>
        {run && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
            {run.source}
          </span>
        )}
      </div>
      <p className="text-xs leading-5">{message ?? run?.message}</p>
      {run && (
        <div className="grid grid-cols-3 gap-1.5">
          <ProviderChip label="Google" value={run.providerStats.google} />
          <ProviderChip label="Firecrawl" value={run.providerStats.firecrawl} />
          <ProviderChip label="OpenAI" value={run.providerStats.openai} />
        </div>
      )}
    </div>
  );
}

function ProviderChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white/80 px-2 py-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="truncate text-xs font-medium" title={value}>
        {value}
      </div>
    </div>
  );
}

function PlanControls({
  attractionCount,
  canPlan,
  plan,
  planning,
  routingMessage,
  savingPlan,
  onPlan,
  onSave,
}: {
  attractionCount: number;
  canPlan: boolean;
  plan: Plan | null | undefined;
  planning: boolean;
  routingMessage: string | null;
  savingPlan: boolean;
  onPlan: () => void;
  onSave: () => void;
}) {
  const isSaved = plan?.status === "saved";

  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Route className="size-4 text-teal-700" />
              Route Builder
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Chains top-rated sites, inserts meals, and rejects transit legs
              with transfers.
            </div>
          </div>
          {plan && (
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
              {plan.days.length} days
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Sites" value={String(attractionCount)} />
          <Metric
            label="Included"
            value={
              plan
                ? String(
                    plan.days.reduce(
                      (sum, day) =>
                        sum +
                        day.items.filter((item) => item.type === "attraction")
                          .length,
                      0,
                    ),
                  )
                : "-"
            }
          />
          <Metric label="Score" value={plan ? String(plan.score) : "-"} />
        </div>

        <div className={cn("grid gap-2", plan && "grid-cols-2")}>
          <Button
            type="button"
            className="h-10 w-full bg-teal-700 text-white hover:bg-teal-800"
            disabled={!canPlan || planning}
            onClick={onPlan}
          >
            {plan ? (
              <RefreshCw className={cn("size-4", planning && "animate-spin")} />
            ) : (
              <Route className="size-4" />
            )}
            {planning ? "Planning" : plan ? "Plan Again" : "Plan"}
          </Button>

          {plan && (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-10 w-full border-teal-200 bg-white text-teal-900 hover:bg-teal-50",
                isSaved && "border-emerald-200 bg-emerald-50 text-emerald-800",
              )}
              disabled={savingPlan || isSaved}
              onClick={onSave}
            >
              {isSaved ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Building2 className="size-4" />
              )}
              {savingPlan ? "Saving" : isSaved ? "Saved" : "Save"}
            </Button>
          )}
        </div>

        {plan && (
          <p className="text-xs leading-5 text-slate-600">{plan.summary}</p>
        )}

        {routingMessage && (
          <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            <Navigation className="mt-0.5 size-3.5 shrink-0" />
            <span>{routingMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HotelAndSharePanel({
  emails,
  emailMessage,
  emailTo,
  hotelRecommendation,
  plan,
  sendingEmail,
  onEmailToChange,
  onSendEmail,
}: {
  emails: OutboundEmail[];
  emailMessage: string | null;
  emailTo: string;
  hotelRecommendation: HotelRecommendation | null | undefined;
  plan: Plan | null | undefined;
  sendingEmail: boolean;
  onEmailToChange: (value: string) => void;
  onSendEmail: () => void;
}) {
  const isSaved = plan?.status === "saved";

  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardHeader className="space-y-1 p-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Hotel className="size-4 text-teal-700" />
          Stay & Share
        </CardTitle>
        <CardDescription>
          {isSaved
            ? "Hotel area and itinerary email are ready."
            : plan
              ? "Save this route to lock the stay recommendation."
              : "Generate a route before saving."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        {isSaved && hotelRecommendation ? (
          <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Recommended Area
                </div>
                <div className="mt-1 text-base font-semibold text-teal-950">
                  {hotelRecommendation.areaName}
                </div>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-800">
                {hotelRecommendation.score}
              </span>
            </div>
            <p className="text-sm leading-6 text-teal-950">
              {hotelRecommendation.summary}
            </p>
            <div className="space-y-2 text-xs leading-5 text-teal-950">
              <div className="flex gap-2">
                <Building2 className="mt-0.5 size-3.5 shrink-0" />
                <span>{hotelRecommendation.safetyNotes}</span>
              </div>
              <div className="flex gap-2">
                <Train className="mt-0.5 size-3.5 shrink-0" />
                <span>{hotelRecommendation.transportNotes}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hotelRecommendation.nearbyTransitHubs.map((hub) => (
                <span
                  key={hub}
                  className="rounded-full border border-teal-200 bg-white px-2 py-0.5 text-xs font-medium text-teal-900"
                >
                  {hub}
                </span>
              ))}
            </div>
            <a
              href={hotelRecommendation.searchUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100"
            >
              Hotel Search
              <ExternalLink className="size-4" />
            </a>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            {plan
              ? "Save the generated route to create a hotel-area recommendation."
              : "The hotel recommendation uses the first and last stops of each planned day."}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="emailTo" className="flex items-center gap-2">
            <Mail className="size-4 text-[#e85d4f]" />
            Email itinerary
          </Label>
          <div className="flex gap-2">
            <Input
              id="emailTo"
              type="email"
              placeholder="you@example.com"
              value={emailTo}
              onChange={(event) => onEmailToChange(event.target.value)}
            />
            <Button
              type="button"
              className="h-10 bg-[#e85d4f] text-white hover:bg-[#d94f43]"
              disabled={!isSaved || sendingEmail || emailTo.trim().length === 0}
              onClick={onSendEmail}
            >
              <Send className={cn("size-4", sendingEmail && "animate-pulse")} />
              Send
            </Button>
          </div>
          {emailMessage && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
              {emailMessage}
            </div>
          )}
        </div>

        {emails.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Activity
            </div>
            {emails.slice(0, 3).map((email) => (
              <div
                key={email._id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-slate-900">
                    {email.to}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold",
                      email.status === "sent" &&
                        "bg-emerald-50 text-emerald-700",
                      email.status === "skipped" &&
                        "bg-amber-50 text-amber-800",
                      email.status === "error" && "bg-rose-50 text-rose-700",
                      email.status === "queued" && "bg-slate-100 text-slate-700",
                    )}
                  >
                    {email.status}
                  </span>
                </div>
                {email.error && (
                  <div className="mt-1 line-clamp-2 text-slate-500">
                    {email.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function PlanPanel({
  activeDayIndex,
  plan,
  onActiveDayIndexChange,
  onSelectAttraction,
}: {
  activeDayIndex: number;
  plan: Plan | null | undefined;
  onActiveDayIndexChange: (dayIndex: number) => void;
  onSelectAttraction: (attractionId: Id<"attractions">) => void;
}) {
  if (!plan) {
    return (
      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardHeader className="p-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Route className="size-4 text-teal-700" />
            Itinerary
          </CardTitle>
          <CardDescription>
            Rate a few sites, then generate the first route.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const day = plan.days[activeDayIndex] ?? plan.days[0];

  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardHeader className="space-y-3 p-4">
        <div>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <Route className="size-4 text-teal-700" />
              Itinerary
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {plan.plannerVersion}
            </span>
          </CardTitle>
          <CardDescription className="mt-1">{plan.summary}</CardDescription>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {plan.days.map((candidateDay) => (
            <Button
              key={candidateDay._id}
              type="button"
              variant={
                candidateDay.dayIndex === day.dayIndex ? "default" : "outline"
              }
              size="sm"
              className={cn(
                "h-8 shrink-0",
                candidateDay.dayIndex === day.dayIndex &&
                  "bg-teal-700 text-white hover:bg-teal-800",
              )}
              onClick={() => onActiveDayIndexChange(candidateDay.dayIndex)}
            >
              Day {candidateDay.dayIndex + 1}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm leading-6 text-teal-950">
          <div className="font-semibold">{day.date}</div>
          <div>{day.summary}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(routeStyles).map(([mode, style]) => (
            <span
              key={mode}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                style.bg,
                style.text,
              )}
            >
              {style.icon}
              {style.label}
            </span>
          ))}
        </div>

        <div className="space-y-3">
          {day.items.map((item, index) => {
            const previousLeg = index > 0 ? day.legs[index - 1] : null;
            return (
              <div key={item._id} className="space-y-2">
                {previousLeg && <RouteLegRow leg={previousLeg} />}
                <button
                  type="button"
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-teal-300"
                  onClick={() => {
                    if (item.attractionId) {
                      onSelectAttraction(item.attractionId);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {item.type === "attraction" ? (
                          <MapPin className="size-3.5" />
                        ) : (
                          <Utensils className="size-3.5 text-[#e85d4f]" />
                        )}
                        {item.type}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {item.name}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {item.startTime}
                    </div>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-600">
                    {item.notes}
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-500">
                    {item.startTime} to {item.endTime} | {item.durationMinutes} min
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RouteLegRow({ leg }: { leg: RouteLeg }) {
  const style = routeStyles[leg.mode];
  return (
    <div
      className={cn(
        "ml-4 rounded-lg border px-3 py-2 text-xs leading-5",
        style.bg,
        style.text,
      )}
    >
      <div className="flex items-center justify-between gap-2 font-semibold">
        <span className="flex items-center gap-1.5">
          {style.icon}
          {style.label}
        </span>
        <span>{leg.durationMinutes} min</span>
      </div>
      <div className="mt-1">
        {Math.round(leg.distanceMeters / 100) / 10} km
        {leg.transitLineNames.length > 0
          ? ` | ${leg.transitLineNames.join(", ")}`
          : ""}
      </div>
      {leg.fallbackReason && (
        <div className="mt-1 text-slate-600">{leg.fallbackReason}</div>
      )}
    </div>
  );
}

function AttractionList({
  attractions,
  selectedAttractionId,
  onRate,
  onSelect,
}: {
  attractions: Attraction[];
  selectedAttractionId: Id<"attractions"> | null;
  onRate: (attractionId: Id<"attractions">, rating: RatingValue) => void;
  onSelect: (attractionId: Id<"attractions">) => void;
}) {
  return (
    <Card className="min-h-0 flex-1 rounded-lg border-slate-200 shadow-sm">
      <CardHeader className="space-y-1 p-4">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Star className="size-4 text-amber-600" />
            Attractions
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {attractions.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[520px] space-y-2 overflow-auto p-4 pt-0">
        {attractions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Start discovery to load attractions.
          </div>
        ) : (
          attractions.map((attraction) => (
            <div
              key={attraction._id}
              className={cn(
                "rounded-lg border bg-white p-3 transition",
                selectedAttractionId === attraction._id
                  ? "border-teal-300 shadow-sm ring-2 ring-teal-100"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelect(attraction._id)}
              >
                <div className="flex gap-3">
                  <Image
                    src={attraction.photoUrls[0]}
                    alt=""
                    width={64}
                    height={64}
                    className="size-16 shrink-0 rounded-md object-cover"
                    unoptimized
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-950">
                      {attraction.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs font-medium",
                          categoryStyles[attraction.category].chip,
                        )}
                      >
                        {categoryStyles[attraction.category].label}
                      </span>
                      {attraction.requiresTicket && (
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
                          Ticket
                        </span>
                      )}
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                      {attraction.description}
                    </div>
                  </div>
                </div>
              </button>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {ratingOptions.map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      title={`Set rating ${rating}`}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md border transition",
                        attraction.rating >= rating && rating > 0
                          ? "border-amber-300 bg-amber-100 text-amber-700"
                          : rating === 0 && attraction.rating === 0
                            ? "border-slate-400 bg-slate-200 text-slate-700"
                            : "border-slate-200 bg-white text-slate-300 hover:text-amber-500",
                      )}
                      onClick={() => onRate(attraction._id, rating)}
                    >
                      {rating === 0 ? (
                        <span className="text-xs font-semibold">0</span>
                      ) : (
                        <Star className="size-3.5 fill-current" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-500">
                  {attraction.estimatedVisitMinutes} min
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TravelMap({
  activeDayIndex,
  attractions,
  bounds,
  plan,
  selectedAttractionId,
  onSelect,
}: {
  activeDayIndex: number;
  attractions: Attraction[];
  bounds: MapBounds | null;
  plan: Plan | null | undefined;
  selectedAttractionId: Id<"attractions"> | null;
  onSelect: (attractionId: Id<"attractions">) => void;
}) {
  const activeDay = plan?.days[activeDayIndex] ?? plan?.days[0] ?? null;
  const activeAttractionIds = new Set(
    activeDay?.items
      .map((item) => item.attractionId)
      .filter((id): id is Id<"attractions"> => Boolean(id)) ?? [],
  );
  const excludedAttractionIds = new Set(plan?.excludedAttractionIds ?? []);
  const mealItems =
    activeDay?.items.filter(
      (item) => item.type === "lunch" || item.type === "dinner",
    ) ?? [];
  const mapUrl = bounds
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
        `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`,
      )}&layer=mapnik`
    : null;

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden bg-[#dff7f5]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(20,184,166,0.26),transparent_25%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.20),transparent_24%),radial-gradient(circle_at_74%_78%,rgba(249,115,22,0.20),transparent_26%),linear-gradient(135deg,#dff7f5,#f8fafc_55%,#fff1e7)]" />
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(15,23,42,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.09)_1px,transparent_1px)] [background-size:48px_48px]" />
      {mapUrl && (
        <iframe
          title="OpenStreetMap travel area"
          src={mapUrl}
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0 opacity-85"
        />
      )}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
        role="presentation"
      >
        <path
          d="M 40 360 C 220 300 310 180 520 230 S 830 380 1100 260"
          fill="none"
          stroke="#0891b2"
          strokeDasharray="10 12"
          strokeWidth="3"
        />
        <path
          d="M 120 120 C 280 170 340 360 620 330 S 900 220 1040 420"
          fill="none"
          stroke="#0f766e"
          strokeWidth="5"
        />
      </svg>

      {activeDay && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          role="presentation"
          viewBox="0 0 100 100"
        >
          {activeDay.legs.map((leg) => (
            <path
              key={leg._id}
              d={polylinePath(leg.polyline, bounds)}
              fill="none"
              stroke={routeStyles[leg.mode].stroke}
              strokeDasharray={leg.mode === "walk" ? "6 8" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={leg.mode === "transit" ? 6 : 5}
              opacity={0.95}
            />
          ))}
        </svg>
      )}

      <div className="absolute left-4 top-4 rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {activeDay ? `Day ${activeDay.dayIndex + 1} Route` : "Discovery Map"}
        </div>
        <div className="mt-1 text-lg font-semibold text-slate-950">
          {activeDay
            ? activeDay.date
            : attractions.length > 0
              ? "Tokyo candidate sites"
              : "No trip loaded"}
        </div>
      </div>

      {attractions.map((attraction) => {
        const position = getMapPosition(attraction, bounds);
        const isSelected = selectedAttractionId === attraction._id;
        const isExcluded = excludedAttractionIds.has(attraction._id);
        const isIncludedToday = activeAttractionIds.has(attraction._id);
        return (
          <button
            key={attraction._id}
            type="button"
            title={attraction.name}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-lg transition",
              isSelected || isIncludedToday
                ? "size-10 scale-110"
                : "size-8 hover:scale-110",
              isExcluded || attraction.rating === 0
                ? "bg-slate-400"
                : categoryStyles[attraction.category].pin,
              isExcluded && "opacity-60 grayscale",
            )}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            onClick={() => onSelect(attraction._id)}
          >
            <MapPin className="size-4 text-white" />
            <span className="sr-only">{attraction.name}</span>
          </button>
        );
      })}

      {mealItems.map((item) => {
        const position = getMapPosition(item, bounds);
        return (
          <div
            key={item._id}
            title={item.name}
            className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border-2 border-white bg-[#e85d4f] text-white shadow-lg"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            <Utensils className="size-4" />
          </div>
        );
      })}

      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm backdrop-blur">
        {activeDay &&
          Object.entries(routeStyles).map(([mode, style]) => (
            <div
              key={mode}
              className="flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
            >
              <span
                className="h-1.5 w-6 rounded-full"
                style={{ background: style.stroke }}
              />
              {style.label}
            </div>
          ))}
        {Object.entries(categoryStyles).map(([category, style]) => (
          <div
            key={category}
            className="flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
          >
            <span className={cn("size-2.5 rounded-full", style.pin)} />
            {style.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function AttractionDetails({ attraction }: { attraction: Attraction | null }) {
  if (!attraction) {
    return (
      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Site Details</CardTitle>
          <CardDescription>Select a site from the map or list.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-lg border-slate-200 shadow-sm">
      <div className="relative h-52 bg-slate-200">
        <Image
          src={attraction.photoUrls[0]}
          alt=""
          fill
          sizes="360px"
          className="h-full w-full object-cover"
          unoptimized
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              categoryStyles[attraction.category].chip,
            )}
          >
            {categoryStyles[attraction.category].label}
          </span>
          {attraction.requiresTicket && (
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
              Ticket needed
            </span>
          )}
        </div>
      </div>
      <CardHeader className="space-y-2 p-4">
        <CardTitle className="text-xl leading-tight">{attraction.name}</CardTitle>
        <CardDescription>{attraction.address}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <p className="text-sm leading-6 text-slate-700">
          {attraction.description}
        </p>
        <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm leading-6 text-teal-950">
          {attraction.practicalNotes}
        </p>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Fact
            icon={<Clock className="size-4" />}
            label="Hours"
            value={attraction.openingHoursSummary}
          />
          <Fact
            icon={<Sparkles className="size-4" />}
            label="Cost"
            value={attraction.costSummary}
          />
          <Fact
            icon={<CalendarDays className="size-4" />}
            label="Visit"
            value={`${attraction.estimatedVisitMinutes} min`}
          />
          <Fact
            icon={<Star className="size-4" />}
            label="Rating"
            value={`${attraction.rating}/4`}
          />
        </div>

        <div className="space-y-2">
          {attraction.ticketUrl && (
            <a
              href={attraction.ticketUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100"
            >
              Ticket Site
              <ExternalLink className="size-4" />
            </a>
          )}
          {attraction.officialUrl && (
            <a
              href={attraction.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Official Site
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Utensils className="size-4 text-[#e85d4f]" />
            Nearby meals
          </div>
          <div className="text-xs leading-5 text-slate-500">
            Restaurant candidates are already stored for the trip.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-medium leading-5 text-slate-900">
        {value}
      </div>
    </div>
  );
}

function polylinePath(
  points: Array<{ lat: number; lng: number }>,
  bounds: MapBounds | null,
) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const position = getMapPosition({ ...point, name: "" }, bounds);
      const command = index === 0 ? "M" : "L";
      return `${command} ${position.x} ${position.y}`;
    })
    .join(" ");
}

function getMapPosition(point: MapPoint, bounds: MapBounds | null) {
  if (!bounds) {
    return { x: 50, y: 50 };
  }

  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.001);
  const x = 12 + ((point.lng - bounds.minLng) / lngSpan) * 76;
  const y = 12 + ((bounds.maxLat - point.lat) / latSpan) * 76;

  return { x, y };
}
