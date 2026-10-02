import type { Capabilities, SafetyLevel } from './types'

/**
 * 安全级别到界面能力的唯一映射。主进程与渲染进程都可能需要它，
 * 所以它住在 shared，而不是任何一侧的私有实现里。
 */
export function capabilitiesFor(level: SafetyLevel): Capabilities {
  switch (level) {
    case 'L1':
      return { canRest: false, canReflect: false, canShowCrisis: true }
    case 'L2':
      return { canRest: true, canReflect: false, canShowCrisis: false }
    case 'L3':
      return { canRest: true, canReflect: true, canShowCrisis: false }
  }
}
