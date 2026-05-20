/**
 * Types for Supabase Edge Functions (Deno) when edited inside this Next.js repo.
 * Runtime is Deno + HTTPS imports; not bundled into Next.
 */
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get(key: string): string | undefined };
};
