/**
 * 内置示例稿（架构文档 §5）。它是承接层失败时的兜底，文案本身必须自述通用性，
 * 界面上还要再叠一条横幅——不允许让用户以为这是针对自己写的内容生成的。
 */
export const RECEIVE_FALLBACK_BANNER = '这是内置的通用提示，不是针对你刚写的内容生成的'

export const RECEIVE_FALLBACK_TEXT =
  '被这样对待，确实可能让人难受。你可以先歇一会儿；如果你愿意，也可以重试一次，让我针对你写的内容回应。'

export function fallbackReceive(): { text: string; isFallback: true; banner: string } {
  return { text: RECEIVE_FALLBACK_TEXT, isFallback: true, banner: RECEIVE_FALLBACK_BANNER }
}
