import type { CapacitorConfig } from "@capacitor/cli"

// The web app runs Node API routes (Prisma/SQLite), so it can never be a
// static export. The mobile app is therefore a thin shell that points at a
// live service: form A (dev) via `adb reverse tcp:3000 tcp:<host-port>` to
// the device-side loopback, or form B (ADR-0007) directly at the deployed
// cloud instance. `npm run android:cloud` bakes the cloud URL in at sync
// time via FT_CLOUD_URL; a plain `npx cap sync android` restores form A.
// Health data (Health Connect) is read natively by the shell and POSTed to
// the service, so the whole product stays a single source of truth.
const cloudUrl = process.env.FT_CLOUD_URL?.trim() || ""

const config: CapacitorConfig = {
  appId: "com.csptr.foodtracker",
  appName: "FoodTracker",
  webDir: "capacitor-web",
  server: {
    url: cloudUrl || "http://127.0.0.1:3000",
    cleartext: true,
  },
  android: {
    // allowCleartextTraffic for the loopback dev server and the plain-IP
    // cloud instance (TLS is known debt until a domain exists, ADR-0007)
    allowMixedContent: true,
  },
}

export default config