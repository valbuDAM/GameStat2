import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gamestat.app',
  appName: 'GameStat',
  webDir: 'www/browser',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1b182e'
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1b182e',
      androidScaleType: 'CENTER_CROP'
    }
  }
};

export default config;
