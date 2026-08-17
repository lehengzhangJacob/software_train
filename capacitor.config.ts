import type { CapacitorConfig } from "@capacitor/cli"

// The web app runs Node API routes (Prisma/SQLite), so it can never be a
// static export. The mobile app is therefore a thin shell that points at the
// live service (form A: LAN dev server; form B: deployed URL later).
// Health data (Health Connect) is read natively by the shell and POSTed to
// the service, so the whole product stays a single source of truth.
const config: CapacitorConfig = {
  appId: "com.csptr.foodtracker",
  appName: "FoodTracker",
  webDir: "capacitor-web",
  server: {
    url: "http://192.168.10.10:3000",
    cleartext: true,
  },
  android: {
    // allowCleartextTraffic for the LAN dev server; revisit for production TLS
    allowMixedContent: true,
  },
}

export default config