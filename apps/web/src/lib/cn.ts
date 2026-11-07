import { createCn } from 'cn/config'

// the merger only knows tailwind's default scales, so unregistered names read as colours
// and cn('text-rim', 'text-body') silently drops one of the two
const FONT_SIZE_TOKENS = ['display', 'h1', 'h2', 'metric', 'body', 'label', 'micro']
const SHADOW_TOKENS = ['raised', 'overlay', 'glow']

export const cn = createCn({
  extend: { theme: { text: FONT_SIZE_TOKENS, shadow: SHADOW_TOKENS } },
})
