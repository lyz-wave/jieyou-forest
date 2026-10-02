import { useState, useEffect } from 'react'
import AnimalSprite, { type AnimalSpecies, ANIMAL_METAS } from './AnimalSprite'
import type { SessionController } from '../useSession'
import './CampfireCouncil.css'

interface CampfireCouncilProps {
  s: SessionController
  mode?: 'roam' | 'campfire'
  onToggleMode?: (m: 'roam' | 'campfire') => void
  onSaveInsight?: (insight: string) => void
}

interface CouncilPosition {
  x: number // 百分比 0-100
  y: number // 百分比 0-100
  dir: 1 | -1
}

// 围炉剧场扇形半包围坐席相对坐标 (相对于中心篝火)
const CAMPFIRE_POSITIONS: Record<AnimalSpecies, CouncilPosition> = {
  bear: { x: 12, y: 32, dir: 1 }, // 后排高位左翼守护
  deer: { x: 88, y: 32, dir: -1 }, // 后排高位右翼守护
  owl: { x: 22, y: 44, dir: 1 }, // 中排左翼智囊
  fox: { x: 78, y: 44, dir: -1 }, // 中排右翼灵动
  turtle: { x: 30, y: 62, dir: 1 }, // 前中排左侧从容
  bird: { x: 70, y: 56, dir: -1 }, // 前中排右侧空灵
  hedgehog: { x: 39, y: 76, dir: 1 }, // 前排内圈近景
  raccoon: { x: 61, y: 76, dir: -1 }, // 前排内圈行动
}

// 首页林间闲逛自由漫游坐标
const ROAM_POSITIONS: Record<AnimalSpecies, CouncilPosition> = {
  owl: { x: 16, y: 22, dir: 1 }, // 树梢
  bird: { x: 82, y: 18, dir: -1 }, // 枝头高飞
  deer: { x: 74, y: 56, dir: -1 }, // 林缘漫步
  bear: { x: 14, y: 70, dir: 1 }, // 巨石旁沉睡
  fox: { x: 48, y: 78, dir: 1 }, // 草甸中央
  raccoon: { x: 62, y: 72, dir: -1 }, // 灌木丛
  hedgehog: { x: 34, y: 84, dir: 1 }, // 树根下
  turtle: { x: 86, y: 80, dir: -1 }, // 溪边浅滩
}

// 闲逛态下的亲切问候语
const ROAM_GREETINGS: Record<AnimalSpecies, string> = {
  owl: '“咕～在想什么呢？要不要一起把事情捋清楚？”',
  bear: '“累了就靠着我歇会儿，天塌不下来。”',
  deer: '“山林听得到你的心跳，慢下来，没事的。”',
  fox: '“嘿！别钻死胡同，换个角度准有新好玩的！”',
  hedgehog: '“要是觉得世界扎人，我替你立起刺，你先歇会儿。”',
  turtle: '“慢慢走，三年后再回头看，都是小事。”',
  raccoon: '“别光愁着，明天做个 5 分钟小尝试怎么样？”',
  bird: '“风吹过去就散啦，你的心本就很轻很阔。”',
}

function getDiscussionScripts(s: SessionController): Array<{
  speaker: AnimalSpecies
  speech: string
  delayMs: number
}> {
  const analysis = s.analysis
  return [
    {
      speaker: 'deer',
      speech:
        s.receive?.trim() ||
        '听到你写下的这些话，真的好心疼。先深深吸一口气，允许自己难过或慌乱片刻，在这里你是完全被接纳的。',
      delayMs: 600,
    },
    {
      speaker: 'owl',
      speech:
        analysis?.reframedQuestion ||
        '白鹿说得对，感受需要被抱住。接下来，我们把事实和猜测分开：眼前确凿发生的事情是什么？有哪些其实是还没发生的推论？',
      delayMs: 3200,
    },
    {
      speaker: 'hedgehog',
      speech:
        analysis?.assumptions && analysis.assumptions.length > 0
          ? `注意到了吗？我们容易把局部波折脑补成“${analysis.assumptions[0]}”。别把脑补的刺扎在自己身上。`
          : '注意到了吗？我们感到受威胁时，习惯把一个局部的波折脑补成「彻底搞砸了」。别把脑补的刺扎在自己身上。',
      delayMs: 6000,
    },
    {
      speaker: 'fox',
      speech:
        analysis?.socraticQuestions?.explorer ||
        '嘿！既然旧模式行不通，何不当成一次试探？有没有一个成本几乎为零、随时能撤回的小小尝试？',
      delayMs: 8800,
    },
    {
      speaker: 'bear',
      speech:
        analysis?.socraticQuestions?.guardian ||
        '守好你自己的核心底线与能量。不必对所有要求说「好」，允许自己设一道拒绝的篱笆，那不是自私，是保护生命力。',
      delayMs: 11600,
    },
    {
      speaker: 'turtle',
      speech:
        analysis?.socraticQuestions?.outsider ||
        '从容些，三年后再回头看今天这道关卡，它只是生命长河里的一圈细碎水花。时间会给你最温和的答案。',
      delayMs: 14400,
    },
    {
      speaker: 'raccoon',
      speech:
        analysis?.microExperiment?.action
          ? `别让思考变成空转！试试这个行动：“${analysis.microExperiment.action}”，用 5 分钟微行动打破死锁。`
          : '别让思考变成空转！明天上午抽出 5 分钟去向相关方核实一次具体事实，用一个微小行动打破死锁。',
      delayMs: 17200,
    },
    {
      speaker: 'bird',
      speech: '风过林梢，树叶轻唱。让烦恼回归山林，此刻把这份释怀刻入年轮吧。',
      delayMs: 20000,
    },
  ]
}

export default function CampfireCouncil({
  s,
  mode = 'roam',
  isQuiet = false,
  onToggleMode,
  onSaveInsight,
}: CampfireCouncilProps & { isQuiet?: boolean }) {
  const isCampfire = mode === 'campfire'
  const [activeSpeaker, setActiveSpeaker] = useState<AnimalSpecies | null>(null)
  const [animalSpeeches, setAnimalSpeeches] = useState<Partial<Record<AnimalSpecies, string>>>({})
  const [clickedGreeting, setClickedGreeting] = useState<{
    species: AnimalSpecies
    text: string
  } | null>(null)
  const [showConvergence, setShowConvergence] = useState(false)

  // 围炉模式时自动触发 8 只动物接力发言
  useEffect(() => {
    if (!isCampfire) {
      setActiveSpeaker(null)
      setAnimalSpeeches({})
      setShowConvergence(false)
      return
    }

    const scripts = getDiscussionScripts(s)
    const timers: NodeJS.Timeout[] = []

    scripts.forEach((item) => {
      const t = setTimeout(() => {
        setActiveSpeaker(item.speaker)
        setAnimalSpeeches((prev) => ({
          ...prev,
          [item.speaker]: item.speech,
        }))
      }, item.delayMs)
      timers.push(t)
    })

    const convergenceTimer = setTimeout(() => {
      setShowConvergence(true)
    }, 22500)
    timers.push(convergenceTimer)

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [isCampfire, s.receive, s.analysis])

  // 点击单只动物追问/打招呼
  const handleAnimalClick = (species: AnimalSpecies) => {
    if (!isCampfire) {
      // 闲逛态：冒出该动物性格问候
      setClickedGreeting({ species, text: ROAM_GREETINGS[species] })
      setTimeout(() => setClickedGreeting(null), 3600)
    } else {
      // 围炉态：聚焦并显示其专属见解
      setActiveSpeaker(species)
      const scripts = getDiscussionScripts(s)
      const script = scripts.find((d) => d.speaker === species)
      if (script) {
        setAnimalSpeeches((prev) => ({
          ...prev,
          [species]: script.speech,
        }))
      }
    }
  }

  // 一键留存年轮
  const handleAdoptCouncilInsight = () => {
    const defaultInsight =
      s.input
        ? `【围炉顿悟】面对“${s.input.slice(0, 24)}”，接纳情绪，守住底线，以 5 分钟微行动化解内耗。`
        : '【围炉顿悟】接纳当下的脆弱，划定客观事实，明天只做一个微小实验。'
    if (onSaveInsight) {
      onSaveInsight(defaultInsight)
    } else {
      s.adoptExperiment({
        action: defaultInsight,
        observableCriterion: '在 8 动物围炉探讨后确立清晰内心边界并落实小行动',
        estimatedMinutes: 5,
      })
    }
  }

  return (
    <div
      className={`campfire-council-stage ${isCampfire ? 'mode-campfire' : 'mode-roam'}${isQuiet ? ' is-quiet' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden',
      }}
    >
      {/* 围炉夜幕聚光灯微晕染 */}
      <div
        className="campfire-ambient-glow"
        style={{
          position: 'absolute',
          left: '50%',
          top: '58%',
          transform: 'translate(-50%, -50%)',
          width: isCampfire ? '90vmin' : '0',
          height: isCampfire ? '90vmin' : '0',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(235, 140, 50, 0.22) 0%, rgba(210, 110, 30, 0.08) 45%, transparent 70%)',
          transition: 'all 1.4s cubic-bezier(0.2, 0.8, 0.25, 1)',
          pointerEvents: 'none',
          opacity: isCampfire ? 1 : 0,
        }}
      />

      {/* 中央生起的温暖纸艺篝火 */}
      <div
        className="campfire-core"
        style={{
          position: 'absolute',
          left: '50%',
          top: '58%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: isCampfire ? 1 : 0,
          scale: isCampfire ? '1' : '0.4',
          transition: 'all 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: isCampfire ? 'auto' : 'none',
        }}
      >
        <svg width="120" height="110" viewBox="0 0 120 110" overflow="visible">
          {/* 柴火木段 */}
          <path d="M25 88L95 98M95 88L25 98" stroke="#4a3020" strokeWidth="9" strokeLinecap="round" />
          <path d="M35 84L85 84" stroke="#684228" strokeWidth="8" strokeLinecap="round" />
          {/* 橙红外焰 */}
          <path
            d="M60 22C42 45 32 64 36 82C40 94 50 96 60 96C70 96 80 94 84 82C88 64 78 45 60 22Z"
            fill="#d95328"
          >
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1 1; 1.05 0.96; 0.98 1.04; 1 1"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>
          {/* 暖金中焰 */}
          <path
            d="M60 38C48 54 42 68 46 82C48 90 54 92 60 92C66 92 72 90 74 82C78 68 72 54 60 38Z"
            fill="#f6a032"
          >
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1 1; 0.95 1.08; 1.04 0.94; 1 1"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </path>
          {/* 核心白热焰 */}
          <path
            d="M60 55C54 66 52 74 54 82C56 86 58 88 60 88C62 88 64 86 66 82C68 74 66 66 60 55Z"
            fill="#fff3cb"
          />
          {/* 上升火星粒子 */}
          <circle cx="56" cy="28" r="1.8" fill="#ffd978">
            <animate attributeName="cy" values="28;-10" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="68" cy="20" r="1.4" fill="#ffd978">
            <animate attributeName="cy" values="20;-22" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="1.4s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* 围炉共识收敛提示卡 */}
        {showConvergence && (
          <div
            style={{
              marginTop: 6,
              background: 'rgba(255, 252, 245, 0.95)',
              border: '1.5px solid #d49a42',
              borderRadius: 14,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 8px 24px rgba(212, 154, 66, 0.3)',
              animation: 'rise 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) both',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#3d6148' }}>
              🌿 围炉探讨已达成共识
            </span>
            <button
              type="button"
              className="primary"
              onClick={handleAdoptCouncilInsight}
              style={{
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 99,
                background: 'linear-gradient(135deg, #c8642d, #a54b1f)',
              }}
            >
              以此顿悟留年轮
            </button>
          </div>
        )}
      </div>

      {/* 8 只森林动物渲染 */}
      {(Object.keys(CAMPFIRE_POSITIONS) as AnimalSpecies[]).map((species) => {
        const targetPos = isCampfire ? CAMPFIRE_POSITIONS[species] : ROAM_POSITIONS[species]
        const isSpeaking = activeSpeaker === species
        const speech = isCampfire
          ? animalSpeeches[species]
          : clickedGreeting?.species === species
            ? clickedGreeting.text
            : undefined

        return (
          <div
            key={species}
            style={{
              position: 'absolute',
              left: `${targetPos.x}%`,
              top: `${targetPos.y}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 1.3s cubic-bezier(0.22, 1, 0.36, 1), top 1.3s cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: 'auto',
              zIndex: isSpeaking ? 50 : 20,
            }}
          >
            <AnimalSprite
              species={species}
              state={isSpeaking ? 'speak' : isCampfire ? 'sit' : 'idle'}
              direction={targetPos.dir}
              speaking={isSpeaking}
              speech={speech}
              speechTitle={
                isCampfire
                  ? `${ANIMAL_METAS[species].name} · ${ANIMAL_METAS[species].title}`
                  : ANIMAL_METAS[species].name
              }
              onClick={() => handleAnimalClick(species)}
            />
          </div>
        )
      })}
    </div>
  )
}
