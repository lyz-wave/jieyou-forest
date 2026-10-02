import { contextBridge, ipcRenderer } from 'electron'

// 白名单：只暴露架构文档 §2 列出的通道，不给渲染进程任何通用 invoke 出口。
const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>

const subscribe = <P>(channel: string, cb: (payload: P) => void): (() => void) => {
  const listener = (_e: unknown, payload: P): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  submit: (p: { input: string; emotion?: string; intensity?: string }) => invoke('session:submit', p),
  retryReceive: (p: { sessionId: string }) => invoke('session:retryReceive', p),
  correct: (p: { sessionId: string }) => invoke('safety:correct', p),
  choosePath: (p: { sessionId: string; path: 'rest' | 'reflect' }) => invoke('path:choose', p),
  consent: (p: { sessionId: string }) => invoke('reflect:consent', p),
  cancelReflect: (p: { sessionId: string }) => invoke('reflect:cancel', p),
  saveRing: (p: unknown) => invoke('ring:save', p),
  listRings: () => invoke('ring:list'),
  deleteRing: (p: { id: string }) => invoke('ring:delete', p),
  saveReview: (p: unknown) => invoke('review:save', p),
  clearAll: () => invoke('data:clearAll'),
  demoReset: () => invoke('demo:reset'),

  onReceive: (cb: (p: { sessionId: string; delta: string; done: boolean }) => void) => subscribe('stream:receive', cb),
  onReflection: (cb: (p: { sessionId: string; card: string; delta: string; done: boolean }) => void) => subscribe('stream:reflection', cb),
  onVerdict: (cb: (p: { sessionId: string; level: string }) => void) => subscribe('safety:verdict', cb),
  onState: (cb: (p: { sessionId: string; status: string }) => void) => subscribe('state:changed', cb),
  onError: (cb: (p: { sessionId: string; stage: string; code: string }) => void) => subscribe('stage:error', cb),
}

contextBridge.exposeInMainWorld('forest', api)
export type ForestApi = typeof api
