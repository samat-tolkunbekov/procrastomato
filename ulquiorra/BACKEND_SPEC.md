# Ulquiorra — Procrastomato sync backend spec

This is the spec for the backend half of Procrastomato's multi-device sync.
It's meant to be handed to a fresh Claude session (or read cold by a human)
without needing the conversation that produced it — everything the backend
needs to know is below.

## Context

Procrastomato is a Chrome extension Pomodoro timer (see the main repo's
`CLAUDE.md`). Its owner runs it on multiple machines under **different
Google accounts** (work vs. personal), so `chrome.storage.sync` — which is
scoped to whichever Google account is signed into Chrome — can't bridge
between them. The extension side has already been built (see `src/sync.js`
in the repo root) around a **sync key, not a login**: a random token
generated on one device and pasted into another, sent as a bearer
credential over HTTPS. This backend's whole job is to be a versioned blob
store keyed by that token — no accounts, no passwords, no OAuth.

**All merge logic already lives in the extension** (`mergeStates` in
`src/sync.js`). The backend does not need to understand sessions, pauses,
or any Procrastomato-specific semantics — it just stores whatever JSON blob
it's given, versioned, per token. Keep it that dumb; resist the urge to add
business logic here.

## Data being stored

The extension sends an opaque JSON object shaped like this (see the main
repo's `CLAUDE.md` for the authoritative, evolving shape — treat this as
illustrative, not a schema to validate against):

```js
{
  sessions: [
    {
      id: "uuid",
      title: "string",
      description: "string",
      plannedDurationMinutes: 25,
      status: "active" | "paused" | "completed" | "stopped" | "manual",
      startTime: "ISO string",
      endTime: "ISO string" | null,
      pauses: [{ pausedAt: "ISO", resumedAt: "ISO" | null }],
      updatedAt: "ISO string",       // last-write-wins merge key
      deletedAt: "ISO string" | null // tombstone — deletions never hard-remove
    }
  ],
  activeSessionId: "uuid" | null,
  settings: { defaultDurationMinutes: 25 }
}
```

The backend should treat this whole object as opaque and just round-trip
it — don't parse into it, don't validate its internal shape beyond "is it
JSON." The extension will evolve this shape over time without needing a
backend change, as long as the backend stays opaque.

## Auth model

- Bearer token in the `Authorization` header: `Authorization: Bearer <token>`.
- Token is minted **client-side** (`crypto.randomUUID()`), never issued by
  this backend.
- No registration endpoint — the first `PUT` from a token the backend
  hasn't seen before implicitly creates its bucket.
- Token is a bare capability: anyone holding it can read/write that
  bucket. That's an accepted tradeoff for a two-device personal tool. The
  extension has a "regenerate code" action that invalidates the old token
  by simply abandoning it (its bucket becomes orphaned) — the backend
  doesn't need to do anything special to support that, a new token just
  starts a new bucket.

## API contract

### `GET /sync/state`

Headers: `Authorization: Bearer <token>`

Response `200`:
```json
{ "state": { /* ... */ } | null, "version": 0 }
```
- `state: null, version: 0` for a token that's never been seen (nothing to
  return yet — the extension treats this as an empty starting state).

### `PUT /sync/state`

Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`

Body:
```json
{ "state": { /* ... */ }, "version": 0 }
```
- `version` is the version the client last saw (optimistic concurrency).

Response `200` (write accepted):
```json
{ "version": 1 }
```
- New version is the old version + 1. Store `(state, version)` per token.

Response `409` (conflict): the client's `version` doesn't match what's
currently stored for that token — someone else (the other device) wrote in
between. No body required; the extension re-pulls, re-merges, and retries
once on its own.

That's the entire contract — two endpoints, no others needed for v1.

## Security requirements

- **HTTPS only.** Reject or don't listen on plain HTTP.
- Token goes in the `Authorization` header only — never accept it as a
  query param (keeps it out of access logs / browser history / referrers).
- Rate-limit per token to something generous but bounded (this is a
  personal tool syncing on user action, not a high-frequency workload —
  a handful of requests per minute per token is more than enough headroom).
- No PII is stored beyond whatever the user types into session
  titles/descriptions — treat the whole blob as sensitive by default
  anyway (don't log request bodies).

## Hosting

Not decided — this is a separate project/session and can pick whatever's
lowest-ops. Given the shape of the workload (tiny payloads, infrequent
writes, one blob per token), something like a Cloudflare Worker + KV (or
Durable Object if `409` conflict detection needs to be atomic under
concurrent writes) is a reasonable default suggestion, not a requirement.
A single small server with any key-value store works just as well.
