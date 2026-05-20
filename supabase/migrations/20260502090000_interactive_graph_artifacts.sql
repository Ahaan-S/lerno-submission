alter table public.tutor_messages
  add column if not exists graph_artifacts jsonb;

comment on column public.tutor_messages.graph_artifacts is
  'Validated interactive graph artifacts referenced by [[graph:id]] placeholders in assistant markdown.';

alter table public.query_cache
  add column if not exists graph_artifacts jsonb;

comment on column public.query_cache.graph_artifacts is
  'Cached interactive graph artifacts for prompt-versioned tutor responses.';
