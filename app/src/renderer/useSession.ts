import { useCallback, useEffect, useState } from 'react'
import type { Capabilities, ReflectionCardId, RingDraft, RingRow } from '../shared/types'
import type { CognitiveAnalysis, MicroExperiment, RingResonance } from '../shared/ipc'

export type Scene =
  | 'express' | 'crisis' | 'space' | 'rest' | 'consent' | 'reflect' | 'unfinished' | 'save' | 'tree'

/** 四幕界面共享的全部状态与动作。场景组件只负责画，不自己调通道。 */
export interface SessionController {
  scene: Scene
  input: string
  emotion?: string
  sessionId: string
  caps: Capabilities
  banner: string | null
  receive: string
  cards: Partial<Record<ReflectionCardId, string>>
  analysis?: CognitiveAnalysis
  adoptedExperiment?: MicroExperiment
  resonance?: RingResonance
  reason: string
  notice: string
  rings: RingRow[]


  setInput: (v: string) => void
  setEmotion: (v?: string) => void
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
  const [emotion, setEmotion] = useState<string>()
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

  useEffect(() => {
    const offReceive = window.forest.onReceive((p) => setReceive((t) => t + p.delta))
    const offReflection = window.forest.onReflection((p) => setCards((c) => ({ ...c, [p.card]: p.delta })))
    return () => {
      offReceive()
      offReflection()
    }
  }, [])

  const submit = useCallback(async () => {
    if (!input.trim()) {
      setNotice('空白提交不会开始一次表达')
      return
    }
    setNotice('')
    const r = await window.forest.submit({ input, emotion })
    setSessionId(r.sessionId)
    setCaps(r.capabilities)
    setBanner(r.banner)
    setResonance(r.resonance ?? undefined)
    setScene(r.capabilities.canShowCrisis ? 'crisis' : 'space')
  }, [input, emotion])


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
    const r = await window.forest.retryReceive({ sessionId })
    setBanner(r.banner)
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
    scene, input, emotion, sessionId, caps, banner, receive, cards, analysis, adoptedExperiment, resonance, reason, notice, rings,
    setInput, setEmotion, go: setScene, submit, choose, consent, adoptExperiment, cancelReflect, correct,
    retryReceive, saveRing, openTree, removeRing, startOver,
  }
}

