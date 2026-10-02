// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { capabilitiesFor } from '../shared/capabilities'
import type { DiscussionChunk, ForestApi, ReceiveChunk, ReflectionChunk } from '../shared/ipc'
import type { Capabilities, RingDraft, RingRow } from '../shared/types'
import { findResonantRing } from '../shared/resonance'

// 逐幕走一遍的验收测试：拆分渲染层不应该改变任何一步的界面行为。
// 假 API 只实现契约，不碰 Electron，所以它能跑在普通 Node 里。

function makeFakeApi(opts: { level?: 'L1' | 'L2' | 'L3'; consentOk?: boolean; initialRings?: RingRow[] } = {}) {
  const level = opts.level ?? 'L3'
  // 复用真实的映射，避免测试里再维护一份会漂移的三级表
  const capsFor = (): Capabilities => capabilitiesFor(level)

  const receiveListeners: Array<(p: ReceiveChunk) => void> = []
  const reflectionListeners: Array<(p: ReflectionChunk) => void> = []
  const discussionListeners: Array<(p: DiscussionChunk) => void> = []
  const rings: RingRow[] = opts.initialRings ? [...opts.initialRings] : []


  const api: ForestApi = {
    submit: async (p) => {
      receiveListeners.forEach((cb) =>
        cb({ sessionId: 's1', delta: '被这样对待，确实可能让人难受。', done: true }),
      )
      const resonance = p?.input ? findResonantRing(p.input, rings) : null
      return { sessionId: 's1', capabilities: capsFor(), banner: null, resonance }
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
          quotedInput: ['方案未通过'],
          assumptions: ['他们是在全盘否定我'],
          reframedQuestion: '除了这个解释，还有哪些可能？',
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
          promptVersion: 'test',
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
    getModelConfig: async () => ({ baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: 'test-key' }),
    listModels: async () => ({ ok: true, models: ['deepseek-chat', 'deepseek-reasoner'] }),
    saveModelConfig: async () => ({ ok: true }),
    testModelConfig: async () => ({ ok: true, latencyMs: 50, message: '测试成功' }),
    discuss: async (p) => {
      setTimeout(() => {
        discussionListeners.forEach((cb) =>
          cb({ sessionId: p.sessionId, perspective: p.perspective, delta: '这是苏格拉底反问回应', done: true }),
        )
      }, 10)
      return { ok: true, reply: '这是苏格拉底反问回应' }
    },
    transcribe: async () => ({ ok: true, text: '' }),
    onReceive: (cb) => { receiveListeners.push(cb); return () => {} },
    onReflection: (cb) => { reflectionListeners.push(cb); return () => {} },
    onDiscussionDelta: (cb) => {
      discussionListeners.push(cb)
      return () => {
        const i = discussionListeners.indexOf(cb)
        if (i >= 0) discussionListeners.splice(i, 1)
      }
    },
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

    // 验证：可核对的逐字引用 与 标注为推断的模型读法 分开呈现
    await waitFor(() => expect(screen.getByText(/你说过的原话/)).toBeTruthy())
    expect(screen.getByText('方案未通过')).toBeTruthy()
    expect(screen.getByText('💭 折返镜读到的前提')).toBeTruthy()
    expect(screen.getByText('他们是在全盘否定我')).toBeTruthy()
    expect(screen.getByText(/模型的推断，可能不准/)).toBeTruthy()
    // 而且界面上不再出现任何认知扭曲标签（PRD §8.1 不诊断）
    expect(screen.queryByText('灾难化')).toBeNull()

    // 验证苏格拉底反问
    expect(screen.getByText(/守护者反问：你最想守护的核心边界是什么？/)).toBeTruthy()

    // 验证微实验卡片与一键采纳
    expect(screen.getByText(/一个可撤回的小建议/)).toBeTruthy()
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

  it('年轮盘与情绪圈层：交互式木桩截面、分类筛选与圈层详情抽屉展开', async () => {
    const initialRings: RingRow[] = [
      {
        id: 'ring-work-1',
        session_id: 's1',
        type: 'action',
        user_note: '在职场方案里坚持边界',
        save_original: 1,
        original_text: '老板今天又推翻了我的方案，我很焦虑',
        user_decision: '焦虑',
        action: '明天只找导师确认修改清单',
        criterion: '得到明确边界结论',
        review_due: '2026-10-10',
        created_at: '2026-10-02',
        is_demo: 0,
        idempotency_key: 'ring-work-1',
      },
      {
        id: 'ring-rel-2',
        session_id: 's2',
        type: 'support',
        user_note: '和伴侣吵架后允许自己悲伤',
        save_original: 0,
        original_text: null,
        user_decision: '难过',
        action: null,
        criterion: null,
        review_due: null,
        created_at: '2026-10-01',
        is_demo: 0,
        idempotency_key: 'ring-rel-2',
      },
    ]

    boot({ initialRings })
    await expressAndSubmit()
    fireEvent.click(screen.getByText('先歇一会儿'))
    await waitFor(() => expect(screen.getByText('留下一圈年轮')).toBeTruthy())
    fireEvent.click(screen.getByText('留下一圈年轮'))
    await waitFor(() => expect(screen.getByText('看看我的树')).toBeTruthy())
    fireEvent.click(screen.getByText('看看我的树'))
    await waitFor(() => expect(screen.getByText('我的树')).toBeTruthy())


    // 验证截面年轮盘与同心层渲染
    expect(screen.getByLabelText('木桩截面同心年轮盘')).toBeTruthy()
    expect(screen.getByTestId('ring-path-ring-work-1')).toBeTruthy()
    expect(screen.getByTestId('ring-path-ring-rel-2')).toBeTruthy()
    expect(screen.getByText('2 圈')).toBeTruthy()

    // 验证领域分类筛选
    expect(screen.getByText(/职场工作 \(1\)/)).toBeTruthy()
    expect(screen.getByText(/人际亲密 \(1\)/)).toBeTruthy()

    // 点击职场年轮层，验证展开详情抽屉
    fireEvent.click(screen.getByTestId('ring-path-ring-work-1'))
    await waitFor(() => expect(screen.getByTestId('ring-detail-drawer')).toBeTruthy())
    const drawer = screen.getByTestId('ring-detail-drawer')
    expect(within(drawer).getByText('在职场方案里坚持边界')).toBeTruthy()
    expect(within(drawer).getByText(/微行动：/)).toBeTruthy()
    expect(within(drawer).getByText(/明天只找导师确认修改清单/)).toBeTruthy()
    expect(within(drawer).getByText(/可验证判据：/)).toBeTruthy()
    expect(within(drawer).getByText(/当时的心事原文：/)).toBeTruthy()

    // 在详情抽屉中删除该年轮
    fireEvent.click(within(drawer).getByText('删除这圈年轮'))
    await waitFor(() => expect(screen.queryByTestId('ring-path-ring-work-1')).toBeNull())
    expect(screen.getByText('1 圈')).toBeTruthy()
  })

  it('跨时空年轮共鸣智能反哺与个人认知韧性图谱', async () => {
    const initialRings: RingRow[] = [
      {
        id: 'ring-historic-1',
        session_id: 's0',
        type: 'action',
        user_note: '方案被拒不等于全盘否定，明天只核实第一条建议',
        save_original: 1,
        original_text: '方案被导师推翻了，我很绝望',
        user_decision: '焦虑',
        action: '找导师梳理建议',
        criterion: '得到边界反馈',
        review_due: '2026-09-01',
        created_at: '2026-08-20',
        is_demo: 0,
        idempotency_key: 'ring-historic-1',
      },
    ]

    boot({ initialRings })

    // 用户提交带有语义/关键词重叠的新困扰
    await expressAndSubmit('今天我的新方案又被导师否定了，心里很慌很受打击')

    // 验证承接空间中触发并展示「跨时空年轮共鸣」卡片
    await waitFor(() => expect(screen.getByTestId('resonance-card')).toBeTruthy())
    expect(screen.getByText('跨时空年轮共鸣')).toBeTruthy()
    expect(screen.getByText(/方案被拒不等于全盘否定，明天只核实第一条建议/)).toBeTruthy()

    // 点击共鸣卡片的「查看那圈年轮」直达我的树
    fireEvent.click(screen.getByText('查看那圈年轮'))
    await waitFor(() => expect(screen.getByText('我的树')).toBeTruthy())

    // 验证个人认知韧性图谱
    await waitFor(() => expect(screen.getByTestId('resilience-profile')).toBeTruthy())
    expect(screen.getByText('个人认知韧性图谱')).toBeTruthy()
    expect(screen.getByText('总年轮数')).toBeTruthy()
    expect(screen.getByText('微行动突破率')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.getByText('跨领域认知分布')).toBeTruthy()
  })

  it('大模型与中转站设置窗口：配置预设切换、连通性测速与保存', async () => {
    boot()

    // 验证右上角全局模型设置入口
    const settingsBtn = screen.getByLabelText('打开设置')
    expect(settingsBtn).toBeTruthy()
    fireEvent.click(settingsBtn)

    // 弹窗打开
    await waitFor(() => expect(screen.getByText('⚙️ 大模型与中转站设置')).toBeTruthy())

    // 切换厂商预设为硅基流动
    const siliconPreset = screen.getByText('硅基流动')
    fireEvent.click(siliconPreset)

    // 验证输入框中填入的 SiliconFlow 端点
    const baseUrlInput = screen.getByPlaceholderText(/例如 https:\/\/api.deepseek.com\/v1 或中转站地址/) as HTMLInputElement
    expect(baseUrlInput.value).toBe('https://api.siliconflow.cn/v1')

    // 点击测试连通性
    const testBtn = screen.getByText('测试连通性')
    fireEvent.click(testBtn)

    // 验证测试结果展示
    await waitFor(() => expect(screen.getByText(/测试成功/)).toBeTruthy())

    // 点击保存并应用
    const saveBtn = screen.getByText('保存并应用')
    fireEvent.click(saveBtn)
    await waitFor(() => expect(screen.getByText(/已保存并即时热更新/)).toBeTruthy())
  })

  it('在线苏格拉底多轮推敲讨论抽屉与防反刍收敛留年轮', async () => {
    boot()

    // 进入表达并走向思考分支
    await expressAndSubmit('项目上线被延期了，大家可能会觉得我能力不行')
    fireEvent.click(screen.getByText('陪我想一想'))
    await waitFor(() => expect(screen.getByText('继续')).toBeTruthy())
    fireEvent.click(screen.getByText('继续'))

    // 验证三视角卡片加载完成且包含「深入推敲」入口
    await waitFor(() => expect(screen.getByText('守护者')).toBeTruthy())
    const discussButtons = screen.getAllByText('💬 深入推敲')
    expect(discussButtons.length).toBeGreaterThan(0)

    // 点击守护者视角的深入推敲，呼出 DiscussDrawer 抽屉
    fireEvent.click(discussButtons[0])
    await waitFor(() => expect(screen.getByText('守护者 · 深度推敲')).toBeTruthy())

    // 抽屉内包含初始苏格拉底提问（背景卡片与抽屉内各出现一次）
    expect(screen.getAllByText(/守护者反问：你最想守护的核心边界是什么？/).length).toBe(2)

    // 发送一轮对话
    const discussInput = screen.getByPlaceholderText('写下一句回应或困惑...')
    fireEvent.change(discussInput, { target: { value: '我其实最担心的是影响团队进度' } })
    fireEvent.click(screen.getByText('发送'))

    // 验证回复流式到达
    await waitFor(() => expect(screen.getByText(/这是苏格拉底反问回应/)).toBeTruthy())

    // 连续进行多轮对话触发防反刍卡片
    fireEvent.change(discussInput, { target: { value: '如果我今晚加班能不能补回来？' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getAllByText(/这是苏格拉底反问回应/).length).toBe(2))

    fireEvent.change(discussInput, { target: { value: '我还是有点忐忑' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getAllByText(/这是苏格拉底反问回应/).length).toBe(3))

    // 验证防反刍收敛卡片出现
    await waitFor(() => expect(screen.getByText('推敲已触及深处：捕捉到了令你释怀的想法吗？')).toBeTruthy())

    // 点击「以此顿悟留年轮」
    fireEvent.click(screen.getByText('以此顿悟留年轮'))

    // 抽屉关闭并直达年轮确认页面，预填该顿悟
    await waitFor(() => expect(screen.getByText('留下一圈年轮')).toBeTruthy())
    const noteInput = screen.getByLabelText('你自己的一句话') as HTMLInputElement
    expect(noteInput.value).toContain('我还是有点忐忑')
  })
  it('桥接脚本是旧版本时，「获取模型列表」给出可读提示而不是裸 TypeError', async () => {
    const { api } = boot()
    // 复现 pnpm dev 下的真实情况：改 preload 不会热更新，渲染层 HMR 却立刻生效，
    // 于是界面上有新按钮、桥上却没有新方法。
    delete (api as unknown as Record<string, unknown>).listModels

    fireEvent.click(screen.getByLabelText('打开设置'))
    await waitFor(() => expect(screen.getByText('获取模型列表')).toBeTruthy())
    fireEvent.click(screen.getByText('获取模型列表'))

    await waitFor(() => expect(screen.getByText(/获取失败/)).toBeTruthy())
    expect(document.body.textContent).toContain('桥接脚本是旧版本')
    expect(document.body.textContent).toContain('Cmd+R')
  })
})