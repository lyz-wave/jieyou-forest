import type { ForestApi } from '../shared/ipc'

declare global {
  interface Window {
    forest: ForestApi
  }
}

export {}
