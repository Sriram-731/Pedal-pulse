-- 20260222000030_enterprise_communities.sql
-- Enterprise Community Features Migration

BEGIN;

-- 1. Extension for cryptographically secure random numbers (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Modify `public.communities`
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_invite_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS announcement_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'invite_only'));

-- Auto-generate invite codes for existing communities
UPDATE public.communities 
SET invite_code = ENCODE(GEN_RANDOM_BYTES(6), 'hex')
WHERE invite_code IS NULL;

-- 3. Modify `public.community_members`
ALTER TABLE public.community_members
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'banned')),
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;

-- Migrate existing community admins to 'owner' role
UPDATE public.community_members cm
SET role = 'owner'
FROM public.communities c
WHERE cm.community_id = c.id AND cm.user_id = c.admin_id AND cm.role = 'member';

-- Insert missing owner rows if they didn't exist in community_members
INSERT INTO public.community_members (community_id, user_id, role, status)
SELECT id, admin_id, 'owner', 'approved'
FROM public.communities
ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'owner';

-- 4. Modify `public.messages`
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 5. Create `public.community_audit_logs`
CREATE TABLE IF NOT EXISTS public.community_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) NOT NULL,
    action TEXT NOT NULL,
    target_id UUID REFERENCES public.profiles(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_community ON public.community_audit_logs(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.community_audit_logs(actor_id, created_at DESC);

-- 6. Create `public.reports` table for reporting users/messages
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.profiles(id) NOT NULL,
    reported_user_id UUID REFERENCES public.profiles(id),
    reported_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Implement PostgreSQL-Level Rate Limiting for Moderation
-- This function throws an exception if the actor has performed > 20 moderation actions in the last 1 minute
CREATE OR REPLACE FUNCTION check_audit_log_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    recent_actions INT;
BEGIN
    SELECT COUNT(*)
    INTO recent_actions
    FROM public.community_audit_logs
    WHERE actor_id = NEW.actor_id 
      AND created_at > (NOW() - INTERVAL '1 minute');

    IF recent_actions >= 20 THEN
        RAISE EXCEPTION 'Rate limit exceeded: You are performing actions too quickly. Please wait a minute.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_audit_rate_limit ON public.community_audit_logs;
CREATE TRIGGER enforce_audit_rate_limit
    BEFORE INSERT ON public.community_audit_logs
    FOR EACH ROW EXECUTE PROCEDURE check_audit_log_rate_limit();

-- 8. Add RLS for new tables
ALTER TABLE public.community_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins/Owners/Mods can view audit logs
DROP POLICY IF EXISTS "Mods can view audit logs" ON public.community_audit_logs;
CREATE POLICY "Mods can view audit logs"
ON public.community_audit_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.community_members
        WHERE community_id = community_audit_logs.community_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'moderator')
    )
);

-- Internal inserts are generally allowed for the app context, but we can restrict to members
DROP POLICY IF EXISTS "Members can insert audit logs" ON public.community_audit_logs;
CREATE POLICY "Members can insert audit logs"
ON public.community_audit_logs FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.community_members
        WHERE community_id = community_audit_logs.community_id
          AND user_id = auth.uid()
    )
    AND auth.uid() = actor_id
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a report
DROP POLICY IF EXISTS "Anyone can insert a report" ON public.reports;
CREATE POLICY "Anyone can insert a report"
ON public.reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- Only Admins/Owners/Mods of the community can view reports for that community
-- Assumes reports for a specific community are tied to it. System-wide reports (no community_id) can only be viewed by sysadmins (if we add them).
DROP POLICY IF EXISTS "Mods can view their community reports" ON public.reports;
CREATE POLICY "Mods can view their community reports"
ON public.reports FOR SELECT
USING (
    community_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.community_members
        WHERE community_id = reports.community_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'moderator')
    )
);

-- Update Realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
