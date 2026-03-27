alter table if exists chat_messages
add column if not exists is_pinned boolean not null default false;
