import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

async function wipeEvents() {
    console.log('Fetching events to delete...');
    const { data: events, error } = await supabase.from('events').select('id');

    if (error) {
        console.error('Error fetching events:', error);
        return;
    }

    if (events && events.length > 0) {
        for (const event of events) {
            await supabase.from('event_participants').delete().eq('event_id', event.id);
            await supabase.from('events').delete().eq('id', event.id);
            console.log(`Deleted event ${event.id}`);
        }
        console.log('Demo events successfully removed!');
    } else {
        console.log('No demo events found.');
    }
}

wipeEvents();
