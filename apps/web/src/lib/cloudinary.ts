/**
 * Cloudinary upload utility for AirTrainer.
 *
 * Uses the **unsigned upload** endpoint — no server-side signing needed.
 * Requires two env vars (set in .env):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 *
 * If either is missing the upload will throw with a descriptive message
 * so the caller can surface a user-friendly error.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";

/** Check whether Cloudinary is configured. */
export function isCloudinaryConfigured(): boolean {
    return !!(CLOUD_NAME && UPLOAD_PRESET);
}

export interface CloudinaryUploadResult {
    /** The public HTTPS URL of the uploaded asset. */
    url: string;
    /** Cloudinary public_id — useful for transformations / deletions. */
    publicId: string;
    /** Original filename. */
    originalFilename: string;
    /** Resource type (image, raw, video). */
    resourceType: string;
    /** File format (jpg, png, pdf, etc.). */
    format: string;
    /** File size in bytes. */
    bytes: number;
    /** Width in pixels (images/videos only). */
    width?: number;
    /** Height in pixels (images/videos only). */
    height?: number;
}

/**
 * Upload a file to Cloudinary.
 *
 * @param file - The File (or Blob) to upload.
 * @param folder - Cloudinary folder path (e.g. "airtrainer/avatars").
 * @param options.resourceType - "image" | "raw" | "auto" (default "auto").
 * @returns A promise resolving to the upload result with the public URL.
 */
export async function uploadToCloudinary(
    file: File,
    folder: string,
    options?: { resourceType?: "image" | "raw" | "auto" }
): Promise<CloudinaryUploadResult> {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error(
            "Cloudinary is not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your .env file."
        );
    }

    const resourceType = options?.resourceType ?? "auto";
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("folder", folder);

    const res = await fetch(url, { method: "POST", body: formData });

    if (!res.ok) {
        const body = await res.text().catch(() => "unknown error");
        throw new Error(`Cloudinary upload failed (${res.status}): ${body}`);
    }

    const data = await res.json();

    return {
        url: data.secure_url as string,
        publicId: data.public_id as string,
        originalFilename: data.original_filename as string,
        resourceType: data.resource_type as string,
        format: data.format as string,
        bytes: data.bytes as number,
        width: data.width,
        height: data.height,
    };
}

/**
 * Build a Cloudinary transformation URL from a base URL.
 *
 * Example: `cloudinaryUrl(url, "w_200,h_200,c_fill,f_auto,q_auto")`
 * → inserts the transformation segment into the URL.
 */
export function cloudinaryUrl(baseUrl: string, transformation: string): string {
    if (!baseUrl || !transformation) return baseUrl;
    // Cloudinary URLs look like: https://res.cloudinary.com/<cloud>/image/upload/v123/folder/file.jpg
    // We insert the transformation after "/upload/"
    return baseUrl.replace("/upload/", `/upload/${transformation}/`);
}
