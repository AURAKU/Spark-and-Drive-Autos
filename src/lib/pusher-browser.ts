import Pusher from "pusher-js";

/**
 * Single Pusher client per tab (Pusher recommendation). Channels subscribe/unsubscribe per thread.
 */
let instance: Pusher | null = null;
let instanceKey = "";

export function getSharedPusher(opts: { key: string; cluster: string; authEndpoint: string }): Pusher {
  if (instance && instanceKey === opts.key) {
    return instance;
  }
  if (instance) {
    instance.disconnect();
    instance = null;
  }
  instanceKey = opts.key;
  instance = new Pusher(opts.key, {
    cluster: opts.cluster,
    authEndpoint: opts.authEndpoint,
    authTransport: "ajax",
    forceTLS: true,
    enableStats: false,
  });
  return instance;
}
