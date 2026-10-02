// @vitest-environment happy-dom
import { fireEvent, render, screen, act, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import CampfireCouncil from './CampfireCouncil'
import type { SessionController } from '../useSession'

function makeMockSession(overrides: Partial<SessionController> = {}): SessionController {
  return {
    sessionId: 'test-session-1',
    scene: 'express',
    input: '最近项目推进遇到了瓶颈，大家意见不一，心里很慌。',
    receive: '面对这种多方分歧，感到慌乱是非常自然的。',
    analysis: {
      quotedInput: ['项目推进遇到了瓶颈'],
      assumptions: ['大家意见不一说明事情一定会搞砸'],
      reframedQuestion: '分歧背后，是否其实暴露出关键信息？',
      socraticQuestions: {
        guardian: '在分歧中，你最需要坚守的核心底线是什么？',
        explorer: '有没有一种兼顾双方的小步探索方案？',
        outsider: '三年后回看，这是否只是一次普通的共识校准？',
      },
      microExperiment: {
        action: '找核心相关人一对一喝杯咖啡核实第一条关键意见',
        observableCriterion: '厘清关键分歧原因',
        estimatedMinutes: 5,
      },
      promptVersion: 'v1',
    },
    cards: {},
    rings: [],
    due: [],
    reviews: [],
    awaiting: false,
    reflecting: false,
    banner: null,
    notice: null,
    caps: { canRest: true, canReflect: true, canShowCrisis: false },
    setInput: vi.fn(),
    submit: vi.fn(),
    retryReceive: vi.fn(),
    correct: vi.fn(),
    choose: vi.fn(),
    consent: vi.fn(),
    cancelReflect: vi.fn(),
    adoptExperiment: vi.fn(),
    saveRing: vi.fn(),
    removeRing: vi.fn(),
    saveReview: vi.fn(),
    refreshRings: vi.fn(),
    openTree: vi.fn(),
    clearAllData: vi.fn(),
    startOver: vi.fn(),
    go: vi.fn(),
    resonance: null,
    ...overrides,
  } as unknown as SessionController
}

describe('CampfireCouncil Integration Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders in roam mode and shows animal greeting bubble upon click', () => {
    const s = makeMockSession()
    const { container } = render(<CampfireCouncil s={s} mode="roam" />)

    expect(container.querySelector('.campfire-council-stage')).toBeTruthy()
    expect(container.querySelector('.mode-roam')).toBeTruthy()

    // 找到灵狐点击
    const fox = container.querySelector('.animal-sprite-wrap.fox')
    expect(fox).toBeTruthy()
    fireEvent.click(fox!)

    // 应该弹出灵狐的亲切问候语
    expect(screen.getByText(/别钻死胡同/)).toBeTruthy()
  })

  it('renders in campfire mode with active campfire and triggers sequential animal discussions', () => {
    const s = makeMockSession()
    const { container } = render(<CampfireCouncil s={s} mode="campfire" />)

    expect(container.querySelector('.mode-campfire')).toBeTruthy()
    const campfireCore = container.querySelector('.campfire-core')
    expect(campfireCore).toBeTruthy()

    // 快进到白鹿发言（600ms）
    act(() => {
      vi.advanceTimersByTime(800)
    })
    // 白鹿应当接住并呈现 s.receive
    expect(screen.getByText('面对这种多方分歧，感到慌乱是非常自然的。')).toBeTruthy()

    // 快进到小浣熊行动（17200ms）
    act(() => {
      vi.advanceTimersByTime(17000)
    })
    expect(screen.getByText(/找核心相关人一对一喝杯咖啡/)).toBeTruthy()

    // 快进到收敛共识阶段（22500ms）
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(screen.getByText('🌿 围炉探讨已达成共识')).toBeTruthy()
    const adoptBtn = screen.getByText('以此顿悟留年轮')
    expect(adoptBtn).toBeTruthy()

    fireEvent.click(adoptBtn)
    expect(s.adoptExperiment).toHaveBeenCalled()
  })

  it('allows clicking an animal in campfire mode to focus its tailored perspective', () => {
    const s = makeMockSession()
    const { container } = render(<CampfireCouncil s={s} mode="campfire" />)

    const bear = container.querySelector('.animal-sprite-wrap.bear')
    expect(bear).toBeTruthy()
    fireEvent.click(bear!)

    // 应当显示棕熊对应的守护者反问
    expect(screen.getByText('在分歧中，你最需要坚守的核心底线是什么？')).toBeTruthy()
  })
})
