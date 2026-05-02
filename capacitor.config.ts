import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.rbsm.productmaestro",
  appName: "Product Maestro",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
