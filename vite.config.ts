import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import aitDevtools from "@apps-in-toss/devtools/unplugin";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [aitDevtools.vite(), react()],
  // 개발 서버에서만 Edge Function을 같은 출처로 태운다. 브라우저에서 화면을 확인하려고
  // 프로덕션 CORS 허용 목록(토스 미니앱 origin 4개)에 localhost를 넣지 않기 위해서다.
  server: {
    proxy: {
      '/functions': {
        target: loadEnv(mode, process.cwd(), '').SUPABASE_FUNCTIONS_ORIGIN ?? '',
        changeOrigin: true,
      },
    },
  },
}))
