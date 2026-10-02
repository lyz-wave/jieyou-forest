import farUrl from './far.png'
import nearAUrl from './near-a.png'
import nearBUrl from './near-b.png'
import nearCUrl from './near-c.png'
import paperUrl from './paper.png'

/**
 * 水彩背景。四层，全部是离线烘好的图（见 app/tools/bake-watercolor.cjs）。
 * 运动只用 transform / opacity —— 这两样走合成器，实测满帧；
 * background-position 会把帧率打到 31fps，SVG 湍流最差单帧卡 15.8 秒，都禁用。
 *
 * 三个近景状态共用同一套晕染骨架、只错开一点点爬行位移，
 * 所以交叉淡化读起来是"同一片颜料在化开"，而不是两张无关的图在对溶。
 */
export default function Watercolor() {
  return (
    <div className="watercolor" aria-hidden="true">
      <img className="wc-layer wc-far" src={farUrl} alt="" />
      <div className="wc-nearstack">
        <img className="wc-layer wc-near wc-near-a" src={nearAUrl} alt="" />
        <img className="wc-layer wc-near wc-near-b" src={nearBUrl} alt="" />
        <img className="wc-layer wc-near wc-near-c" src={nearCUrl} alt="" />
      </div>
      <img className="wc-layer wc-paper" src={paperUrl} alt="" />
    </div>
  )
}
