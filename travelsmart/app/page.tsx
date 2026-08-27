"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
// Shadcn primitives are pre-installed by the bootstrap script. Use them
// in any UI you write — DO NOT roll new inline-styled inputs/buttons.
// Build new features by composing these (and other shadcn components you
// can add with `npx shadcn@latest add <name>`) instead of writing
// style={{}} props. The bootstrap audit showed 0/7 agents reaching for
// shadcn when the wow shell used inline styles, so the page now imports
// them up-front to set the right idiom.
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 20px" }}>
      {/* Title + the user's prompt verbatim + Haiku's one-sentence read
          of who it's for. Compact: no separate "the agent thinks you're
          building this for" hedge, no extra paragraph — just the facts. */}
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>
          TravelSmart
        </h1>
        <blockquote
          style={{
            borderLeft: "3px solid #fdba74",
            paddingLeft: 14,
            margin: "12px 0 0",
            color: "#374151",
            fontSize: 15,
            fontStyle: "italic",
          }}
        >
          “TravelSmart, a map-first Convex travel itinerary planner where users enter a destination, dates, rental car availability, and meal preferences, discover attractions, rate them, generate route-aware multi-day plans with meals and transport, save plans, email them, and get hotel area recommendations”
        </blockquote>
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "#6b7280",
            lineHeight: 1.5,
          }}
        >
          Built for <strong style={{ color: "#374151" }}>Independent travelers and families planning multi-day road trips who want AI-optimized itineraries that combine attractions, meals, and logistics in one map view</strong>.
          Starting with <strong style={{ color: "#374151" }}>Build the map-first itinerary display with route-aware day-by-day plans that integrate attractions, meals, and transport in a single scrollable timeline view</strong>.
        </p>
      </header>

      {/* "What you're looking at" — promoted ABOVE the placeholders so
          the user reads the explanation before they wonder why three
          cards are spinning. */}
      <aside
        style={{
          padding: 14,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          fontSize: 13,
          color: "#4b5563",
          lineHeight: 1.55,
          marginBottom: 24,
        }}
      >
        <strong style={{ color: "#111827" }}>What you're looking at.</strong>{" "}
        This page is live and reactive — Convex pushes data over a
        websocket, so anything the agent writes shows up here within a
        second. The spinners below will each be replaced by a real
        feature as the agent finishes it. The Chef bubble in the lower
        right is your one channel into the build loop: ask for new
        features there, and answer Chef's questions when they appear.
        Brief red error flashes during builds are normal — they show up
        for a few seconds while Chef is mid-edit, then the page
        recovers on its own.
      </aside>

      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#6b7280",
            margin: "0 0 12px",
          }}
        >
          In flight right now
        </h2>
        <div style={{ display: "grid", gap: 12 }}>
          <Placeholder label="Route-optimized itinerary" hint="Setting up schema, query, and UI." />
          <Placeholder label="Attraction ratings & discovery" hint="Wiring mutation + reactive list." />
          <Placeholder label="Hotel area recommendations" hint="Visual polish for the first demo." />
        </div>
      </section>

      {/* The floating Chef panel (lower-right) is mounted in
          app/layout.tsx, NOT here. Don't add it inline — it survives
          across page rewrites that way. */}
    </main>
  );
}

function Placeholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fafafa",
      }}
    >
      <Spinner />
      <div>
        <div style={{ fontWeight: 600, color: "#111827" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
          {hint}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      aria-label="Loading"
      style={{
        width: 18,
        height: 18,
        border: "2px solid #e5e7eb",
        borderTopColor: "#111",
        borderRadius: "50%",
        animation: "fr-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes fr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

