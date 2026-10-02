/**
 * 常驻的树冠。固定 SVG，形态长期稳定——不因情绪好坏增减枝叶。
 * 它不是「我的树」那一页；那一页是 scenes/MyTree.tsx。
 */
export default function TreeCrest() {
  return (
    <div className="tree" aria-hidden="true">
      <svg viewBox="0 0 120 136" role="presentation">
        <defs>
          <linearGradient id="crestLeaf" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#9ab884" />
            <stop offset="100%" stopColor="#5d7f4d" />
          </linearGradient>
          <linearGradient id="crestTrunk" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9d8261" />
            <stop offset="100%" stopColor="#786046" />
          </linearGradient>
        </defs>

        <ellipse cx="60" cy="131" rx="26" ry="4" fill="rgba(77,105,68,.16)" />
        <path d="M57.5 130 V88 q0 -9 2.5 -9 t2.5 9 V130 Z" fill="url(#crestTrunk)" />
        <circle cx="34" cy="66" r="22" fill="url(#crestLeaf)" opacity="0.9" />
        <circle cx="86" cy="66" r="22" fill="url(#crestLeaf)" opacity="0.9" />
        <circle cx="60" cy="34" r="23" fill="url(#crestLeaf)" opacity="0.96" />
        <circle cx="60" cy="58" r="32" fill="url(#crestLeaf)" />
      </svg>
    </div>
  )
}
