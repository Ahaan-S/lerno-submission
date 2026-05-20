-- Short label for user messages (e.g. Learn Mode sidebar actions) while `content` holds the full model prompt.
alter table public.tutor_messages
  add column if not exists display_content text;

comment on column public.tutor_messages.display_content is 'Optional UI label; when set, Learn/Ask UIs may show this instead of user content (full prompt still in content).';
