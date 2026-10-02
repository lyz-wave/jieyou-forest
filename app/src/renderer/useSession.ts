import { useCallback, useEffect, useRef, useState } from 'react'
import type { Capabilities, ReflectionCardId, RingDraft, RingRow } from '../shared/types'
import type { CognitiveAnalysis, MicroExperiment, RingResonance } from '../shared/ipc'
import { capabilitiesFor } from '../shared/capabilities'

export type Scene =
  | 'express' | 'crisis' | 'space' | 'rest' | 'consent' | 'reflect' | 'unfinished' | 'save' | 'tree'

/** 四幕界面共享的全部状态与动作。场景组件只负责画，不自己调通道。 */
export interface SessionController {
  scene: Scene
  input: string
  sessionId: string
  caps: Capabilities
  banner: string | null
  /** 承接回应还在路上。用来禁用提交按钮、显示呼吸占位。 */
  awaiting: boolean
  receive: string
  cards: Partial<Record<ReflectionCardId, string>>
  analysis?: CognitiveAnalysis
  adoptedExperiment?: MicroExperiment
  resonance?: RingResonance
  reason: string
  notice: string
  rings: RingRow[]


  setInput: (v: string) => void
  go: (scene: Scene) => void
  submit: () => Promise<void>
  choose: (path: 'rest' | 'reflect') => Promise<void>
  consent: () => Promise<void>
  adoptExperiment: (exp: MicroExperiment) => void
  cancelReflect: () => Promise<void>
  correct: () => Promise<void>
  retryReceive: () => Promise<void>
  saveRing: (draft: RingDraft) => Promise<void>
  openTree: () => Promise<void>
  removeRing: (id: string) => Promise<void>
  startOver: () => void
}

export function useSession(): SessionController {
  const [scene, setScene] = useState<Scene>('express')
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [caps, setCaps] = useState<Capabilities>({ canRest: true, canReflect: true, canShowCrisis: false })
  const [banner, setBanner] = useState<string | null>(null)
  const [receive, setReceive] = useState('')
  const [cards, setCards] = useState<Partial<Record<ReflectionCardId, string>>>({})
  const [analysis, setAnalysis] = useState<CognitiveAnalysis>()
  const [adoptedExperiment, setAdoptedExperiment] = useState<MicroExperiment>()
  const [resonance, setResonance] = useState<RingResonance>()
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [rings, setRings] = useState<RingRow[]>([])
  const [awaiting, setAwaiting] = useState(false)

  /** 当前会话 id。事件带的 sessionId 必须与它对上，迟到的旧会话数据不许进界面。 */
  const activeSessionRef = useRef('')
  /** verdict 事件是否已经切过场景。避免 submit 返回时重复切一次造成闪动。 */
  const switchedRef = useRef(false)

  useEffect(() => {
    const offReceive = window.forest.onReceive((p) => {
      // 按会话过滤。连点或重试时会有多个会话的回应在飞，
      // 不过滤的话两段文字会交织在同一个 receive 里——这是真发生过的 bug。
      if (p.sessionId !== activeSessionRef.current) return
      setReceive((t) => t + p.delta)
    })
    const offReflection = window.forest.onReflection((p) => setCards((c) => ({ ...c, [p.card]: p.delta })))

    // 这两条通道主进程一直在发，而渲染层从来没有订阅过。
    // 关键在于：它们在**调用模型之前**就已经发出，所以可以拿来立刻切场景——
    // 而原来的做法是等整段回应生成完才切，那正是"点了像卡住"的原因。
    const offVerdict = window.forest.onVerdict((p) => {
      activeSessionRef.current = p.sessionId
      const next = capabilitiesFor(p.level)
      setSessionId(p.sessionId)
      setCaps(next)
      switchedRef.current = true
      setScene(next.canShowCrisis ? 'crisis' : 'space')
    })
    const offState = window.forest.onState((p) => {
      if (p.sessionId !== activeSessionRef.current) return
      setAwaiting(p.status === 'receiving')
    })

    return () => {
      offReceive()
      offReflection()
      offVerdict()
      offState()
    }
  }, [])

  const submit = useCallback(async () => {
    if (!input.trim()) {
      setNotice('空白提交不会开始一次表达')
      return
    }
    setNotice('')
    setReceive('')
    setBanner(null)
    setResonance(undefined)
    switchedRef.current = false
    setAwaiting(true)
    try {
      const r = await window.forest.submit({ input })
      setSessionId(r.sessionId)
      setCaps(r.capabilities)
      setBanner(r.banner)
      setResonance(r.resonance ?? undefined)
      // 正常情况下 verdict 事件已经切过场景了（毫秒级）。
      // 这里是兜底：万一事件没走到（例如 L1 提前返回），也要落到正确的幕。
      if (!switchedRef.current) setScene(r.capabilities.canShowCrisis ? 'crisis' : 'space')
    } finally {
      setAwaiting(false)
    }
  }, [input])


  const choose = useCallback(
    async (path: 'rest' | 'reflect') => {
      await window.forest.choosePath({ sessionId, path })
      setScene(path === 'rest' ? 'rest' : 'consent')
    },
    [sessionId],
  )

  const consent = useCallback(async () => {
    const r = await window.forest.consent({ sessionId })
    if (r.ok) {
      if (r.analysis) setAnalysis(r.analysis)
      setScene('reflect')
    } else {
      setReason(r.reason ?? 'invalid')
      setScene('unfinished')
    }
  }, [sessionId])

  const adoptExperiment = useCallback((exp: MicroExperiment) => {
    setAdoptedExperiment(exp)
    setScene('save')
  }, [])

  const cancelReflect = useCallback(async () => {
    await window.forest.cancelReflect({ sessionId })
    setScene('space')
  }, [sessionId])

  const correct = useCallback(async () => {
    const r = await window.forest.correct({ sessionId })
    setCaps(r.capabilities)
    setScene('space')
  }, [sessionId])

  const retryReceive = useCallback(async () => {
    setReceive('')
    setBanner(null)
    setAwaiting(true)
    try {
      const r = await window.forest.retryReceive({ sessionId })
      setBanner(r.banner)
    } finally {
      setAwaiting(false)
    }
  }, [sessionId])

  const openTree = useCallback(async () => {
    setRings(await window.forest.listRings())
    setScene('tree')
  }, [])

  const saveRing = useCallback(
    async (draft: RingDraft) => {
      const idempotencyKey = sessionId + ':' + draft.type + ':' + draft.userNote
      await window.forest.saveRing({ sessionId, idempotencyKey, draft })
      await openTree()
    },
    [sessionId, openTree],
  )

  const removeRing = useCallback(
    async (id: string) => {
      const res = await window.forest.deleteRing({ id })
      setNotice(res.stillReadable ? '删除后仍能读到，这是个 bug' : '已删除')
      await openTree()
    },
    [openTree],
  )

  const startOver = useCallback(() => {
    setInput('')
    setReceive('')
    setCards({})
    setAnalysis(undefined)
    setAdoptedExperiment(undefined)
    setResonance(undefined)
    setNotice('')
    setScene('express')
  }, [])

  return {
    scene, input, sessionId, caps, banner, awaiting, receive, cards, analysis, adoptedExperiment, resonance, reason, notice, rings,
    setInput, go: setScene, submit, choose, consent, adoptExperiment, cancelReflect, correct,
    retryReceive, saveRing, openTree, removeRing, startOver,
  }
}

