// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { capabilitiesFor } from '../shared/capabilities'
import type { ForestApi, ReceiveChunk, ReflectionChunk } from '../shared/ipc'
import type { Capabilities, RingDraft, RingRow } from '../shared/types'

// 逐幕走一遍的验收测试：拆分渲染层不应该改变任何一步的界面行为。
// 假 API 只实现契约，不碰 Electron，所以它能跑在普通 Node 里。

function makeFakeApi(opts: { level?: 'L1' | 'L2' | 'L3'; consentOk?: boolean } = {}) {
  const level = opts.level ?? 'L3'
  // 复用真实的映射，避免测试里再维护一份会漂移的三级表
  const capsFor = (): Capabilities => capabilitiesFor(level)

  const receiveListeners: Array<(p: ReceiveChunk) => void> = []
  const reflectionListeners: Array<(p: ReflectionChunk) => void> = []
  const rings: RingRow[] = []

  const api: ForestApi = {
    submit: async () => {
      receiveListeners.forEach((cb) =>
        cb({ sessionId: 's1', delta: '被这样对待，确实可能让人难受。', done: true }),
      )
      return { sessionId: 's1', capabilities: capsFor(), banner: null }
    },
    retryReceive: async () => ({ banner: '这是内置的通用提示，不是针对你刚写的内容生成的' }),
    correct: async () => ({
      level: 'L2',
      capabilities: { canRest: true, canReflect: false, canShowCrisis: false },
    }),
    choosePath: async () => ({ status: 'resting' }),
    consent: async () => {
      if (opts.consentOk === false) return { ok: false, reason: 'unavailable' }
      reflectionListeners.forEach((cb) => cb({ sessionId: 's1', card: 'guardian', delta: '守护者视角', done: true }))
      reflectionListeners.forEach((cb) =>
        cb({ sessionId: 's1', card: 'mirror', delta: '你有没有想过另一种可能？', done: true }),
      )
      return {
        ok: true,
        analysis: {
          objectiveFact: '方案未通过并收到2条反馈',
          subjectiveAssumption: '他们全盘否定我，我彻底搞砸了',
          distortionBadge: '灾难化',
          socraticQuestions: {
            guardian: '守护者反问：你最想守护的核心边界是什么？',
            explorer: '探索者反问：如果把反对视为新输入，这里藏着什么机会？',
            outsider: '局外人反问：一年后的你看今天，会怎么评价这个插曲？',
          },
          microExperiment: {
            action: '明天只找导师核实第一条修改建议',
            observableCriterion: '得到明确边界结论并记录在笔记中',
            estimatedMinutes: 5,
          },
        },
      }
    },
    cancelReflect: async () => ({ status: 'choosing' }),
    saveRing: async ({ draft, idempotencyKey }: { draft: RingDraft; idempotencyKey: string }) => {
      if (!rings.some((r) => r.id === idempotencyKey)) {
        rings.unshift({
          id: idempotencyKey, session_id: 's1', type: draft.type, user_note: draft.userNote,
          save_original: draft.saveOriginal ? 1 : 0,
          original_text: draft.saveOriginal ? (draft.originalText ?? null) : null,
          user_decision: draft.userDecision ?? null,
          action: draft.action ?? null, criterion: draft.criterion ?? null,
          review_due: draft.reviewDue ?? null, created_at: 'now', is_demo: 0,
          idempotency_key: idempotencyKey,
        })
      }
      return { ringId: idempotencyKey }
    },
    listRings: async () => [...rings],
    getRing: async ({ id }) => rings.find((r) => r.id === id),
    deleteRing: async ({ id }) => {
      const i = rings.findIndex((r) => r.id === id)
      if (i >= 0) rings.splice(i, 1)
      return { deleted: i >= 0, stillReadable: rings.some((r) => r.id === id) }
    },
    saveReview: async () => ({ reviewId: 'rv1' }),
    clearAll: async () => ({ empty: true }),
    demoReset: async () => ({ empty: true }),
    onReceive: (cb) => { receiveListeners.push(cb); return () => {} },
    onReflection: (cb) => { reflectionListeners.push(cb); return () => {} },
    onVerdict: () => () => {},
    onState: () => () => {},
    onError: () => () => {},
  }
  return { api, rings }
}

function boot(opts: Parameters<typeof makeFakeApi>[0] = {}) {
  const fake = makeFakeApi(opts)
  window.forest = fake.api
  return { ...fake, ...render(<App />) }
}

async function expressAndSubmit(text = '今天被拒了') {
  fireEvent.change(screen.getByPlaceholderText('写一句就好，不用讲完整'), { target: { value: text } })
  fireEvent.click(screen.getByText('说完了'))
  await waitFor(() => expect(screen.getByText('被这样对待，确实可能让人难受。')).toBeTruthy())
}

afterEach(cleanup)

describe('四幕界面逐幕走查', () => {
  it('休息路径：表达 → 承接 → 分流 → 两张卡 → 保存年轮 → 删除', async () => {
    boot()
    await expressAndSubmit()

    fireEvent.click(screen.getByText('先歇一会儿'))
    await waitFor(() => expect(screen.getByText('烦恼落叶')).toBeTruthy())
    expect(screen.getByText('感官停顿')).toBeTruthy()

    fireEvent.click(screen.getByText('留下一圈年轮'))
    await waitFor(() => expect(screen.getByText('陪伴年轮（只要一句观察）')).toBeTruthy())
    expect(screen.getByText(/数据只存在这台电脑上，不加密/)).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '原来我只是累了' } })
    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => expect(screen.getByText('我的树')).toBeTruthy())
    expect(screen.getByText('原来我只是累了')).toBeTruthy()

    fireEvent.click(screen.getByText('删除'))
    await waitFor(() => expect(screen.getByText('还没有年轮。')).toBeTruthy())
  })

  it('宣泄工坊：纸团揉皱撕碎 → 微风平息 → 自选转念或留年轮', async () => {
    boot()
    await expressAndSubmit('项目被评审否决了')

    fireEvent.click(screen.getByText('先歇一会儿'))
    await waitFor(() => expect(screen.getByText('情绪宣泄工坊')).toBeTruthy())
    expect(screen.getByText('项目被评审否决了')).toBeTruthy()

    // 揉成纸团
    fireEvent.click(screen.getByText('揉成纸团'))
    await waitFor(() => expect(screen.getByText('用力撕碎吹散')).toBeTruthy())

    // 撕碎吹散
    fireEvent.click(screen.getByText('用力撕碎吹散'))
    await waitFor(() =>
      expect(screen.getByText(/心跳慢下来了吗？如果准备好了，可以换几个视角看清它/)).toBeTruthy(),
    )

    // 平复后提供转念与年轮自选
    expect(screen.getByText('陪我想一想')).toBeTruthy()
    expect(screen.getByText('留下一圈年轮')).toBeTruthy()

    // 点击转念，无缝接回同意门槛
    fireEvent.click(screen.getByText('陪我想一想'))
    await waitFor(() =>
      expect(screen.getByText('接下来会一起检查想法，不会否定你的感受。')).toBeTruthy(),
    )
  })

  it('宣泄工坊：支持在纸团、暴风摇树与木桩凿削之间切换并宣泄', async () => {
    boot()
    await expressAndSubmit('工作压力太大了')

    fireEvent.click(screen.getByText('先歇一会儿'))
    await waitFor(() => expect(screen.getByText('情绪宣泄工坊')).toBeTruthy())

    // 检查玩具切换器胶囊
    expect(screen.getByText('纸团揉碎')).toBeTruthy()
    expect(screen.getByText('暴风摇树')).toBeTruthy()
    expect(screen.getByText('木桩凿削')).toBeTruthy()

    // 切换到暴风摇树
    fireEvent.click(screen.getByText('暴风摇树'))
    await waitFor(() => expect(screen.getByText(/摇晃或狂击掀起暴风/)).toBeTruthy())
    fireEvent.click(screen.getByText('狂击掀风'))
    expect(screen.getByText(/风力等级/)).toBeTruthy()

    // 切换到木桩凿削
    fireEvent.click(screen.getByText('木桩凿削'))
    await waitFor(() => expect(screen.getByText(/敲击凿除负重/)).toBeTruthy())
    fireEvent.click(screen.getByText('挥凿削木'))
    expect(screen.getByText(/已削除负重/)).toBeTruthy()

    // 完成宣泄后进入平息
    fireEvent.click(screen.getByText('好受些了'))
    await waitFor(() =>
      expect(screen.getByText(/心跳慢下来了吗？如果准备好了，可以换几个视角看清它/)).toBeTruthy(),
    )
  })

  it('思考路径：没过同意门槛就不产生任何视角', async () => {
    boot()
    await expressAndSubmit()

    fireEvent.click(screen.getByText('陪我想一想'))
    await waitFor(() =>
      expect(screen.getByText('接下来会一起检查想法，不会否定你的感受。')).toBeTruthy(),
    )

    fireEvent.click(screen.getByText('先不了'))
    await waitFor(() => expect(screen.getByText('先歇一会儿')).toBeTruthy())
    expect(screen.queryByText('守护者：你真正想保护的需求或边界是什么？')).toBeNull()
  })

  it('思考路径：同意之后三视角与折返镜逐角出现', async () => {
    boot()
    await expressAndSubmit()
    fireEvent.click(screen.getByText('陪我想一想'))
    await waitFor(() => expect(screen.getByText('继续')).toBeTruthy())

    fireEvent.click(screen.getByText('继续'))
    await waitFor(() => expect(screen.getByText('守护者视角')).toBeTruthy())
    expect(screen.getByText('你有没有想过另一种可能？')).toBeTruthy()
    expect(screen.queryByText('这次没能生成')).toBeNull()
  })

  it('思考层失败时只显示未完成，不填示例稿', async () => {
    boot({ consentOk: false })
    await expressAndSubmit()
    fireEvent.click(screen.getByText('陪我想一想'))
    await waitFor(() => expect(screen.getByText('继续')).toBeTruthy())

    fireEvent.click(screen.getByText('继续'))
    await waitFor(() => expect(screen.getByText('这次没能生成')).toBeTruthy())
    expect(screen.queryByText('守护者视角')).toBeNull()
    expect(screen.getByText(/没有用示例稿顶上/)).toBeTruthy()
  })

  it('L1：只出危机支持，不出休息卡也不出思考入口', async () => {
    boot({ level: 'L1' })
    fireEvent.change(screen.getByPlaceholderText('写一句就好，不用讲完整'), {
      target: { value: '我不想活了' },
    })
    fireEvent.click(screen.getByText('说完了'))

    await waitFor(() => expect(screen.getByText('先停在这里')).toBeTruthy())
    expect(screen.queryByText('先歇一会儿')).toBeNull()
    expect(screen.queryByText('陪我想一想')).toBeNull()
    expect(screen.getByText(/不会编造任何号码/)).toBeTruthy()
  })

  it('危机更正：更正后能休息，但思考入口仍然没有', async () => {
    boot({ level: 'L1' })
    fireEvent.change(screen.getByPlaceholderText('写一句就好，不用讲完整'), {
      target: { value: '我不想活了' },
    })
    fireEvent.click(screen.getByText('说完了'))
    await waitFor(() => expect(screen.getByText('先停在这里')).toBeTruthy())

    fireEvent.click(screen.getByText('我说的不是这个意思'))
    await waitFor(() => expect(screen.getByText('先歇一会儿')).toBeTruthy())
    expect(screen.queryByText('陪我想一想')).toBeNull()
  })

  it('思考路径保存年轮：「再说一件」回到表达页', async () => {
    boot()
    await expressAndSubmit()
    fireEvent.click(screen.getByText('陪我想一想'))
    await waitFor(() => expect(screen.getByText('继续')).toBeTruthy())
    fireEvent.click(screen.getByText('继续'))
    await waitFor(() => expect(screen.getByText('守护者视角')).toBeTruthy())

    fireEvent.click(screen.getByText('留下一圈年轮'))
    await waitFor(() => expect(screen.getByText('陪伴年轮（只要一句观察）')).toBeTruthy())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '我想保护的其实是时间' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(screen.getByText('我想保护的其实是时间')).toBeTruthy())

    fireEvent.click(screen.getByText('再说一件'))
    await waitFor(() =>
      expect(screen.getByText('今天想放下的，是心事，还是事情？')).toBeTruthy(),
    )
  })

  it('全空白时「说完了」是禁用的，点不动也进不了下一幕', async () => {
    boot()
    const button = screen.getByText('说完了') as HTMLButtonElement
    expect(button.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('写一句就好，不用讲完整'), { target: { value: '   ' } })
    expect(button.disabled).toBe(true)

    fireEvent.click(button)
    expect(screen.queryByText('先歇一会儿')).toBeNull()
    // 注：hook 里那句「空白提交不会开始一次表达」目前在界面上够不着——按钮先一步禁用了。
    // 让它可达属于另一张票（#5 的「空白提交就地提示」），本次重构只如实锁定现状。
  })

  it('多维认知重塑：事实剥离、苏格拉底反问并采纳微实验为行动年轮', async () => {
    boot()
    await expressAndSubmit()
    fireEvent.click(screen.getByText('陪我想一想'))
    await waitFor(() => expect(screen.getByText('继续')).toBeTruthy())
    fireEvent.click(screen.getByText('继续'))

    // 验证客观事实与主观脑补剥离
    await waitFor(() => expect(screen.getByText(/客观事实发生/)).toBeTruthy())
    expect(screen.getByText('方案未通过并收到2条反馈')).toBeTruthy()
    expect(screen.getByText(/主观脑补推论/)).toBeTruthy()
    expect(screen.getByText('他们全盘否定我，我彻底搞砸了')).toBeTruthy()
    expect(screen.getByText('灾难化')).toBeTruthy()

    // 验证苏格拉底反问
    expect(screen.getByText(/守护者反问：你最想守护的核心边界是什么？/)).toBeTruthy()

    // 验证微实验卡片与一键采纳
    expect(screen.getByText(/5 分钟微行动实验建议/)).toBeTruthy()
    expect(screen.getByText(/明天只找导师核实第一条修改建议/)).toBeTruthy()
    fireEvent.click(screen.getByText('采纳微实验留年轮'))


    // 验证跳转到行动年轮确认，并预填行动与指标
    await waitFor(() => expect(screen.getByText('行动年轮（带小行动）')).toBeTruthy())
    expect(screen.getByDisplayValue('明天只找导师核实第一条修改建议')).toBeTruthy()
    expect(screen.getByDisplayValue('得到明确边界结论并记录在笔记中')).toBeTruthy()

    // 保存行动年轮
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(screen.getByText(/明天只找导师核实第一条修改建议/)).toBeTruthy())
  })
})

