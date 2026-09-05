import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'today-peak',
  brand: {
    primaryColor: '#1D674D', // 로고(assets/logo.png)의 대표 색과 일치시킨 값. 가이드가 둘의 일치를 요구한다.
  },
  permissions: [{ name: 'geolocation', access: 'access' }],
  webBundleDir: 'dist',
});
