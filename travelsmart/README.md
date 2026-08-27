# TravelSmart App

This is the Next.js, shadcn/ui, and Convex app for TravelSmart.

## Run

```bash
npm install
npm run dev
```

The current local quickstart server is available at `http://localhost:50665`.

## Convex Env

Copy `.env.example` for local frontend values, then set Convex action secrets
with `npx convex env set`:

```bash
npx convex env set GOOGLE_MAPS_API_KEY your-key
npx convex env set FIRECRAWL_API_KEY your-key
npx convex env set OPENAI_API_KEY your-key
npx convex env set AGENTMAIL_API_KEY your-key
npx convex env set AGENTMAIL_INBOX_ID your-inbox-id
```

`OPENAI_MODEL` is optional and defaults to `gpt-5-mini` in the discovery action.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

Lint currently reports only known image optimization warnings from `<img>` usage
and the starter `app/error.tsx` unused `_error` warning.
