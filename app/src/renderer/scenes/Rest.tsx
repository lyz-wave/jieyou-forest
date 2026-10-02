import type { SessionController } from '../useSession'
import VentingWorkshop from '../venting/VentingWorkshop'

export default function Rest({ s }: { s: SessionController }) {
  return <VentingWorkshop s={s} />
}
