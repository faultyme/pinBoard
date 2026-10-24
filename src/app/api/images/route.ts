import { deleteImage, uploadImage } from "@/lib/cloudinary/server";
import { db } from "@/lib/neondb";
import { clickableImages } from "@/lib/neondb/schemas";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const posX = Number(form.get("x") ?? 0);
    const posY = Number(form.get("y") ?? 0);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const baseTitle =
      file.name.replace(/\.[^/.]+$/, "") || `image-${Date.now()}`;

    const { public_id, url } = await uploadImage(file, "board");

    const title = `${baseTitle}-${public_id.slice(-6)}`;

    const [row] = await db
      .insert(clickableImages)
      .values({
        title,
        coverImage: url,
        publicId: public_id,
        position: { x: posX, y: posY },
        keywords: [],
        link: null,
      })
      .returning();

    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(clickableImages)
      .where(eq(clickableImages.id, id));

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await deleteImage(row.publicId);
    await db.delete(clickableImages).where(eq(clickableImages.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}