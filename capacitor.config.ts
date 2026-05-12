import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.rbsm.productmaestro",
  appName: "Marca Própria",
  webDir: "dist",
  // Carrega o app direto do deploy Vercel.
  // Cada git push -> atualização instantânea no APK, sem reinstalar.
  // Tradeoff: requer internet (mas o app já depende do Supabase mesmo).
  server: {
    url: "https://inteligenciarbsm-hash-product-maest.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
