import { contextBridge, ipcRenderer } from 'electron'
import { CH, type ForestApi, type InvokeChannel, type SendChannel } from '../shared/ipc'

// 白名单：只暴露契约里列出的通道，不给渲染进程任何通用 invoke 出口。
// 形参类型是 CH 值的联合，不是 string——写裸字面量会编译不过。
const invoke = <T>(channel: InvokeChannel, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>

const subscribe = <P>(channel: SendChannel, cb: (p: P) => void): (() => void) => {
  const listener = (_e: unknown, payload: P): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// 标注成 ForestApi：少实现一个方法、或签名对不上，这里就编译不过。
const api: ForestApi = {
  submit: (p) => invoke(CH.invoke.submit, p),
  retryReceive: (p) => invoke(CH.invoke.retryReceive, p),
  correct: (p) => invoke(CH.invoke.correct, p),
  choosePath: (p) => invoke(CH.invoke.choosePath, p),
  consent: (p) => invoke(CH.invoke.consent, p),
  cancelReflect: (p) => invoke(CH.invoke.cancelReflect, p),
  saveRing: (p) => invoke(CH.invoke.saveRing, p),
  listRings: () => invoke(CH.invoke.listRings),
  getRing: (p) => invoke(CH.invoke.getRing, p),
  deleteRing: (p) => invoke(CH.invoke.deleteRing, p),
  saveReview: (p) => invoke(CH.invoke.saveReview, p),
  clearAll: () => invoke(CH.invoke.clearAll),
  demoReset: () => invoke(CH.invoke.demoReset),
  getModelConfig: () => invoke(CH.invoke.getModelConfig),
  saveModelConfig: (cfg) => invoke(CH.invoke.saveModelConfig, cfg),
  testModelConfig: (cfg) => invoke(CH.invoke.testModelConfig, cfg),
  listModels: (cfg) => invoke(CH.invoke.listModels, cfg),
  transcribe: (p) => invoke(CH.invoke.transcribe, p),
  discuss: (p) => invoke(CH.invoke.discuss, p),

  onReceive: (cb) => subscribe(CH.send.receive, cb),
  onReflection: (cb) => subscribe(CH.send.reflection, cb),
  onDiscussionDelta: (cb) => subscribe(CH.send.discussionDelta, cb),
  onVerdict: (cb) => subscribe(CH.send.verdict, cb),
  onState: (cb) => subscribe(CH.send.state, cb),
  onError: (cb) => subscribe(CH.send.error, cb),
}


contextBridge.exposeInMainWorld('forest', api)
