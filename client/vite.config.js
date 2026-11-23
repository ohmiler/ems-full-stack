import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // อ่าน API_PORT จาก .env ที่ root ของโปรเจกต์ ให้ตรงกับที่ server ใช้
  const env = loadEnv(mode, '..', 'API_');
  const apiPort = env.API_PORT || 3001;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
  };
});
