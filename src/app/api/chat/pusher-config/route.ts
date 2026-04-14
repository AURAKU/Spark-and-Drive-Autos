import { NextResponse } from "next/server";

/**
 * Public Pusher client config (key + cluster are safe to expose).
 * Private channels use `authEndpoint` (browser POSTs socket_id + channel_name for signing).
 */
export async function GET() {
  const key = process.env.PUSHER_KEY;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!key || !cluster) {
    return NextResponse.json({ enabled: false as const });
  }
  return NextResponse.json({
    enabled: true as const,
    key,
    cluster,
    authEndpoint: "/api/chat/pusher-auth",
  });
}
