"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  Car,
  Clock,
  ExternalLink,
  MapPin,
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

const ratingOptions = [0, 1, 2, 3, 4] as const;

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
  const [sessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    let storedSessionId = window.localStorage.getItem(
      "travelsmart.sessionId",
    );
    if (!storedSessionId) {
      storedSessionId = window.crypto.randomUUID();
      window.localStorage.setItem("travelsmart.sessionId", storedSessionId);
    }
    return storedSessionId;
  });
  const [activeTripId, setActiveTripId] = useState<Id<"trips"> | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const storedTripId = window.localStorage.getItem("travelsmart.activeTripId");
    return storedTripId ? (storedTripId as Id<"trips">) : null;
  });
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

  const createDemoTrip = useMutation(api.trips.createDemoTrip);
  const setRating = useMutation(api.trips.setRating);

  const trips = useQuery(
    api.trips.listTrips,
    sessionId ? { sessionId } : "skip",
  );
  const workspace = useQuery(
    api.trips.getTripWorkspace,
    sessionId && activeTripId ? { sessionId, tripId: activeTripId } : "skip",
  );

  const attractions = useMemo(() => workspace?.attractions ?? [], [workspace]);
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
    if (attractions.length === 0) {
      return null;
    }
    return {
      minLat: Math.min(...attractions.map((attraction) => attraction.lat)),
      maxLat: Math.max(...attractions.map((attraction) => attraction.lat)),
      minLng: Math.min(...attractions.map((attraction) => attraction.lng)),
      maxLng: Math.max(...attractions.map((attraction) => attraction.lng)),
    };
  }, [attractions]);

  async function createTrip() {
    if (!sessionId || creating) {
      return;
    }

    setCreating(true);
    try {
      const tripId = await createDemoTrip({
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
              Phase 1
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[380px_minmax(0,1fr)_360px] lg:p-5">
          <aside className="flex min-h-0 flex-col gap-4">
            <TripSetupPanel
              activeTripId={activeTripId}
              creating={creating}
              destinationName={destinationName}
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
              }}
              onStartDateChange={setStartDate}
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
              selectedAttractionId={selectedAttraction?._id ?? null}
              onSelect={setSelectedAttractionId}
            />
          </section>

          <aside className="min-h-0">
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
        <CardDescription>Tokyo sample data is wired through Convex.</CardDescription>
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
          <Sparkles className="size-4" />
          {creating ? "Creating" : "Start Discovery"}
        </Button>

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
                  <img
                    src={attraction.photoUrls[0]}
                    alt=""
                    className="size-16 shrink-0 rounded-md object-cover"
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
  attractions,
  bounds,
  selectedAttractionId,
  onSelect,
}: {
  attractions: Attraction[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null;
  selectedAttractionId: Id<"attractions"> | null;
  onSelect: (attractionId: Id<"attractions">) => void;
}) {
  return (
    <div className="relative h-full min-h-[520px] overflow-hidden bg-[#dff7f5]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(20,184,166,0.26),transparent_25%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.20),transparent_24%),radial-gradient(circle_at_74%_78%,rgba(249,115,22,0.20),transparent_26%),linear-gradient(135deg,#dff7f5,#f8fafc_55%,#fff1e7)]" />
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(15,23,42,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.09)_1px,transparent_1px)] [background-size:48px_48px]" />
      <svg
        className="absolute inset-0 h-full w-full opacity-70"
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

      <div className="absolute left-4 top-4 rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Discovery Map
        </div>
        <div className="mt-1 text-lg font-semibold text-slate-950">
          {attractions.length > 0 ? "Tokyo candidate sites" : "No trip loaded"}
        </div>
      </div>

      {attractions.map((attraction) => {
        const position = getMapPosition(attraction, bounds);
        const isSelected = selectedAttractionId === attraction._id;
        return (
          <button
            key={attraction._id}
            type="button"
            title={attraction.name}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-lg transition",
              isSelected ? "size-10 scale-110" : "size-8 hover:scale-110",
              attraction.rating === 0
                ? "bg-slate-400"
                : categoryStyles[attraction.category].pin,
            )}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            onClick={() => onSelect(attraction._id)}
          >
            <MapPin className="size-4 text-white" />
            <span className="sr-only">{attraction.name}</span>
          </button>
        );
      })}

      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm backdrop-blur">
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
        <img
          src={attraction.photoUrls[0]}
          alt=""
          className="h-full w-full object-cover"
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

function getMapPosition(
  attraction: Attraction,
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null,
) {
  if (!bounds) {
    return { x: 50, y: 50 };
  }

  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.001);
  const x = 12 + ((attraction.lng - bounds.minLng) / lngSpan) * 76;
  const y = 12 + ((bounds.maxLat - attraction.lat) / latSpan) * 76;

  return { x, y };
}
