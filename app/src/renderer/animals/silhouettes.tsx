/**
 * 八只动物的剪影。
 *
 * 为什么要剪影而不是精细插画：现有美术是一套手写 SVG 的纸艺剪纸风格
 * （见 paper/PaperForest.tsx，1600+ 行）。在同一个体系里再塞八只精细动物
 * 既不现实、风格也会打架；而**剪影恰好与剪纸同源**。
 *
 * 辨识度靠三件事，不靠细节：
 *   1. **体型**——鹿高、熊大、刺猬矮圆、猫头鹰圆墩；
 *   2. **姿态**——狐狸低伏欲行、鹿挺立有角、乌龟贴地圆壳、鸟立枝头；
 *   3. **颜色**——每只一个色相，都在纸艺那套暖色调里。
 *
 * 每只都画在 0..100 的方框里，基线（脚/地面接触线）统一在 y=100，
 * 这样摆放时只需要一个缩放系数，不用逐只调偏移。
 */
export type AnimalId =
  | 'fox'
  | 'owl'
  | 'bear'
  | 'deer'
  | 'hedgehog'
  | 'turtle'
  | 'raccoon'
  | 'bird'
  | 'squirrel'
  | 'crow'
  | 'badger'
  | 'rabbit'

export interface AnimalSpec {
  id: AnimalId
  /** 名字，用户可在设置里改 */
  name: string
  /** 它关心什么（默认值，用户可在设置里改） */
  concern: string
  /** 剪影色。都在纸艺那套暖色里，避免跳出背景 */
  color: string
  /** 在原框里的自然高度（0..100），用来拉开体型差 */
  naturalHeight: number
}

export const ANIMALS: AnimalSpec[] = [
  { id: 'fox', name: '灵狐', concern: '打破前提假设，寻找可撤回的小尝试', color: '#c8642d', naturalHeight: 52 },
  { id: 'owl', name: '猫头鹰', concern: '剥离猜想，厘清现实事实', color: '#6e5d4f', naturalHeight: 48 },
  { id: 'bear', name: '棕熊', concern: '守护精力与心理安全底线，允许说不', color: '#543d31', naturalHeight: 74 },
  { id: 'deer', name: '白鹿', concern: '无条件接纳，允许难过与慌乱发生', color: '#c29b72', naturalHeight: 88 },
  { id: 'hedgehog', name: '刺猬', concern: '分清事实与恐惧，别被脑补扎到', color: '#615243', naturalHeight: 32 },
  { id: 'turtle', name: '乌龟', concern: '拉开三年时空纵深，岁月释怀从容', color: '#4f6848', naturalHeight: 36 },
  { id: 'raccoon', name: '小浣熊', concern: '明天抽 5 分钟做个微实验，行动破死锁', color: '#82807c', naturalHeight: 46 },
  { id: 'bird', name: '青鸟', concern: '风过树梢，落叶归根，把烦恼交给山林', color: '#588b94', naturalHeight: 40 },
]

/**
 * 一只动物的剪影。所有形状都是原语（椭圆/多边形/路径），拼出可辨识的轮廓。
 * `accent` 是纸底色，用来在实心剪影上"挖"出眼睛这类细节（剪纸里就是镂空）。
 */
export function Silhouette({ id, color, accent }: { id: AnimalId; color: string; accent: string }) {
  switch (id) {
    case 'fox':
      // 低伏欲行：身体长、头前伸、大尾巴拖在身后
      return (
        <g fill={color}>
          <ellipse cx="46" cy="76" rx="24" ry="13" />
          <ellipse cx="70" cy="62" rx="11" ry="10" />
          <polygon points="62,54 66,38 71,52" />
          <polygon points="72,52 79,38 82,54" />
          <path d="M24 76 C10 74 4 60 10 48 C14 62 22 68 30 70 Z" />
          <rect x="34" y="86" width="4" height="14" rx="2" />
          <rect x="46" y="86" width="4" height="14" rx="2" />
          <rect x="58" y="86" width="4" height="14" rx="2" />
          <circle cx="73" cy="60" r="1.8" fill={accent} />
          <polygon points="80,64 86,66 80,68" fill={accent} />
        </g>
      )
    case 'owl':
      // 圆墩、耳簇、大眼睛镂空
      return (
        <g fill={color}>
          <ellipse cx="50" cy="66" rx="20" ry="26" />
          <polygon points="36,46 32,30 44,42" />
          <polygon points="64,46 68,30 56,42" />
          <path d="M22 92 L78 92 L78 96 L22 96 Z" />
          <rect x="34" y="90" width="3" height="8" />
          <rect x="63" y="90" width="3" height="8" />
          <circle cx="42" cy="58" r="6.5" fill={accent} />
          <circle cx="58" cy="58" r="6.5" fill={accent} />
          <circle cx="42" cy="58" r="2.6" fill={color} />
          <circle cx="58" cy="58" r="2.6" fill={color} />
          <polygon points="50,64 46,70 54,70" fill={accent} />
        </g>
      )
    case 'bear':
      // 魁梧厚重、大圆体型、厚脚掌、圆耳、胸前新月印
      return (
        <g fill={color}>
          <ellipse cx="45" cy="65" rx="28" ry="20" />
          <ellipse cx="72" cy="50" rx="14" ry="12" />
          <circle cx="68" cy="38" r="4.2" />
          <circle cx="78" cy="39" r="4.2" />
          <path d="M78 46 L88 52 L78 56 Z" />
          <rect x="25" y="75" width="8" height="25" rx="4" />
          <rect x="39" y="75" width="8" height="25" rx="4" />
          <rect x="55" y="75" width="8" height="25" rx="4" />
          <rect x="67" y="75" width="8" height="25" rx="4" />
          <circle cx="76" cy="48" r="2.2" fill={accent} />
          <path d="M58 56 C54 62 48 64 42 65 C46 62 50 58 52 54 Z" fill={accent} />
        </g>
      )
    case 'deer':
      // 鹿角分枝 + 细腿挺立
      return (
        <g fill={color}>
          <ellipse cx="46" cy="54" rx="21" ry="10" />
          <path d="M60 50 L64 38 L70 36 L72 42 L68 46 L68 54 Z" />
          <ellipse cx="71" cy="36" rx="8" ry="5.5" />
          <path d="M77 35 L86 38 L77 41 Z" />
          <path
            d="M67 31 L62 16 M62 16 L56 10 M62 16 L63 8 M62 16 L69 12 M67 31 L74 20 M74 20 L80 16 M74 20 L73 12"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="32" y="62" width="3.6" height="38" rx="1.8" />
          <rect x="42" y="62" width="3.6" height="38" rx="1.8" />
          <rect x="54" y="62" width="3.6" height="38" rx="1.8" />
          <rect x="62" y="62" width="3.6" height="38" rx="1.8" />
          <circle cx="76" cy="35" r="1.6" fill={accent} />
        </g>
      )
    case 'hedgehog':
      // 半圆身躯，背部一排尖刺
      return (
        <g fill={color}>
          <path d="M18 96 C18 74 32 60 50 60 C68 60 82 74 82 96 Z" />
          <path
            d="M20 84 L14 74 L26 80 L24 66 L34 76 L36 60 L44 72 L50 56 L56 72 L64 60 L66 76 L76 66 L74 80 L86 74 L80 84"
            stroke={color}
            strokeWidth="3"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M80 92 L92 94 L80 98 Z" />
          <circle cx="86" cy="92" r="1.6" fill={accent} />
        </g>
      )
    case 'turtle':
      // 穹顶圆壳、短腿、伸头、壳纹
      return (
        <g fill={color}>
          <path d="M22 95 C18 70 34 52 52 52 C70 52 86 70 82 95 Z" />
          <rect x="26" y="90" width="10" height="10" rx="4" />
          <rect x="68" y="90" width="10" height="10" rx="4" />
          <ellipse cx="86" cy="80" rx="8" ry="6" />
          <circle cx="88" cy="78" r="1.6" fill={accent} />
          <path d="M42 66 L52 60 L62 66 L62 78 L52 84 L42 78 Z" stroke={accent} strokeWidth="2" fill="none" />
        </g>
      )
    case 'raccoon':
      // 面具眼罩、环形尾、小爪
      return (
        <g fill={color}>
          <ellipse cx="44" cy="74" rx="20" ry="14" />
          <ellipse cx="64" cy="62" rx="11" ry="10" />
          <polygon points="56,54 58,42 64,52" />
          <polygon points="66,52 72,42 74,54" />
          <path d="M25 76 C12 70 4 54 8 40 C14 54 20 62 28 68 Z" />
          <path d="M14 62 L18 56 M10 50 L16 46" stroke={accent} strokeWidth="2.5" />
          <rect x="34" y="84" width="4" height="16" rx="2" />
          <rect x="44" y="84" width="4" height="16" rx="2" />
          <rect x="56" y="84" width="4" height="16" rx="2" />
          <path d="M60 62 C64 56 70 56 74 60 C70 64 64 64 60 62 Z" fill={accent} />
          <circle cx="67" cy="60" r="1.6" fill={color} />
        </g>
      )
    case 'bird':
      // 灵巧立枝、尖喙、燕尾
      return (
        <g fill={color}>
          <ellipse cx="46" cy="68" rx="16" ry="12" />
          <circle cx="62" cy="56" r="8.5" />
          <polygon points="70,54 80,57 70,60" />
          <path d="M32 66 L16 78 L28 82 Z" />
          <rect x="42" y="78" width="2" height="14" />
          <rect x="50" y="78" width="2" height="14" />
          <circle cx="64" cy="54" r="1.5" fill={accent} />
          <path d="M38 64 C44 56 52 56 54 62 C48 68 40 68 38 64 Z" fill={accent} opacity=".4" />
        </g>
      )
    case 'squirrel':
      return (
        <g fill={color}>
          <path d="M40 100 C28 100 24 86 28 74 C32 64 42 60 50 62 C58 64 62 74 60 84 C58 94 52 100 40 100 Z" />
          <ellipse cx="60" cy="58" rx="10" ry="8.5" />
          <polygon points="54,52 55,46 60,51" />
          <polygon points="62,50 67,46 67,53" />
          <path d="M34 92 C16 92 6 78 8 60 C10 44 20 30 34 24 C24 34 20 46 22 58 C24 72 30 82 42 86 Z" />
          <path d="M34 24 C42 20 50 24 52 34 C48 30 42 28 34 30 Z" />
          <ellipse cx="50" cy="74" rx="5" ry="4" />
          <circle cx="64" cy="56" r="1.6" fill={accent} />
        </g>
      )
    case 'crow':
      return (
        <g fill={color}>
          <ellipse cx="48" cy="70" rx="17" ry="13" />
          <circle cx="66" cy="56" r="9" />
          <polygon points="74,54 86,58 74,61" />
          <path d="M34 66 L14 78 L32 82 Z" />
          <rect x="42" y="82" width="2.6" height="18" />
          <rect x="54" y="82" width="2.6" height="18" />
          <path d="M38 100 L60 100" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="69" cy="54" r="1.6" fill={accent} />
        </g>
      )
    case 'badger':
      return (
        <g fill={color}>
          <path d="M20 84 L24 74 L74 74 C80 74 84 78 86 82 L86 92 L20 92 Z" />
          <path d="M82 78 L98 86 L82 92 Z" />
          <rect x="28" y="90" width="6" height="10" rx="2" />
          <rect x="44" y="90" width="6" height="10" rx="2" />
          <rect x="62" y="90" width="6" height="10" rx="2" />
          <circle cx="88" cy="84" r="1.8" fill={accent} />
          <path d="M56 76 L88 82" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'rabbit':
      return (
        <g fill={color}>
          <ellipse cx="48" cy="82" rx="18" ry="14" />
          <circle cx="66" cy="70" r="9" />
          <ellipse cx="60" cy="50" rx="3.6" ry="15" transform="rotate(-14 60 50)" />
          <ellipse cx="69" cy="49" rx="3.6" ry="15" transform="rotate(6 69 49)" />
          <circle cx="32" cy="80" r="7" />
          <ellipse cx="44" cy="95" rx="13" ry="4" />
          <circle cx="69" cy="68" r="1.6" fill={accent} />
        </g>
      )
  }
}
