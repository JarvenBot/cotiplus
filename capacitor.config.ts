import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cotiplus.app',
  appName: 'COTIPLUS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
