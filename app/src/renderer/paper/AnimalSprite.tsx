import React from 'react'

export type AnimalSpecies =
  | 'fox'
  | 'owl'
  | 'bear'
  | 'deer'
  | 'hedgehog'
  | 'turtle'
  | 'raccoon'
  | 'bird'

export type AnimalState = 'idle' | 'hop' | 'walk' | 'sit' | 'speak'

export interface AnimalMeta {
  species: AnimalSpecies
  name: string
  title: string
  role: string
  scale: number
  color: string
}

export const ANIMAL_METAS: Record<AnimalSpecies, AnimalMeta> = {
  fox: {
    species: 'fox',
    name: '灵狐',
    title: '探索破局者',
    role: '寻找新转机与小尝试',
    scale: 1.0,
    color: '#c8642d',
  },
  owl: {
    species: 'owl',
    name: '猫头鹰',
    title: '客观事实者',
    role: '剥离猜想，厘清现实事实',
    scale: 0.85,
    color: '#6e5d4f',
  },
  bear: {
    species: 'bear',
    name: '棕熊',
    title: '边界守护者',
    role: '守护精力与心理安全底线',
    scale: 1.35,
    color: '#543d31',
  },
  deer: {
    species: 'deer',
    name: '白鹿',
    title: '温柔接纳者',
    role: '无条件接纳与情绪着陆',
    scale: 1.2,
    color: '#c29b72',
  },
  hedgehog: {
    species: 'hedgehog',
    name: '刺猬',
    title: '脑补审视者',
    role: '审视灾难化与过度防备',
    scale: 0.68,
    color: '#615243',
  },
  turtle: {
    species: 'turtle',
    name: '乌龟',
    title: '时空纵深者',
    role: '拉开三年纵深，从容释怀',
    scale: 0.72,
    color: '#4f6848',
  },
  raccoon: {
    species: 'raccoon',
    name: '小浣熊',
    title: '行动落地派',
    role: '转化 5 分钟微实验抓手',
    scale: 0.9,
    color: '#82807c',
  },
  bird: {
    species: 'bird',
    name: '青鸟',
    title: '超脱转念者',
    role: '如风过树梢，心不染尘',
    scale: 0.62,
    color: '#588b94',
  },
}

interface AnimalSpriteProps {
  species: AnimalSpecies
  state?: AnimalState
  scaleMultiplier?: number
  direction?: 1 | -1
  speaking?: boolean
  speech?: string
  speechTitle?: string
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
}

export default function AnimalSprite({
  species,
  state = 'idle',
  scaleMultiplier = 1,
  direction = 1,
  speaking = false,
  speech,
  speechTitle,
  onClick,
  className = '',
  style = {},
}: AnimalSpriteProps) {
  const meta = ANIMAL_METAS[species]
  const finalScale = meta.scale * scaleMultiplier

  return (
    <div
      className={`animal-sprite-wrap ${species} ${state} ${speaking ? 'is-speaking' : ''} ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* 对话气泡 */}
      {speech && (
        <div
          className="animal-speech-bubble"
          style={{
            position: 'absolute',
            bottom: '108%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 252, 245, 0.96)',
            border: speaking ? '1.5px solid #d49a42' : '1px solid rgba(210, 195, 175, 0.75)',
            boxShadow: speaking
              ? '0 8px 24px -4px rgba(212, 154, 66, 0.35), 0 2px 8px rgba(0,0,0,0.06)'
              : '0 6px 18px -4px rgba(40, 30, 20, 0.12)',
            borderRadius: 14,
            padding: '10px 14px',
            minWidth: 160,
            maxWidth: 260,
            zIndex: 120,
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--ink)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'rise 0.22s cubic-bezier(0.2, 0.9, 0.3, 1) both',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: meta.color,
                letterSpacing: '0.02em',
              }}
            >
              {speechTitle || `${meta.name} · ${meta.title}`}
            </span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{speech}</div>
          {/* 小尾巴指针 */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '7px solid rgba(255, 252, 245, 0.96)',
            }}
          />
        </div>
      )}

      {/* SVG 剪纸矢量主体 */}
      <svg
        viewBox="-110 -100 220 120"
        overflow="visible"
        style={{
          width: 140 * finalScale,
          height: 80 * finalScale,
          transform: `scaleX(${direction})`,
          transition: 'transform 0.28s ease',
          filter: speaking
            ? 'drop-shadow(0 0 10px rgba(212, 154, 66, 0.65)) drop-shadow(0 4px 6px rgba(0,0,0,0.18))'
            : 'drop-shadow(0 3px 5px rgba(0,0,0,0.14))',
        }}
      >
        {renderAnimalGraphic(species)}
      </svg>
    </div>
  )
}

function renderAnimalGraphic(species: AnimalSpecies) {
  switch (species) {
    case 'fox':
      return <FoxGraphic />
    case 'owl':
      return <OwlGraphic />
    case 'bear':
      return <BearGraphic />
    case 'deer':
      return <DeerGraphic />
    case 'hedgehog':
      return <HedgehogGraphic />
    case 'turtle':
      return <TurtleGraphic />
    case 'raccoon':
      return <RaccoonGraphic />
    case 'bird':
      return <BirdGraphic />
  }
}

/** 1. 灵狐 (The Fox) */
function FoxGraphic() {
  return (
    <g>
      {/* 摆动大尾巴 */}
      <g className="pf-fox-tail">
        <path
          className="c-fox"
          d="M-30 -38C-46 -51 -70 -53 -86 -41C-96 -33 -99 -19 -93 -8C-87 -16 -76 -22 -64 -24C-52 -26 -41 -26 -32 -28Z"
        />
        <path
          className="c-foxc"
          d="M-93 -8C-99 -19 -96 -33 -86 -41C-84 -33 -80 -24 -76 -18C-82 -16 -88 -12 -93 -8Z"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 -32 -32;-7 -32 -32;0 -32 -32;4 -32 -32;0 -32 -32"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </g>
      {/* 远侧腿 */}
      <path
        className="c-foxd"
        d="M-22 -24L-15 -24L-16.5 -1H-22.5ZM13 -24L19 -24L18.5 -1H12.5Z"
        opacity=".78"
      />
      {/* 躯干 */}
      <path
        className="c-fox"
        d="M-34 -30C-38 -41 -29 -49 -13 -49.5C3 -50.5 18 -50 28 -44C34 -40 36 -32 32 -24C26 -19 16 -19 8 -21L-20 -21C-28 -21 -33 -24 -34 -30Z"
      />
      {/* 近侧腿 */}
      <path
        className="c-foxd"
        d="M-31.5 -26L-23 -24L-24 -1.5C-21 -1.2 -20 -0 -20 0H-31L-30.5 -2ZM22 -27L29 -27L29.5 -1.5C32 -1 33 0 33 0H23Z"
      />
      {/* 头部与立耳 */}
      <path
        className="c-fox"
        d="M22 -40C24 -48 27 -54 30 -58L28.5 -75L38 -63.5L44 -64L50.5 -77L52.5 -61C56 -57 60.5 -54 66 -51.5C68.5 -50.5 68.5 -47 66 -46C60 -44 54 -43 48 -41C42 -38 36 -34 30 -32Z"
      />
      {/* 白面颊胸毛 */}
      <path
        className="c-foxc"
        d="M40 -48.5C48 -50.5 58 -50.5 66 -46C60 -44 54 -43 48 -41C44 -39 40 -37 35.5 -35C37 -40 38 -45 40 -48.5ZM23.5 -38.5C29 -36.5 33 -35 36 -35.5C34 -30 30 -24.5 24.5 -22.5C22 -28 22 -34 23.5 -38.5Z"
      />
      {/* 耳内暗影 */}
      <path className="c-foxd" d="M31 -70.5L35.8 -63.8L31.6 -62.6ZM49.2 -71.6L50.2 -62.4L46.2 -63.4Z" />
      {/* 灵动眨眼 */}
      <path
        className="c-foxd"
        d="M46.5 -58.2C48.6 -60.4 51.6 -60.4 53.2 -58.4C51 -57.2 48.8 -57.2 46.5 -58.2Z"
      >
        <animateTransform
          attributeName="transform"
          type="scale"
          values="1 1;1 1;1 .1;1 1"
          keyTimes="0;.9;.95;1"
          dur="4.6s"
          repeatCount="indefinite"
          additive="sum"
        />
      </path>
      {/* 鼻头 */}
      <circle className="c-foxd" cx="66.6" cy="-48.6" r="2.4" />
    </g>
  )
}

/** 2. 猫头鹰 (The Owl) */
function OwlGraphic() {
  return (
    <g>
      {/* 爪抓地 */}
      <path className="c-owld" d="M-14 -1L-11 -8L-7 -1H-4ZM5 -1L8 -8L12 -1H15Z" />
      {/* 羽翼躯干 */}
      <path
        className="c-owl"
        d="M-28 -28C-32 -48 -24 -70 0 -70C24 -70 32 -48 28 -28C24 -8 16 0 0 0C-16 0 -24 -8 -28 -28Z"
      />
      {/* 翅膀侧羽（带微摆动） */}
      <g>
        <path
          className="c-owld"
          opacity=".6"
          d="M-26 -48C-38 -32 -32 -10 -22 -4C-24 -16 -24 -32 -22 -42Z"
        />
        <path
          className="c-owld"
          opacity=".6"
          d="M26 -48C38 -32 32 -10 22 -4C24 -16 24 -32 22 -42Z"
        />
        <animateTransform
          attributeName="transform"
          type="scale"
          values="1 1; 1.04 0.98; 1 1"
          dur="3.8s"
          repeatCount="indefinite"
        />
      </g>
      {/* 浅色胸斑羽毛 */}
      <path
        className="c-owlc"
        d="M-18 -32C-14 -46 -6 -52 0 -52C6 -52 14 -46 18 -32C14 -16 6 -8 0 -8C-6 -8 -14 -16 -18 -32Z"
      />
      {/* 独立转动头部 */}
      <g>
        {/* 耳羽角与面盘 */}
        <path
          className="c-owl"
          d="M-22 -62L-26 -82L-12 -68C-5 -70 5 -70 12 -68L26 -82L22 -62C28 -52 24 -42 0 -42C-24 -42 -28 -52 -22 -62Z"
        />
        {/* 双圆心面盘 */}
        <circle className="c-owlc" cx="-10" cy="-56" r="11" />
        <circle className="c-owlc" cx="10" cy="-56" r="11" />
        {/* 瞳孔（带眨眼） */}
        <circle className="c-owld" cx="-9" cy="-56" r="4.2">
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1 1;1 .1;1 1"
            keyTimes="0;.88;.94;1"
            dur="5.2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle className="c-owld" cx="9" cy="-56" r="4.2">
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1 1;1 .1;1 1"
            keyTimes="0;.88;.94;1"
            dur="5.2s"
            repeatCount="indefinite"
          />
        </circle>
        {/* 锐喙 */}
        <path className="c-owld" d="M-3 -54L0 -47L3 -54Z" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 0 -56; -15 0 -56; 0 0 -56; 18 0 -56; 0 0 -56"
          dur="7.4s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  )
}

/** 3. 棕熊 (The Bear) —— 肩峰隆起、粗柱腿、大头碟形脸 */
function BearGraphic() {
  return (
    <g>
      {/* 远侧粗柱腿 */}
      <path className="c-beard" opacity=".78" d="M-32 -16L-34 0H-20L-18 -18ZM22 -18L24 0H36L34 -16Z" />
      {/* 庞大躯干（近 1.7:1，不再拉长成胶囊） */}
      <ellipse className="c-bear" cx="-8" cy="-34" rx="48" ry="25" />
      {/* 标志性肩峰 */}
      <ellipse className="c-bear" cx="24" cy="-50" rx="20" ry="16" />
      {/* 近侧厚腿 */}
      <path className="c-beard" d="M-24 -18L-27 0H-9L-7 -18ZM30 -18L29 0H45L45 -20Z" />
      {/* 胸前新月纹 */}
      <path className="c-bearc" d="M30 -40C26 -33 18 -28 10 -27C18 -24 28 -25 36 -31Z" />
      {/* 大头与碟形脸（呼吸微动效） */}
      <g>
        <ellipse className="c-bear" cx="54" cy="-56" rx="18" ry="15" />
        {/* 圆耳与暗色内廓 */}
        <circle className="c-bear" cx="44" cy="-68" r="5" />
        <circle className="c-bear" cx="62" cy="-69" r="5" />
        <circle className="c-beard" cx="44" cy="-68" r="2.4" />
        <circle className="c-beard" cx="62" cy="-69" r="2.4" />
        {/* 浅色吻部 */}
        <ellipse className="c-bearc" cx="66" cy="-51" rx="9" ry="7" />
        {/* 鼻头与凝视小眼 */}
        <circle className="c-beard" cx="73" cy="-53" r="2.8" />
        <circle className="c-beard" cx="58" cy="-60" r="2.5">
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1 1;1 .1;1 1"
            keyTimes="0;.9;.95;1"
            dur="4.5s"
            repeatCount="indefinite"
          />
        </circle>
        {/* 呼吸微动效 */}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 48 -48; 2 48 -48; 0 48 -48; -1.5 48 -48; 0 48 -48"
          dur="5.6s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  )
}

/** 4. 白鹿 (The Deer) —— 锥形瘦腿、S 形长颈、分叉大角 */
function DeerGraphic() {
  return (
    <g>
      {/* 远侧锥形腿 */}
      <path className="c-deerd" opacity=".78" d="M-24 -20L-23 0H-18L-17 -20ZM14 -20L15 0H20L21 -20Z" />
      {/* 灵秀躯干 */}
      <ellipse className="c-deer" cx="-4" cy="-30" rx="32" ry="14" />
      {/* 近侧鹿腿（上粗下细带蹄） */}
      <path className="c-deerd" d="M-17 -18L-16 0H-11L-10 -18ZM23 -18L24 0H29L30 -18Z" />
      {/* 白腹毛与浅斑 */}
      <ellipse className="c-deerc" cx="-4" cy="-24" rx="24" ry="7" />
      <circle className="c-deerc" cx="-14" cy="-36" r="2.2" />
      <circle className="c-deerc" cx="2" cy="-35" r="2.2" />
      <circle className="c-deerc" cx="15" cy="-33" r="1.8" />
      {/* 短尾 */}
      <path className="c-deerc" d="M-35 -34L-43 -30L-35 -26Z" />
      {/* S 形长颈与秀气的头 */}
      <g>
        <path className="c-deer" d="M20 -36C24 -48 28 -58 34 -66L42 -62C37 -54 33 -44 30 -32Z" />
        <ellipse className="c-deer" cx="46" cy="-66" rx="11" ry="8" transform="rotate(-14 46 -66)" />
        {/* 吻部与黑鼻 */}
        <ellipse className="c-deerc" cx="55" cy="-63" rx="4.5" ry="3.2" />
        <circle className="c-deerd" cx="59" cy="-63" r="1.8" />
        {/* 立耳 */}
        <path className="c-deer" d="M40 -72L34 -82L44 -76Z" />
        {/* 枝状大鹿角 (独立微晃) */}
        <g>
          <path
            className="c-deerd"
            d="M44 -73C42 -82 40 -89 37 -95M41 -83L35 -87M39 -90L33 -94M50 -74C53 -83 55 -90 58 -96M53 -84L59 -88M55 -91L61 -95"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 46 -72; 3 46 -72; 0 46 -72; -2 46 -72; 0 46 -72"
            dur="4.8s"
            repeatCount="indefinite"
          />
        </g>
        {/* 鹿眼 */}
        <circle className="c-deerd" cx="48" cy="-68" r="2.3">
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1 1;1 .1;1 1"
            keyTimes="0;.9;.95;1"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </g>
  )
}

/** 5. 刺猬 (The Hedgehog) */
function HedgehogGraphic() {
  return (
    <g>
      {/* 短小足爪 */}
      <path className="c-hedged" d="M-18 -1H-10L-14 -6ZM12 -1H20L16 -6Z" />
      {/* 背部锯齿状尖刺外廓 */}
      <path
        className="c-hedge"
        d="M-36 -12L-38 -24L-30 -22L-32 -36L-20 -32L-20 -46L-6 -38L-2 -48L10 -38L18 -46L24 -34L34 -38L32 -24L42 -22L36 -12C30 -4 14 0 0 0C-16 0 -30 -4 -36 -12Z"
      />
      {/* 内层深色刺层次 */}
      <path
        className="c-hedged"
        opacity=".45"
        d="M-26 -16L-24 -28L-14 -24L-10 -36L0 -28L8 -36L14 -26L24 -28L20 -16Z"
      />
      {/* 软萌米白面部与口鼻 */}
      <path
        className="c-hedgec"
        d="M20 -14C24 -22 34 -20 40 -16C46 -12 44 -4 34 -2C26 -2 20 -8 20 -14Z"
      />
      {/* 乌黑小圆眼与圆鼻 */}
      <circle className="c-hedged" cx="32" cy="-12" r="2.2">
        <animateTransform
          attributeName="transform"
          type="scale"
          values="1 1;1 1;1 .1;1 1"
          keyTimes="0;.9;.95;1"
          dur="3.8s"
          repeatCount="indefinite"
        />
      </circle>
      <circle className="c-hedged" cx="41" cy="-14" r="2.4" />
    </g>
  )
}

/** 6. 乌龟 (The Turtle) —— 高穹壳、四足撑地、探头伸颈、小尾巴 */
function TurtleGraphic() {
  return (
    <g>
      {/* 小尾巴 */}
      <path className="c-turtled" d="M-37 -8L-46 -5L-37 -2Z" />
      {/* 远侧足 */}
      <ellipse className="c-turtled" opacity=".78" cx="-16" cy="-3" rx="6" ry="3.4" />
      <ellipse className="c-turtled" opacity=".78" cx="20" cy="-3" rx="6" ry="3.4" />
      {/* 高穹顶龟壳 */}
      <path
        className="c-turtle"
        d="M-40 -8C-42 -36 -22 -50 0 -50C22 -50 42 -36 40 -8C30 -2 -30 -2 -40 -8Z"
      />
      {/* 壳缘环带 */}
      <path
        className="c-turtlec"
        d="M-40 -8C-30 -2 30 -2 40 -8C30 -4 -30 -4 -40 -8Z"
      />
      {/* 六边形龟壳年轮纹理 */}
      <path
        className="c-turtled"
        opacity=".4"
        d="M-11 -34L0 -39L11 -34L13 -22L0 -17L-13 -22ZM-13 -28L-25 -25M13 -28L25 -25M0 -17L0 -6"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* 近侧粗短足（撑在壳缘外） */}
      <ellipse className="c-turtled" cx="-27" cy="-4" rx="7.5" ry="5" />
      <ellipse className="c-turtled" cx="30" cy="-4" rx="7.5" ry="5" />
      {/* 悠闲伸缩的头颈 */}
      <g>
        <path
          className="c-turtlec"
          d="M36 -10C42 -16 52 -17 58 -13C62 -10 60 -5 52 -4C44 -4 38 -6 36 -10Z"
        />
        <circle className="c-turtled" cx="54" cy="-11" r="2">
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1 1;1 .1;1 1"
            keyTimes="0;.9;.95;1"
            dur="6.2s"
            repeatCount="indefinite"
          />
        </circle>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 5 -1; 0 0; -2 0; 0 0"
          dur="7.5s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  )
}

/** 7. 小浣熊 (The Raccoon) */
function RaccoonGraphic() {
  return (
    <g>
      {/* 蓬松环纹尾巴 (独立摆动) */}
      <g>
        <path
          className="c-raccoon"
          d="M-28 -28C-44 -38 -64 -34 -76 -22C-82 -14 -80 -4 -70 2C-60 6 -50 0 -40 -8C-32 -14 -28 -20 -28 -28Z"
        />
        {/* 条纹剪纸 */}
        <path className="c-raccoond" d="M-44 -26L-48 -16L-42 -12L-36 -22ZM-60 -24L-64 -14L-58 -10L-54 -20Z" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 -28 -24; -8 -28 -24; 0 -28 -24; 6 -28 -24; 0 -28 -24"
          dur="2.9s"
          repeatCount="indefinite"
        />
      </g>
      {/* 躯干 */}
      <path
        className="c-raccoon"
        d="M-30 -24C-34 -38 -20 -44 0 -44C20 -44 32 -36 34 -24C32 -12 20 -8 0 -8C-20 -8 -28 -14 -30 -24Z"
      />
      {/* 抓握足爪 */}
      <path className="c-raccoond" d="M-22 -18L-16 0H-24ZM18 -18L24 0H16Z" />
      {/* 头部与眼罩面具 */}
      <g>
        <path
          className="c-raccoon"
          d="M26 -30C30 -40 38 -48 48 -48L52 -58L58 -48C66 -46 72 -38 72 -28C68 -18 56 -16 44 -20C34 -24 28 -26 26 -30Z"
        />
        {/* 标志性暗色眼罩 */}
        <path
          className="c-raccoond"
          d="M38 -34C44 -40 54 -40 64 -32C58 -28 46 -26 38 -34Z"
        />
        {/* 口鼻白圈 */}
        <path className="c-raccoonc" d="M54 -28C60 -32 68 -30 70 -26C66 -22 58 -22 54 -28Z" />
        {/* 灵动双眼与小鼻 */}
        <circle className="c-raccoonc" cx="48" cy="-33" r="2.2" />
        <circle className="c-raccoond" cx="48" cy="-33" r="1.4">
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1 1;1 .1;1 1"
            keyTimes="0;.9;.95;1"
            dur="4.0s"
            repeatCount="indefinite"
          />
        </circle>
        <circle className="c-raccoond" cx="68" cy="-26" r="2.0" />
      </g>
    </g>
  )
}

/** 8. 青鸟 (The Bird) —— 圆头冠羽、鼓胸翘尾、分层拍翼 */
function BirdGraphic() {
  return (
    <g>
      {/* 纤细爪足 */}
      <path className="c-birdd" d="M-6 0L-4 -8L-2 0M2 0L4 -8L6 0" stroke="currentColor" strokeWidth="1.5" />
      {/* 扇形尾羽 */}
      <path className="c-birdd" d="M-13 -26L-32 -32L-27 -21L-37 -18L-13 -14Z" />
      {/* 圆润躯干与浅胸 */}
      <ellipse className="c-bird" cx="0" cy="-23" rx="18" ry="13" />
      <ellipse className="c-birdc" cx="3" cy="-18" rx="10" ry="7" />
      {/* 灵动拍动翅膀（外层翼 + 内层羽纹） */}
      <g>
        <path
          className="c-bird"
          d="M-4 -30C-14 -46 -2 -54 12 -46C6 -38 2 -32 -4 -30Z"
        />
        <path
          className="c-birdd"
          opacity=".5"
          d="M-2 -33C-8 -43 -1 -48 7 -44C3 -38 1 -34 -2 -33Z"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 -4 -28; -18 -4 -28; 0 -4 -28; 10 -4 -28; 0 -4 -28"
          dur="1.9s"
          repeatCount="indefinite"
        />
      </g>
      {/* 圆头、冠羽与脸颊 */}
      <circle className="c-bird" cx="15" cy="-38" r="9" />
      <path className="c-bird" d="M10 -45L6 -55L15 -47Z" />
      <circle className="c-birdc" cx="18" cy="-36" r="4.5" />
      {/* 明眸与巧嘴 */}
      <circle className="c-birdd" cx="18" cy="-40" r="2">
        <animateTransform
          attributeName="transform"
          type="scale"
          values="1 1;1 1;1 .1;1 1"
          keyTimes="0;.88;.94;1"
          dur="3.6s"
          repeatCount="indefinite"
        />
      </circle>
      <path className="c-birdd" d="M23 -38L33 -35L23 -33Z" />
    </g>
  )
}
