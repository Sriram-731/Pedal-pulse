import { create } from 'zustand'
import { supabase } from '../config/supabase'
import { Session, User } from '@supabase/supabase-js'

export interface Profile {
    id: string
    name: string
    age?: number
    height?: number
    weight?: number
    blood_group?: string
    emergency_contact_phone?: string
    medical_notes?: string
    avatar_url?: string
    role: 'user' | 'admin'
}

interface AuthState {
    session: Session | null
    user: User | null
    profile: Profile | null
    initialized: boolean
    isLoading: boolean
    setSession: (session: Session | null) => void
    setProfile: (profile: Profile | null) => void
    fetchProfile: (userId: string) => Promise<void>
    updateProfile: (userId: string, updates: Partial<Profile>) => Promise<boolean>
    signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
    session: null,
    user: null,
    profile: null,
    initialized: false,
    isLoading: false,

    setSession: (session) => {
        set({ session, user: session?.user || null })

        // Add a small artificial delay to ensure splash screen visibility
        // especially if session is already cached
        setTimeout(() => {
            set({ initialized: true })
        }, 2000)

        if (session?.user) {
            get().fetchProfile(session.user.id)
        } else {
            set({ profile: null })
        }
    },

    setProfile: (profile) => set({ profile }),

    fetchProfile: async (userId: string) => {
        set({ isLoading: true })
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (error) {
            console.error('Error fetching profile:', error.message)
        } else if (data) {
            set({ profile: data as Profile })
        }
        set({ isLoading: false })
    },

    updateProfile: async (userId: string, updates: Partial<Profile>) => {
        set({ isLoading: true });
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error.message);
            set({ isLoading: false });
            return false;
        }

        set({ profile: data as Profile, isLoading: false });
        return true;
    },

    signOut: async () => {
        set({ isLoading: true })
        await supabase.auth.signOut()
        set({ session: null, user: null, profile: null, isLoading: false })
    }
}))
