import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { AVATAR_MAX_UPLOAD_BYTES } from "@/lib/profile-avatar-limits";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** POST multipart — resize avatar and store under avatars/{userId}/avatar.webp */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof (file as Blob).arrayBuffer !== "function") {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const blob = file as File;
  const mime = (blob.type || "").toLowerCase();
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Use JPEG, PNG, or WebP" }, { status: 400 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  if (buf.length > AVATAR_MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Max file size is ${Math.round(AVATAR_MAX_UPLOAD_BYTES / (1024 * 1024))}MB` },
      { status: 400 }
    );
  }

  let webp: Buffer;
  try {
    webp = await sharp(buf).resize(256, 256, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
  } catch (e) {
    console.error("[profile/avatar] sharp", e);
    return NextResponse.json({ error: "Could not process image" }, { status: 400 });
  }

  const path = `${user.id}/avatar.webp`;
  const { error: upErr } = await admin.storage.from("avatars").upload(path, webp, {
    contentType: "image/webp",
    upsert: true,
  });

  if (upErr) {
    console.error("[profile/avatar] storage upload", upErr);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  // Same object path on every upload → identical URL → browsers/CDNs serve a stale cached image.
  // Persist a cache-busting query so clients always fetch the newly uploaded bytes.
  const publicUrl = `${base}/storage/v1/object/public/avatars/${path}?v=${Date.now()}`;

  const { error: dbErr } = await admin.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);

  if (dbErr) {
    console.error("[profile/avatar] profiles update", dbErr);
    return NextResponse.json({ error: "Failed to save avatar URL" }, { status: 500 });
  }

  return NextResponse.json({ avatar_url: publicUrl });
}
