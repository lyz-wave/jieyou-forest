import { useState } from 'react'

/** 烦恼落叶：纯前端确定性互动，不联网、不调模型、结束时不删除任何数据。 */
export default function LeafCard() {
  const [falling, setFalling] = useState(false)

  const drop = (): void => {
    setFalling(true)
    setTimeout(() => setFalling(false), 1200)
  }

  return (
    <div className="card">
      <strong>烦恼落叶</strong>
      <p className="muted">先把它放在这里，不是让它消失。</p>
      <span className={falling ? 'leaf falling' : 'leaf'}>🍃</span>
      <div>
        <button className="ghost" onClick={drop}>让它落下</button>
      </div>
    </div>
  )
}
