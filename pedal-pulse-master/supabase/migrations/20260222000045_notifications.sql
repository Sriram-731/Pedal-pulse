-- 20260222000045_notifications.sql
-- In-app notification system for alerts, emergencies, and general notifications

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'emergency', 'ride', 'group')),
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}',
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read)
    WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications_select_own" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications  
CREATE POLICY "notifications_delete_own" ON public.notifications
FOR DELETE USING (auth.uid() = user_id);

-- Any authenticated user can insert notifications (for sending alerts to others)
CREATE POLICY "notifications_insert_authenticated" ON public.notifications
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications';
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

NOTIFY pgrst, 'reload schema';
