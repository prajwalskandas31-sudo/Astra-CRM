/**
 * Server sync for the CRM's shared data (leads, sales, assignments, settings, ...).
 *
 * Screens keep working with plain React state; this hook keeps that state equal to the server's
 * copy so every user sees the same data:
 *  - pull: every few seconds, ask /api/sync what changed since the last cursor and merge it in
 *  - push: shortly after the state changes, send only the records that differ from the last
 *    server-confirmed version (and the ids that disappeared, as deletes)
 * The server decides per record who may see and change what; anything it rejects is reverted by
 * re-downloading the collection.
 */
import { useEffect, useRef } from 'react';
import { API_BASE_URL } from './backendConfig';

const POLL_MS = 5000;
const HIDDEN_POLL_MS = 30000;
const FULL_RESYNC_MS = 10 * 60 * 1000;
const PUSH_DEBOUNCE_MS = 600;
const PUSH_CHUNK = 2000;            // records per request (the server accepts up to 5000)
const PUSH_CHUNK_CHARS = 8_000_000;  // and roughly this much JSON (nginx accepts 25 MB)

// JSON of each record object, cached by identity: React state keeps unchanged records as the same
// objects, so a change to one lead only re-serializes that lead.
const jsonCache = new WeakMap();
const toJson = (doc) => {
  if (doc && typeof doc === 'object') {
    let json = jsonCache.get(doc);
    if (json === undefined) {
      json = JSON.stringify(doc);
      jsonCache.set(doc, json);
    }
    return json;
  }
  return JSON.stringify(doc);
};

/** State value -> {id: doc} as stored on the server. */
const toDocs = (spec, value) => {
  const docs = new Map();
  if (spec.kind === 'map') {
    Object.entries(value || {}).forEach(([key, v]) => docs.set(key, { id: key, value: v }));
  } else {
    (value || []).forEach(item => {
      if (!item || typeof item !== 'object') return;
      const id = item.id ?? (spec.key ? spec.key(item) : undefined);
      if (typeof id !== 'string' || !id) return;
      docs.set(id, item.id === id ? item : { ...item, id });
    });
  }
  return docs;
};

// The server's data epoch changes when its data is reset (backend/reset_data.py). This browser's cached
// records predate a new epoch, so they are replaced by the server's copy, never uploaded to it.
const EPOCH_KEY = 'crm_data_epoch';
const storedEpoch = () => { try { return localStorage.getItem(EPOCH_KEY); } catch { return null; } };
const isNewEpoch = (epoch) => !!epoch && storedEpoch() !== epoch;
const saveEpoch = (epoch) => { try { if (epoch) localStorage.setItem(EPOCH_KEY, epoch); } catch { /* cache only */ } };

const fromDocs = (spec, docs) => {
  if (spec.kind === 'map') {
    const obj = {};
    docs.forEach(d => { obj[d.id] = d.value; });
    return obj;
  }
  return docs;
};

/**
 * @param collections {name: {value, setValue, kind: 'list'|'map', key?, canWrite: bool,
 *                     keepWhenServerEmpty?: bool, importLocal?: bool, defaultIds?: Set, defaults?: object}}
 *   keepWhenServerEmpty: config with built-in defaults; kept (and published by a Super Admin) until the server has some
 *   importLocal: on a brand-new server, the Super Admin's browser uploads the records it held locally
 *   defaultIds: demo records that are never uploaded; defaults (maps): values for keys the server lacks
 * @param options {enabled, token, isSuperAdmin, onRejected(name, rejections)}
 */
export const useServerSync = (collections, { enabled, token, isSuperAdmin, onRejected }) => {
  const specsRef = useRef(collections);
  specsRef.current = collections;
  const optsRef = useRef({ token, isSuperAdmin, onRejected });
  optsRef.current = { token, isSuperAdmin, onRejected };

  const state = useRef({ cursor: 0, baselines: {}, ready: false, pushing: false, pushAgain: false, pulling: false });
  const pushTimer = useRef(null);
  const names = Object.keys(collections);
  const namesKey = names.join(',');

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${optsRef.current.token}` });

  const applyPull = (body) => {
    const s = state.current;
    const resetOnServer = isNewEpoch(body.epoch);
    names.forEach(name => {
      const spec = specsRef.current[name];
      const change = body.collections?.[name];
      if (!change) return;
      const baseline = s.baselines[name] || (s.baselines[name] = new Map());

      if (body.full) {
        const serverDocs = change.items || [];
        if (serverDocs.length === 0 && spec.keepWhenServerEmpty) {
          // Nothing shared yet: keep this browser's defaults; a Super Admin publishes them below
          baseline.clear();
          return;
        }
        if (serverDocs.length === 0 && spec.importLocal && optsRef.current.isSuperAdmin && !resetOnServer) {
          // First start on the server: the Super Admin's browser uploads what it held locally
          baseline.clear();
          if (spec.defaultIds) {
            spec.setValue(prev => (Array.isArray(prev) ? prev.filter(i => !spec.defaultIds.has(i?.id)) : prev));
          }
          return;
        }
        baseline.clear();
        serverDocs.forEach(d => baseline.set(d.id, toJson(d)));
        const value = fromDocs(spec, serverDocs);
        spec.setValue(spec.kind === 'map' && spec.defaults ? { ...spec.defaults, ...value } : value);
        return;
      }

      const items = change.items || [];
      const deleted = new Set(change.deleted || []);
      if (!items.length && !deleted.size) return;
      spec.setValue(prev => {
        const local = toDocs(spec, prev);
        const incoming = new Map();
        items.forEach(d => {
          const mine = local.get(d.id);
          // Edited here and not yet pushed: keep ours, it is sent next and wins
          const unpushed = mine && toJson(mine) !== baseline.get(d.id);
          baseline.set(d.id, toJson(d));
          if (!unpushed) incoming.set(d.id, d);
        });
        deleted.forEach(id => baseline.delete(id));
        if (spec.kind === 'map') {
          const next = { ...(prev || {}) };
          deleted.forEach(id => { delete next[id]; });
          incoming.forEach(d => { next[d.id] = d.value; });
          return next;
        }
        const list = Array.isArray(prev) ? prev : [];
        const kept = list
          .filter(item => !deleted.has(item?.id ?? (spec.key ? spec.key(item) : undefined)))
          .map(item => {
            const id = item?.id ?? (spec.key ? spec.key(item) : undefined);
            const replacement = incoming.get(id);
            if (replacement) incoming.delete(id);
            return replacement || item;
          });
        return [...incoming.values(), ...kept];  // new records first, like the screens add them
      });
    });
    s.cursor = body.cursor;
    if (body.full) saveEpoch(body.epoch);
  };

  const pull = async (full = false) => {
    const s = state.current;
    if (s.pulling) return;
    s.pulling = true;
    try {
      const since = full ? 0 : s.cursor;
      const res = await fetch(`${API_BASE_URL}/sync?collections=${encodeURIComponent(namesKey)}&since=${since}`, { headers: headers() });
      if (!res.ok) return;
      const body = await res.json();
      if (!body.full && isNewEpoch(body.epoch)) {
        // Reset while this tab was open: reload everything from the server before pushing anything
        s.needFull = true;
        return;
      }
      applyPull(body);
      if (full && !s.ready) {
        s.ready = true;
        schedulePush(0);  // publish anything the first pull decided to keep (imports, defaults)
      }
    } catch {
      // offline: try again on the next tick
    } finally {
      s.pulling = false;
    }
  };

  const push = async () => {
    const s = state.current;
    if (!s.ready || s.needFull) return;
    if (s.pushing) { s.pushAgain = true; return; }
    const pending = [];  // [name, doc|null, id]
    names.forEach(name => {
      const spec = specsRef.current[name];
      if (!spec.canWrite) return;
      if (spec.keepWhenServerEmpty && !optsRef.current.isSuperAdmin && !(s.baselines[name]?.size)) return;
      const baseline = s.baselines[name] || (s.baselines[name] = new Map());
      const docs = toDocs(spec, spec.value);
      docs.forEach((doc, id) => {
        if (spec.defaultIds?.has(id) && !baseline.has(id)) return;  // demo data stays in this browser
        if (toJson(doc) !== baseline.get(id)) pending.push([name, doc, id]);
      });
      baseline.forEach((_, id) => { if (!docs.has(id)) pending.push([name, null, id]); });
    });
    if (!pending.length) return;

    s.pushing = true;
    let rejectedAny = false;
    try {
      const chunks = [];
      let current = [], size = 0;
      pending.forEach(entry => {
        const entrySize = entry[1] ? toJson(entry[1]).length : 50;
        if (current.length && (current.length >= PUSH_CHUNK || size + entrySize > PUSH_CHUNK_CHARS)) {
          chunks.push(current);
          current = []; size = 0;
        }
        current.push(entry);
        size += entrySize;
      });
      if (current.length) chunks.push(current);
      for (const chunk of chunks) {
        const payload = {};
        chunk.forEach(([name, doc, id]) => {
          const c = payload[name] || (payload[name] = { upserts: [], deletes: [] });
          if (doc) c.upserts.push(doc); else c.deletes.push(id);
        });
        const res = await fetch(`${API_BASE_URL}/sync`, { method: 'POST', headers: headers(), body: JSON.stringify({ collections: payload }) });
        if (!res.ok) { console.warn('CRM sync: push failed', res.status); break; }
        const body = await res.json();
        chunk.forEach(([name, doc, id]) => {
          if (!(body.saved?.[name] || []).includes(id)) return;
          const baseline = s.baselines[name];
          if (doc) baseline.set(id, toJson(doc)); else baseline.delete(id);
        });
        Object.entries(body.rejected || {}).forEach(([name, list]) => {
          if (list.length) {
            rejectedAny = true;
            console.warn(`CRM sync: ${list.length} ${name} change(s) refused by the server:`, list[0]?.reason);
            optsRef.current.onRejected?.(name, list);
          }
        });
      }
    } catch {
      // offline: the diff is recomputed and retried on the next change or tick
    } finally {
      s.pushing = false;
    }
    if (rejectedAny) await pull(true);  // put back the server's version of what was refused
    if (s.pushAgain) { s.pushAgain = false; schedulePush(); }
  };

  const schedulePush = (delay = PUSH_DEBOUNCE_MS) => {
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(push, delay);
  };

  // Start, poll, and periodically re-download everything (picks up team changes)
  useEffect(() => {
    if (!enabled || !token) return undefined;
    state.current = { cursor: 0, baselines: {}, ready: false, pushing: false, pushAgain: false, pulling: false };
    pull(true);
    let lastFull = Date.now();
    let timer;
    const tick = async () => {
      if (state.current.needFull) {
        state.current.needFull = false;
        lastFull = Date.now();
        await pull(true);
      } else if (state.current.ready) {
        await push();
        if (Date.now() - lastFull > FULL_RESYNC_MS) { lastFull = Date.now(); await pull(true); }
        else await pull(false);
      } else {
        await pull(true);
      }
      timer = setTimeout(tick, document.hidden ? HIDDEN_POLL_MS : POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    const onVisible = () => { if (!document.hidden) pull(false); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      clearTimeout(pushTimer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, token, namesKey]);

  // Push shortly after any synced state changes
  const values = names.map(n => collections[n].value);
  useEffect(() => {
    if (enabled && token && state.current.ready) schedulePush();
  }, [enabled, token, ...values]);  // eslint-disable-line react-hooks/exhaustive-deps
};
