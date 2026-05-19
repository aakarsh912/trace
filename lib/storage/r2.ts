import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

function getS3Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// Returns a pre-signed PUT URL valid for 5 minutes.
// CORS note: the R2 bucket must allow PUT from the app origin.
// In the Cloudflare dashboard → R2 → bucket → Settings → CORS policy:
// [{ "AllowedOrigins": ["https://your-domain.com","http://localhost:3000"],
//    "AllowedMethods": ["PUT"], "AllowedHeaders": ["Content-Type"] }]
export async function getUploadUrl(
  fileKey: string,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

export async function getSignedDownloadUrl(fileKey: string): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
  });
  return getSignedUrl(client, command, { expiresIn: 900 }); // 15 minutes
}

export function generateFileKey(
  projectId: string,
  deliverableId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `projects/${projectId}/deliverables/${deliverableId}/${timestamp}_${sanitized}`;
}
