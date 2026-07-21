import { create } from 'zustand';
import * as turf from '@turf/turf';
import { supabase } from '../config/supabase';
import { useAuthStore } from './useAuthStore';

interface Point {
    latitude: number;
    longitude: number;
    speed: number;
    altitude: number;
    timestamp: number;
}

interface RideState {
    currentRideId: string | null;
    groupId: string | null; // Selected group for the ride
    status: 'idle' | 'active' | 'paused' | 'completed';
    coordinates: Point[];
    totalDistance: number; // in meters
    startTime: number | null;

    setGroupId: (id: string | null) => void;
    startRide: () => void;
    pauseRide: () => void;
    resumeRide: () => void;
    stopRide: () => void;
    resetRide: () => void;
    addCoordinate: (pt: Point) => void;
}

export const useRideStore = create<RideState>((set, get) => ({
    currentRideId: null,
    groupId: null,
    status: 'idle',
    coordinates: [],
    totalDistance: 0,
    startTime: null,

    setGroupId: (id) => set({ groupId: id }),

    startRide: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const { groupId } = get();

        // Temporary ID until we get DB ID
        const { data, error } = await supabase.from('rides').insert({
            user_id: user.id,
            group_id: groupId,
            status: 'active'
        }).select('id').single();

        if (error || !data) {
            console.error("Failed to start ride", error);
            return;
        }

        set({
            currentRideId: data.id,
            status: 'active',
            coordinates: [],
            totalDistance: 0,
            startTime: Date.now(),
        });
    },

    pauseRide: () => set({ status: 'paused' }),

    resumeRide: () => set({ status: 'active' }),

    stopRide: async () => {
        const state = get();
        if (!state.currentRideId) return;

        const routeLine = state.coordinates.length > 1 ? {
            type: 'LineString',
            coordinates: state.coordinates.map(c => [c.longitude, c.latitude])
        } : null;

        // Supabase Sync
        await supabase.from('rides').update({
            end_time: new Date().toISOString(),
            total_distance: state.totalDistance,
            average_speed: state.totalDistance / ((Date.now() - (state.startTime || Date.now())) / 1000) || 0,
            status: 'completed',
            route_line: routeLine
        }).eq('id', state.currentRideId);

        // Batch insert coordinates
        if (state.coordinates.length > 0) {
            const coordInserts = state.coordinates.map(c => ({
                ride_id: state.currentRideId,
                location: `POINT(${c.longitude} ${c.latitude})`,
                speed: c.speed,
                altitude: c.altitude,
                recorded_at: new Date(c.timestamp).toISOString()
            }));
            await supabase.from('ride_coordinates').insert(coordInserts);
        }

        set({ status: 'completed' });

        // Instantly scrub live location from the map so the user doesn't linger
        // (removeLocation not implemented)
    },

    resetRide: () => {
        set({
            currentRideId: null,
            groupId: null,
            status: 'idle',
            coordinates: [],
            totalDistance: 0,
            startTime: null
        });

        // Ensure location is scrubbed if they exit without explicitly stopping
        // (removeLocation not implemented)
    },

    addCoordinate: (pt) => {
        const state = get();
        if (state.status !== 'active') return;

        const newCoords = [...state.coordinates, pt];
        let distanceAddition = 0;

        if (state.coordinates.length > 0) {
            const last = state.coordinates[state.coordinates.length - 1];
            const from = turf.point([last.longitude, last.latitude]);
            const to = turf.point([pt.longitude, pt.latitude]);
            // Return distance in meters
            distanceAddition = turf.distance(from, to, { units: 'meters' });
        }

        set({
            coordinates: newCoords,
            totalDistance: state.totalDistance + distanceAddition,
        });
    }
}));
