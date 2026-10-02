import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 默认 node；需要 DOM 的文件在首行用 // @vitest-environment happy-dom 单独声明
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
