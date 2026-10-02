import type { SessionController } from '../useSession'
import LeafCard from '../cards/LeafCard'
import SensesCard from '../cards/SensesCard'

export default function Rest({ s }: { s: SessionController }) {
  return (
    <>
      <h2 style={{ fontSize: 16 }}>两张卡，随便挑，随时能换</h2>
      <LeafCard />
      <SensesCard />
      <button className="primary" onClick={() => s.go('save')}>留下一圈年轮</button>{' '}
      <button className="ghost" onClick={() => s.go('express')}>今天先到这里</button>
    </>
  )
}
