/**
 * 常驻的树冠。固定 SVG，形态长期稳定——不因情绪好坏增减枝叶。
 * 它不是「我的树」那一页；那一页是 scenes/MyTree.tsx。
 */
export default function TreeCrest() {
  return (
    <div className="tree" aria-hidden="true">
      <svg viewBox="0 0 128 142" role="presentation">
        <defs>
          <linearGradient id="crestLeaf" x1="0.15" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#aecb93" />
            <stop offset="48%" stopColor="#82a26c" />
            <stop offset="100%" stopColor="#4f6d46" />
          </linearGradient>
          <linearGradient id="crestLeafLit" x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#d3e3bd" />
            <stop offset="100%" stopColor="#9dbb84" />
          </linearGradient>
          <linearGradient id="crestTrunk" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b09272" />
            <stop offset="55%" stopColor="#8c7357" />
            <stop offset="100%" stopColor="#6b5741" />
          </linearGradient>
        </defs>

        <ellipse cx="64" cy="136" rx="26" ry="3.5" fill="rgba(70,96,62,.14)" />

        <path
          d="M63 136 c-5 -7 -12 -10 -18 -14 M63 108 c6 -7 14 -11 20 -15"
          fill="none" stroke="url(#crestTrunk)" strokeWidth="2.4" strokeLinecap="round" opacity="0.9"
        />
        <path d="M61 136 V94 c0 -8 1.4 -11 3 -11 s3 3 3 11 V136 Z" fill="url(#crestTrunk)" />

        <circle cx="36" cy="76" r="17" fill="url(#crestLeaf)" opacity="0.9" />
        <circle cx="93" cy="72" r="16" fill="url(#crestLeaf)" opacity="0.88" />
        <circle cx="62" cy="88" r="22" fill="url(#crestLeaf)" />
        <circle cx="44" cy="52" r="17" fill="url(#crestLeaf)" opacity="0.94" />
        <circle cx="84" cy="49" r="15" fill="url(#crestLeaf)" opacity="0.9" />
        <circle cx="63" cy="38" r="18" fill="url(#crestLeaf)" />
        <circle cx="30" cy="62" r="11" fill="url(#crestLeaf)" opacity="0.82" />
        <circle cx="100" cy="58" r="10" fill="url(#crestLeaf)" opacity="0.8" />
        <circle cx="64" cy="19" r="10" fill="url(#crestLeaf)" opacity="0.92" />

        <circle cx="54" cy="32" r="10" fill="url(#crestLeafLit)" opacity="0.5" />
        <circle cx="42" cy="48" r="7" fill="url(#crestLeafLit)" opacity="0.38" />
        <circle cx="76" cy="42" r="5" fill="url(#crestLeafLit)" opacity="0.3" />
      </svg>
    </div>
  )
}
