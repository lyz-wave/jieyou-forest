import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// 主进程与 preload 强制输出 CJS：沙箱化的渲染进程不支持 ESM preload 脚本。
// external: ['electron'] 不能省——electron 在 devDependencies 里，
// externalizeDepsPlugin 不管它；一旦被打进 bundle，它内部读 path.txt 的 __dirname
// 就指向 out/main，二进制永远找不到。
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts'),
        // 显式写 external 会覆盖 externalizeDepsPlugin 注入的列表，所以原生模块必须自己列上。
        external: ['electron', 'better-sqlite3'],
        output: { format: 'cjs', entryFileNames: 'index.js' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
        external: ['electron'],
        output: { format: 'cjs', entryFileNames: 'index.js' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
    plugins: [react()],
  },
})
