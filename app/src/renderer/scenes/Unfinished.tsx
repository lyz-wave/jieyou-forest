import type { SessionController } from '../useSession'

const COPY: Record<string, string> = {
  unavailable: '模型未配置，这次没能生成。你可以重试，也可以先回去休息。',
  timeout: '生成超时了，这次没能完成。可以重试，也可以先回去休息。',
  invalid: '生成的内容里引用了你没说过的话，已经整次丢弃。可以重试。',
  no_consent: '没有同意记录，不能进入这一步。',
}

/** 思考层失败时界面唯一合法的表现：不填示例稿。 */
export default function Unfinished({ s }: { s: SessionController }) {
  return (
    <div className="card">
      <h1>这次没能生成</h1>
      <p>{COPY[s.reason] ?? COPY.invalid}</p>
      <p className="muted">没有用示例稿顶上——思考这一步拿不到就是拿不到。</p>
      <button className="primary" onClick={s.consent}>重试</button>{' '}
      <button className="ghost" onClick={() => s.go('rest')}>去休息</button>
    </div>
  )
}
