import { useEffect, useState } from 'react'

const EMOTIONS = ['生气', '难过', '焦虑', '委屈', '疲惫', '平静', '说不清']

interface Caps { canRest: boolean; canReflect: boolean; canShowCrisis: boolean }
interface Ring {
  id: string; type: 'support' | 'action'; user_note: string; action: string | null
  criterion: string | null; review_due: string | null; created_at: string
}
interface ForestApi {
  submit(p: { input: string; emotion?: string }): Promise<{ sessionId: string; capabilities: Caps; banner: string | null }>
  retryReceive(p: { sessionId: string }): Promise<{ banner: string | null }>
  correct(p: { sessionId: string }): Promise<{ level: string; capabilities: Caps }>
  choosePath(p: { sessionId: string; path: 'rest' | 'reflect' }): Promise<{ status: string }>
  consent(p: { sessionId: string }): Promise<{ ok: boolean; reason?: string }>
  cancelReflect(p: { sessionId: string }): Promise<{ status: string }>
  saveRing(p: unknown): Promise<{ ringId: string }>
  listRings(): Promise<Ring[]>
  deleteRing(p: { id: string }): Promise<{ deleted: boolean; stillReadable: boolean }>
  onReceive(cb: (p: { delta: string; done: boolean }) => void): () => void
  onReflection(cb: (p: { card: string; delta: string; done: boolean }) => void): () => void
}
declare global { interface Window { forest: ForestApi } }

type Scene = 'express' | 'space' | 'crisis' | 'rest' | 'consent' | 'reflect' | 'unfinished' | 'save' | 'tree'

export default function App() {
  const [scene, setScene] = useState<Scene>('express')
  const [input, setInput] = useState('')
  const [emotion, setEmotion] = useState<string>()
  const [sessionId, setSessionId] = useState('')
  const [caps, setCaps] = useState<Caps>({ canRest: true, canReflect: true, canShowCrisis: false })
  const [banner, setBanner] = useState<string | null>(null)
  const [receive, setReceive] = useState('')
  const [cards, setCards] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [kind, setKind] = useState<'support' | 'action'>('support')
  const [saveOriginal, setSaveOriginal] = useState(false)
  const [action, setAction] = useState('')
  const [criterion, setCriterion] = useState('')
  const [reviewDue, setReviewDue] = useState('')
  const [rings, setRings] = useState<Ring[]>([])
  const [notice, setNotice] = useState('')
  const [leafFalling, setLeafFalling] = useState(false)

  useEffect(() => {
    const off1 = window.forest.onReceive((p) => setReceive((t) => t + p.delta))
    const off2 = window.forest.onReflection((p) => setCards((c) => ({ ...c, [p.card]: p.delta })))
    return () => { off1(); off2() }
  }, [])

  const onLeaf = (): void => {
    setLeafFalling(true)
    setTimeout(() => setLeafFalling(false), 1200)
  }

  async function submit(): Promise<void> {
    if (!input.trim()) { setNotice('空白提交不会开始一次表达'); return }
    setNotice('')
    const r = await window.forest.submit({ input, emotion })
    setSessionId(r.sessionId)
    setCaps(r.capabilities)
    setBanner(r.banner)
    setScene(r.capabilities.canShowCrisis ? 'crisis' : 'space')
  }

  async function choose(path: 'rest' | 'reflect'): Promise<void> {
    await window.forest.choosePath({ sessionId, path })
    setScene(path === 'rest' ? 'rest' : 'consent')
  }

  async function consent(): Promise<void> {
    const r = await window.forest.consent({ sessionId })
    if (r.ok) setScene('reflect')
    else { setReason(r.reason ?? 'invalid'); setScene('unfinished') }
  }

  async function save(): Promise<void> {
    const idempotencyKey = sessionId + ':' + kind + ':' + note
    await window.forest.saveRing({
      sessionId,
      idempotencyKey,
      draft: {
        type: kind, userNote: note, saveOriginal,
        originalText: saveOriginal ? input : undefined,
        action: action || undefined, criterion: criterion || undefined, reviewDue: reviewDue || undefined,
      },
    })
    await openTree()
  }

  async function openTree(): Promise<void> {
    setRings(await window.forest.listRings())
    setScene('tree')
  }

  const unfinishedCopy: Record<string, string> = {
    unavailable: '模型未配置，这次没能生成。你可以重试，也可以先回去休息。',
    timeout: '生成超时了，这次没能完成。可以重试，也可以先回去休息。',
    invalid: '生成的内容里引用了你没说过的话，已经整次丢弃。可以重试。',
    no_consent: '没有同意记录，不能进入这一步。',
  }

  return (
    <div className="shell">
      <div className="tree">🌳</div>

      {scene === 'express' && (
        <>
          <h1>今天想放下的，是心事，还是事情？</h1>
          <p className="sub">先安放情绪，再看清问题。你可以只歇一会儿，不必每次都成长。</p>
          <textarea
            value={input}
            maxLength={2000}
            placeholder="写一句就好，不用讲完整"
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="row">
            {EMOTIONS.map((e) => (
              <button key={e} className="chip" aria-pressed={emotion === e}
                onClick={() => setEmotion(emotion === e ? undefined : e)}>{e}</button>
            ))}
          </div>
          <p className="muted">标签只是给你自己看的，随时可以改。默认不保存原文。</p>
          <button className="primary" onClick={submit} disabled={!input.trim()}>说完了</button>
          {notice && <p className="muted">{notice}</p>}
        </>
      )}

      {scene === 'crisis' && (
        <div className="card crisis">
          <h1>先停在这里</h1>
          <p>你写下的内容里，有一些需要被人当面接住的东西。这会儿不适合继续做任何练习或思考。</p>
          <p>如果你正处在即时危险中，请联系当地的紧急服务，或找一个你现在能联系上的、信得过的人。</p>
          <p className="muted">地区求助资源需要赛前核验后填入（见架构文档 §9 未决项）。在有人认领并核验之前，这里不会编造任何号码。</p>
          <p className="muted">如果你说的不是这个意思，可以更正——但更正之后仍然只会回到休息，不会进入思考。</p>
          <button className="ghost" onClick={async () => {
            const r = await window.forest.correct({ sessionId })
            setCaps(r.capabilities); setScene('space')
          }}>我说的不是这个意思</button>
        </div>
      )}

      {scene === 'space' && (
        <>
          {banner && <div className="banner">{banner}</div>}
          <div className="card">{receive || '……'}</div>
          <div className="row">
            {caps.canRest && <button className="primary" onClick={() => choose('rest')}>先歇一会儿</button>}
            {caps.canReflect
              ? <button className="ghost" onClick={() => choose('reflect')}>陪我想一想</button>
              : <span className="muted">这次先不进入思考。你可以随时去休息。</span>}
            <button className="ghost" onClick={() => setScene('express')}>今天先到这里</button>
          </div>
          {!banner && <button className="ghost" onClick={async () => {
            const r = await window.forest.retryReceive({ sessionId }); setBanner(r.banner)
          }}>重试这次回应</button>}
        </>
      )}

      {scene === 'rest' && (
        <>
          <h2 style={{ fontSize: 16 }}>两张卡，随便挑，随时能换</h2>
          <div className="card">
            <strong>烦恼落叶</strong>
            <p className="muted">先把它放在这里，不是让它消失。</p>
            <span className={leafFalling ? 'leaf falling' : 'leaf'}>🍃</span>
            <div><button className="ghost" onClick={onLeaf}>让它落下</button></div>
          </div>
          <div className="card">
            <strong>感官停顿</strong>
            <p className="muted">找一个你看得到的颜色、一个听得到的声音，或者脚下的触感。任选一个，也可以跳过。</p>
            <div className="row">
              <button className="chip">一个颜色</button>
              <button className="chip">一个声音</button>
              <button className="chip">脚下的触感</button>
            </div>
            <p className="muted">约 30–60 秒。不用闭眼，不用憋气，没有评分，也不需要用麦克风。</p>
          </div>
          <button className="primary" onClick={() => setScene('save')}>留下一圈年轮</button>{' '}
          <button className="ghost" onClick={() => setScene('express')}>今天先到这里</button>
        </>
      )}

      {scene === 'consent' && (
        <div className="card">
          <h1>接下来会一起检查想法，不会否定你的感受。</h1>
          <p className="muted">现在想继续吗？</p>
          <button className="primary" onClick={consent}>继续</button>{' '}
          <button className="ghost" onClick={async () => {
            await window.forest.cancelReflect({ sessionId }); setScene('space')
          }}>先不了</button>
        </div>
      )}

      {scene === 'reflect' && (
        <>
          {[['guardian', '守护者：你真正想保护的需求或边界是什么？'],
            ['explorer', '探索者：有没有一个低成本、可撤回的小试验？'],
            ['outsider', '局外人：除了眼前这个解释，还有哪些可能？'],
            ['mirror', '折返镜']].map(([k, title]) => (
            <div className="card" key={k}>
              <strong>{title}</strong>
              <p>{cards[k] || '……'}</p>
            </div>
          ))}
          <button className="primary" onClick={() => setScene('save')}>留下一圈年轮</button>{' '}
          <button className="ghost" onClick={() => setScene('rest')}>先歇一会儿</button>{' '}
          <button className="ghost" onClick={() => setScene('express')}>暂时不留</button>
        </>
      )}

      {scene === 'unfinished' && (
        <div className="card">
          <h1>这次没能生成</h1>
          <p>{unfinishedCopy[reason] ?? unfinishedCopy.invalid}</p>
          <p className="muted">没有用示例稿顶上——思考这一步拿不到就是拿不到。</p>
          <button className="primary" onClick={consent}>重试</button>{' '}
          <button className="ghost" onClick={() => setScene('rest')}>去休息</button>
        </div>
      )}

      {scene === 'save' && (
        <div className="card">
          <strong>留下一圈年轮</strong>
          <div className="row">
            <button className="chip" aria-pressed={kind === 'support'} onClick={() => setKind('support')}>陪伴年轮（只要一句观察）</button>
            <button className="chip" aria-pressed={kind === 'action'} onClick={() => setKind('action')}>行动年轮（带一个小实验）</button>
          </div>
          <label className="field">你自己的一句话</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          {kind === 'action' && (
            <>
              <label className="field">一个小行动</label>
              <input type="text" value={action} onChange={(e) => setAction(e.target.value)} />
              <label className="field">怎么算做到了（可观察的判据）</label>
              <input type="text" value={criterion} onChange={(e) => setCriterion(e.target.value)} />
              <label className="field">什么时候回来看（复盘日）</label>
              <input type="date" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} />
            </>
          )}
          <label className="field">
            <input type="checkbox" checked={saveOriginal} onChange={(e) => setSaveOriginal(e.target.checked)} />{' '}
            同时保存原文
          </label>
          <p className="muted">
            会保留：你这句话、这圈年轮的时间、类型{saveOriginal ? '，以及你写的那段原文' : '（不含原文）'}。
            数据只存在这台电脑上，不加密。
          </p>
          <button className="primary" onClick={save} disabled={!note.trim()}>保存</button>{' '}
          <button className="ghost" onClick={() => setScene('express')}>不保存</button>
        </div>
      )}

      {scene === 'tree' && (
        <>
          <h1>我的树</h1>
          <p className="sub">年轮不因为情绪好坏增减，也不会因为你没来而枯萎。</p>
          {rings.length === 0 && <p className="muted">还没有年轮。</p>}
          <ul className="rings">
            {rings.map((r) => (
              <li key={r.id}>
                <div>{r.user_note}</div>
                <div className="muted">
                  {r.type === 'support' ? '陪伴年轮' : '行动年轮'}
                  {r.review_due ? ' · 复盘日 ' + r.review_due : ''}
                </div>
                <button className="ghost" onClick={async () => {
                  const res = await window.forest.deleteRing({ id: r.id })
                  setNotice(res.stillReadable ? '删除后仍能读到，这是个 bug' : '已删除')
                  await openTree()
                }}>删除</button>
              </li>
            ))}
          </ul>
          {notice && <p className="muted">{notice}</p>}
          <button className="primary" onClick={() => { setInput(''); setReceive(''); setCards({}); setNote(''); setScene('express') }}>
            再说一件
          </button>
        </>
      )}
    </div>
  )
}
