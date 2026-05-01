import { NextResponse } from "next/server"
import crypto from "crypto"

export async function POST() {
  const timestamp = Math.round(new Date().getTime() / 1000)

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
  const apiKey = process.env.CLOUDINARY_API_KEY!
  const apiSecret = process.env.CLOUDINARY_API_SECRET!

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Cloudinary not configured" },
      { status: 500 }
    )
  }

  const signature = crypto
    .createHash("sha1")
    .update(`timestamp=${timestamp}${apiSecret}`)
    .digest("hex")

  return NextResponse.json({
    timestamp,
    signature,
    apiKey,
    cloudName,
  })
}
