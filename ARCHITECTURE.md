/*
Architecture overview

Lerno is a Next.js App Router application split between the public marketing site and the authenticated student portal. Middleware handles Supabase session refresh and subdomain routing so lerno.in serves marketing pages while app.lerno.in maps into the portal routes.

The tutor flow runs through API routes under app/api. Student messages are normalized, optionally rewritten for retrieval, embedded, and matched against Qdrant using curriculum metadata. Retrieved NCERT chunks are passed into subject-aware prompts, then streamed back to the client with citations mapped to source metadata.

Supabase stores auth, profiles, tutor sessions, messages, progress, study attempts, social data, and analytics rollups. Service-role helpers are kept server-side only. Student memory is maintained per subject so weak topics, recent discussion, mistakes, and learning preferences can shape later sessions.

Learn Mode and Study Feed share the same curriculum foundation but use separate flows: Learn Mode creates chapter sessions, diagnostics, notes, summaries, and progress records; Study Feed creates short practice sessions and updates topic mastery from attempts.
*/
