// Multi-device sync client. Pairs two extension installs via a shared
// bearer token against a small backend that stores one versioned state
// blob per token (see ulquiorra/BACKEND_SPEC.md for the backend contract).
// All merge logic lives here — the backend is a dumb versioned store.
//
// Kept separate from storage.js so local writes always succeed first and
// are never blocked on the network; sync is best-effort on top, matching
// the rest of this extension's "local state is truth" design.

import { generateId, getState, overwriteState } from "./storage.js";

const CONFIG_KEY = "procrastomatoSyncConfig";

const DEFAULT_CONFIG = {
  enabled: false,
  token: null,
  baseUrl: null,
  remoteVersion: 0,
  lastSyncedAt: null,
};

export async function getSyncConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...(result[CONFIG_KEY] || {}) };
}

async function saveSyncConfig(config) {
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
  return config;
}

export function generateSyncToken() {
  return generateId();
}

// Requests the host permission for baseUrl before storing it. The manifest
// only declares optional_host_permissions (the backend host isn't known
// up front), so fetch() to a user-supplied server needs this grant first.
export async function enableSync({ baseUrl, token }) {
  const normalizedUrl = baseUrl.replace(/\/+$/, "");
  const origin = new URL(normalizedUrl).origin + "/*";
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    throw new Error("Permission to reach that server was denied.");
  }
  return saveSyncConfig({
    ...DEFAULT_CONFIG,
    enabled: true,
    baseUrl: normalizedUrl,
    token,
    remoteVersion: 0,
    lastSyncedAt: null,
  });
}

// New token invalidates the old pairing — the other device needs to be
// re-linked with the new code.
export async function regenerateToken() {
  const config = await getSyncConfig();
  return saveSyncConfig({
    ...config,
    token: generateSyncToken(),
    remoteVersion: 0,
    lastSyncedAt: null,
  });
}

// Keeps token/baseUrl so re-enabling doesn't require re-pairing.
export async function disableSync() {
  const config = await getSyncConfig();
  return saveSyncConfig({ ...config, enabled: false });
}

// ---------- Merge ----------

// Union of sessions by id; where both sides have the same id, keep
// whichever copy has the newer updatedAt (a missing updatedAt — records
// that predate this field — sorts as oldest). Deletes are tombstones
// (deletedAt set, see storage.js), so they merge like any other edit
// rather than needing special-casing.
//
// activeSessionId: if both sides agree (same id or both null), keep it. If
// they disagree and both are non-null — two machines independently started
// a session while offline, a rare edge case — keep whichever session has
// the later startTime as active and force the other to "stopped" so
// history doesn't end up showing two active pills.
//
// settings has no edit UI yet (nothing can change it), so it can't
// actually diverge between machines — local settings pass through as-is.
export function mergeStates(local, remote) {
  const byId = new Map();
  for (const session of remote.sessions) byId.set(session.id, session);
  for (const session of local.sessions) {
    const existing = byId.get(session.id);
    if (!existing || (session.updatedAt || "") > (existing.updatedAt || "")) {
      byId.set(session.id, session);
    }
  }

  let activeSessionId = local.activeSessionId;
  if (local.activeSessionId !== remote.activeSessionId) {
    if (local.activeSessionId && remote.activeSessionId) {
      const localActive = byId.get(local.activeSessionId);
      const remoteActive = byId.get(remote.activeSessionId);
      const localWins =
        !remoteActive || (localActive && localActive.startTime > remoteActive.startTime);
      activeSessionId = localWins ? local.activeSessionId : remote.activeSessionId;
      const loserId = localWins ? remote.activeSessionId : local.activeSessionId;
      const loser = byId.get(loserId);
      if (loser && loser.status !== "stopped") {
        byId.set(loserId, {
          ...loser,
          status: "stopped",
          endTime: loser.endTime || loser.updatedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      activeSessionId = local.activeSessionId || remote.activeSessionId;
    }
  }

  return {
    sessions: Array.from(byId.values()).sort((a, b) => (a.startTime < b.startTime ? 1 : -1)),
    activeSessionId,
    settings: local.settings,
  };
}

function fingerprint(state) {
  return JSON.stringify({
    activeSessionId: state.activeSessionId,
    sessions: [...state.sessions]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((s) => [s.id, s.updatedAt || "", s.status, s.deletedAt || null]),
  });
}

// ---------- Network ----------

async function pullState(config) {
  const res = await fetch(`${config.baseUrl}/sync/state`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
  return res.json(); // { state: {...} | null, version }
}

async function pushState(config, state, expectedVersion) {
  const res = await fetch(`${config.baseUrl}/sync/state`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ state, version: expectedVersion }),
  });
  if (res.status === 409) return { conflict: true };
  if (!res.ok) throw new Error(`Push failed: ${res.status}`);
  const body = await res.json(); // { version }
  return { conflict: false, version: body.version };
}

// Pulls remote, merges with local, writes the merge back locally if it
// changed anything, and pushes if the merge diverged from what the server
// had (single retry on a 409 version conflict). Best-effort: any network
// failure — offline, no backend deployed yet — is swallowed; the UI just
// won't advance "last synced" until the next trigger succeeds.
export async function runSync() {
  const config = await getSyncConfig();
  if (!config.enabled || !config.baseUrl || !config.token) return;

  let remote;
  try {
    remote = await pullState(config);
  } catch {
    return;
  }
  if (typeof remote.version !== "number") return;

  const local = await getState();
  const remoteState = remote.state || {
    sessions: [],
    activeSessionId: null,
    settings: local.settings,
  };
  const merged = mergeStates(local, remoteState);

  if (fingerprint(merged) !== fingerprint(local)) {
    await overwriteState(merged);
  }

  if (fingerprint(merged) === fingerprint(remoteState)) {
    await saveSyncConfig({
      ...config,
      remoteVersion: remote.version,
      lastSyncedAt: new Date().toISOString(),
    });
    return;
  }

  try {
    let result = await pushState(config, merged, remote.version);
    if (result.conflict) {
      const fresh = await pullState(config);
      const reMerged = mergeStates(merged, fresh.state || remoteState);
      if (fingerprint(reMerged) !== fingerprint(merged)) await overwriteState(reMerged);
      result = await pushState(config, reMerged, fresh.version);
    }
    if (!result.conflict) {
      await saveSyncConfig({
        ...config,
        remoteVersion: result.version,
        lastSyncedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Offline or server unreachable — local state is already saved above,
    // next trigger (popup open, next mutation) will retry the push.
  }
}
