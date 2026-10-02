// pnpm 有时会静默跳过 electron 的 postinstall（影子构建同步问题），
// 这里兜底：二进制缺失就直接跑 electron 自带的安装脚本。
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronDir = require.resolve('electron/package.json').replace(/package\.json$/, '')

if (!existsSync(`${electronDir}dist/Electron.app`) && !existsSync(`${electronDir}dist/electron`)) {
  console.log('electron binary missing, running its installer…')
  execFileSync(process.execPath, [`${electronDir}install.js`], { stdio: 'inherit' })
}
