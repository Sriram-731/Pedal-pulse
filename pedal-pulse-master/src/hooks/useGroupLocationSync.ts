/**
 * useGroupLocationSync - Live location sharing tied to group ride lifecycle
 *
 * FLOW:
 *   START RIDE (with group) → isRiding=true → sharing begins, polls others
 *   STOP/EXIT RIDE          → isRiding=false → stops sharing, deletes own row
 *
 * ACTIVE LOGIC:
 *   If a rider's row EXISTS in the locations table → they are riding (active)
 *   When they stop riding → row is DELETED → they disappear from the map
 *   No timestamp-based detection needed.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/useAuthStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LocationRow {
  user_id: string;
  group_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export interface RiderLocation {
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface LocationSyncState {
  /** All riders currently in this group ride (row exists = active) */
  riders: RiderLocation[];
  isTracking: boolean;
  isConnected: boolean;
  error: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SEND_INTERVAL_MS = 3_000; // 3 seconds between own broadcasts
const POLL_INTERVAL_MS = 3_000; // 3 seconds between polls

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * @param groupId  - The ride group (null = disabled)
 * @param isRiding - true = ride active, start sharing. false = stop, delete row.
 */
export function useGroupLocationSync(
  groupId: string | null,
  isRiding: boolean = false
): LocationSyncState {
  const user = useAuthStore((s) => s.user);

  const [ridersMap, setRidersMap] = useState<Record<string, RiderLocation>>({});
  const [isTracking, setIsTracking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSendRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // ── 1. Fetch locations for the group ───────────────────────────────────
  const fetchLocations = useCallback(async (gid: string) => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('locations')
        .select('user_id, latitude, longitude, profiles(name)')
        .eq('group_id', gid);

      if (fetchErr || !isMountedRef.current) return;

      const map: Record<string, RiderLocation> = {};
      (data || []).forEach((row: any) => {
        map[row.user_id] = {
          user_id: row.user_id,
          name: row.profiles?.name || 'Rider',
          latitude: row.latitude,
          longitude: row.longitude,
        };
      });
      setRidersMap(map);
    } catch (err) {
      console.error('[LocationSync] Fetch error:', err);
    }
  }, []);

  // ── 2. Start polling ───────────────────────────────────────────────────
  const startPolling = useCallback((gid: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    fetchLocations(gid);
    pollIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      fetchLocations(gid);
    }, POLL_INTERVAL_MS);

    setIsConnected(true);
    console.log('[LocationSync] Polling started');
  }, [fetchLocations]);

  // ── 3. Stop polling ────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // ── 4. Broadcast own location via UPSERT ───────────────────────────────
  const broadcastLocation = useCallback(
    async (latitude: number, longitude: number) => {
      if (!user || !groupId) return;

      const now = Date.now();
      if (now - lastSendRef.current < SEND_INTERVAL_MS) return;
      lastSendRef.current = now;

      try {
        const { error: upsertErr } = await supabase.from('locations').upsert(
          {
            user_id: user.id,
            group_id: groupId,
            latitude,
            longitude,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (upsertErr) {
          console.warn('[LocationSync] UPSERT error:', upsertErr.message);
        }
      } catch (err) {
        console.error('[LocationSync] Broadcast error:', err);
      }
    },
    [user, groupId]
  );

  // ── 5. Delete own location row (ride stopped) ─────────────────────────
  const deleteOwnLocation = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('locations').delete().eq('user_id', user.id);
      console.log('[LocationSync] Own location removed');
    } catch (err) {
      console.error('[LocationSync] Delete error:', err);
    }
  }, [user]);

  // ── 6. Start GPS watcher ───────────────────────────────────────────────
  const startGPSTracking = useCallback(async () => {
    if (!groupId || !user) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: SEND_INTERVAL_MS,
          distanceInterval: 5,
        },
        (loc) => {
          if (!isMountedRef.current) return;
          broadcastLocation(loc.coords.latitude, loc.coords.longitude);
        }
      );

      locationSubRef.current = sub;
      setIsTracking(true);
      console.log('[LocationSync] GPS tracking started');
    } catch (err) {
      console.error('[LocationSync] Tracking error:', err);
      setError(`Tracking error: ${String(err)}`);
    }
  }, [groupId, user, broadcastLocation]);

  // ── 7. Stop GPS watcher ────────────────────────────────────────────────
  const stopGPSTracking = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // ── 8. Main effect ─────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    if (!groupId || !user) {
      stopGPSTracking();
      stopPolling();
      setIsConnected(false);
      setRidersMap({});
      return;
    }

    if (isRiding) {
      // ✅ RIDE STARTED → share location + poll others
      setError(null);
      startPolling(groupId);
      startGPSTracking();
      console.log('[LocationSync] Ride started → sharing location');
    } else {
      // ❌ RIDE STOPPED → stop sharing, delete own row, clear map
      stopGPSTracking();
      deleteOwnLocation();
      stopPolling();
      setRidersMap({});
      setIsConnected(false);
      console.log('[LocationSync] Ride stopped → sharing stopped');
    }

    return () => {
      isMountedRef.current = false;
      stopGPSTracking();
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, user?.id, isRiding]);

  // ── 9. Derived array ──────────────────────────────────────────────────
  const riders = useMemo(() => Object.values(ridersMap), [ridersMap]);

  return { riders, isTracking, isConnected, error };
}

export default useGroupLocationSync;
