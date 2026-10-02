import { useState } from 'react'

/** 烦恼落叶：纯前端确定性互动，不联网、不调模型、结束时不删除任何数据。 */
export default function LeafCard() {
  const [falling, setFalling] = useState(false)

  const drop = (): void => {
    setFalling(true)
    setTimeout(() => setFalling(false), 1400)
  }

  return (
    <div className="card">
      <strong>烦恼落叶</strong>
      <p className="muted">先把它放在这里，不是让它消失。</p>
      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <span className={falling ? 'leaf falling' : 'leaf'} aria-label="一片纸雕落叶">
          <svg viewBox="-14 -14 28 28" width="46" height="46" style={{ filter: 'drop-shadow(1px 4px 5px rgba(58,38,18,0.28))' }}>
            <path
              fill="#c8642d"
              d="M0 -12 C6 -8 8 2 0 12 C-8 2 -6 -8 0 -12 Z"
            />
            <path
              fill="#d9a45b"
              opacity="0.8"
              d="M0 -11 C4 -7 5 1 0 10 C-1 6 -1 0 0 -11 Z"
            />
            <path
              d="M0 -10 V10 M0 -4 L4 -1 M0 2 L5 5 M0 -1 L-4 2 M0 5 L-4 8"
              fill="none"
              stroke="rgba(255, 246, 226, 0.75)"
              strokeWidth="0.8"
            />
          </svg>
        </span>
      </div>
      <div>
        <button className="ghost" onClick={drop}>让它落下</button>
      </div>
    </div>
  )
}
