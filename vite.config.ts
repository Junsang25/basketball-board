import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages는 /저장소이름/ 아래에 올라간다.
  // 상대 경로로 뽑아두면 어느 폴더에 올려도 그대로 열린다.
  base: './',
  plugins: [react()],
})
