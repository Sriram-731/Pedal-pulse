import { create } from 'zustand';

interface LiveTrackingState {
    /** The group currently being tracked (null = not tracking) */
    activeGroupId: string | null;
    setActiveGroupId: (id: string | null) => void;
}

export const useLiveTrackingStore = create<LiveTrackingState>((set) => ({
    activeGroupId: null,
    setActiveGroupId: (id) => set({ activeGroupId: id }),
}));
