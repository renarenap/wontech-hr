import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 배포 경로. 저장소 이름이 다르면 이 값만 바꾸면 됩니다.
// 예: 저장소가 github.com/owner/wontech-hr 라면 '/wontech-hr/' 유지
export default defineConfig({
  base: '/wontech-hr/',
  plugins: [react()],
})
