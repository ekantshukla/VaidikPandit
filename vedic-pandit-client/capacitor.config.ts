import type { CapacitorConfig } from '@capacitor/cli';

/** Settings for the Android app (built with Capacitor from the same Angular code as the website). */
const config: CapacitorConfig = {
  appId: 'com.vedicpandit.app',
  appName: 'Vedic Pandit',
  webDir: 'dist/vedic-pandit-client/browser',
  backgroundColor: '#1D1736',
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#1D1736', showSpinner: false },
  },
};

export default config;
