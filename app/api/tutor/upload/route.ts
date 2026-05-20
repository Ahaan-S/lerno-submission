import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { describeImage } from "@/lib/ai/llm";
// NOTE: pdf-parse is intentionally NOT statically imported here.
// It uses Object.defineProperty at module load time which crashes Next.js App Router's
// webpack bundler. It must be dynamically imported inside the PDF branch only.

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];
const BUCKET = process.env.ATTACHMENT_BUCKET ?? "chat-attachments";
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365; // 1 year in seconds

export async function POST(request: NextRequest) {
  console.log("[upload] POST received");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[upload] Unauthorized — no user session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log("[upload] User authenticated:", user.id);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const sessionId = formData.get("session_id") as string | null;

  console.log("[upload] File:", file?.name, "| type:", file?.type, "| size:", file?.size, "| sessionId:", sessionId);

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!sessionId) return NextResponse.json({ error: "session_id required" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    console.error("[upload] Unsupported file type:", file.type);
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    console.error("[upload] File too large:", file.size);
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${sessionId}/${timestamp}_${safeName}`;
  console.log("[upload] Storage path:", storagePath, "| bucket:", BUCKET);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const isImage = file.type.startsWith("image/");

  // For images: build a base64 data URL so description can run in parallel with storage upload.
  // Client already compresses images to ≤1MB so base64 overhead is negligible.
  const imageDataUrl = isImage ? `data:${file.type};base64,${buffer.toString("base64")}` : null;

  // Run storage upload and image description generation in parallel.
  console.log("[upload] Uploading to Supabase Storage" + (isImage ? " + generating image description (parallel)" : "") + "...");
  const [uploadResult, descriptionResult] = await Promise.allSettled([
    supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType: file.type, upsert: false }),
    imageDataUrl ? describeImage(imageDataUrl) : Promise.resolve(""),
  ]);

  if (uploadResult.status === "rejected" || (uploadResult.status === "fulfilled" && uploadResult.value.error)) {
    const uploadError = uploadResult.status === "rejected" ? uploadResult.reason : uploadResult.value.error;
    console.error("[upload] Storage upload FAILED:", uploadError?.message, "| full:", JSON.stringify(uploadError));
    return NextResponse.json({ error: `Upload failed: ${uploadError?.message ?? "unknown"}` }, { status: 500 });
  }
  console.log("[upload] Storage upload OK");

  const imageDescription: string | null = isImage && descriptionResult.status === "fulfilled" && descriptionResult.value
    ? descriptionResult.value
    : null;
  if (isImage) console.log("[upload] Image description:", imageDescription ? `${imageDescription.length} chars` : "none (failed or empty)");

  // Generate signed URL (1-year expiry for UI previews)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (signedError || !signedData) {
    console.error("[upload] Signed URL failed:", signedError?.message);
    return NextResponse.json({ error: "Could not generate file URL" }, { status: 500 });
  }
  console.log("[upload] Signed URL generated OK");

  // Extract text for PDFs — dynamic import avoids webpack crash at module load time
  let extractedText: string | null = null;
  if (file.type === "application/pdf") {
    try {
      console.log("[upload] Starting PDF text extraction...");
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
      const textResult = await parser.getText();
      extractedText = textResult.text?.trim() || null;
      await parser.destroy();
      console.log("[upload] PDF text extracted, length:", extractedText?.length ?? 0);
      // Safety cap: store max 50,000 chars (approx 12,000 tokens) — prevents prompt explosion
      if (extractedText && extractedText.length > 50000) {
        extractedText = extractedText.slice(0, 50000) + "\n\n[Document truncated — showing first 50,000 characters]";
      }
    } catch (err) {
      console.warn("[upload] PDF text extraction failed (non-fatal):", err);
      // Non-fatal — attachment still works, just no text extraction
    }
  }

  console.log("[upload] Done — returning metadata for:", file.name);
  return NextResponse.json({
    url: signedData.signedUrl,
    path: storagePath,
    name: file.name,
    type: file.type,
    size: file.size,
    extracted_text: extractedText,
    description: imageDescription,
  });
}
