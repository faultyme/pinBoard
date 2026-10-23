import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "./config";

export async function uploadImage(
  file: File,
  folder = "your-folder"
): Promise<{ public_id: string; url: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder }, (err, res) =>
        err ? reject(err) : resolve(res!)
      )
      .end(buffer);
  });

  return { public_id: result.public_id, url: result.secure_url };
}

export async function deleteImage(public_id: string): Promise<boolean> {
  const result = await cloudinary.uploader.destroy(public_id, {
    invalidate: true,
  });
  return result.result === "ok";
}