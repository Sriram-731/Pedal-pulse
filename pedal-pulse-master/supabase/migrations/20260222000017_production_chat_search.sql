-- production_chat_search.sql
-- Server-side optimized search using the GIN index

create or replace function search_messages(
    query_text text,
    room_id_param uuid,
    limit_param int default 50,
    offset_param int default 0
)
returns table (
    id uuid,
    room_id uuid,
    sender_id uuid,
    content text,
    media_url text,
    created_at timestamp with time zone,
    status text,
    reply_to_id uuid,
    is_deleted boolean,
    edited_at timestamp with time zone,
    profiles jsonb
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        m.id,
        m.room_id,
        m.sender_id,
        m.content,
        m.media_url,
        m.created_at,
        m.status,
        m.reply_to_id,
        m.is_deleted,
        m.edited_at,
        to_jsonb(p) as profiles
    from public.messages m
    left join public.profiles p on m.sender_id = p.id
    where m.room_id = room_id_param
    and m.is_deleted = false
    and to_tsvector('english', coalesce(m.content, '')) @@ plainto_tsquery('english', query_text)
    order by m.created_at desc
    limit limit_param
    offset offset_param;
end;
$$;
