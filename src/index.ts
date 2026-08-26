import registerModelThinkingLevels from './extensions/model-thinking-levels'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export default function registerExtensions(pi: ExtensionAPI): void {
  registerModelThinkingLevels(pi)
}
