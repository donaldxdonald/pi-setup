import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { getAgentDir, withFileMutationQueue, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent'

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

type ThinkingLevel = (typeof THINKING_LEVELS)[number]

interface ModelIdentity {
  id: string
  provider: string
}

interface PreferencesFile {
  enabled: boolean
  models: Record<string, ThinkingLevel>
  version: 1
}

const EMPTY_PREFERENCES: PreferencesFile = {
  enabled: true,
  models: {},
  version: 1,
}

function modelKey(model: ModelIdentity): string {
  return `${model.provider}/${model.id}`
}

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === 'string' && THINKING_LEVELS.includes(value as ThinkingLevel)
}

function parsePreferences(value: unknown): PreferencesFile {
  if (!value || typeof value !== 'object') return { ...EMPTY_PREFERENCES, models: {} }

  const input = value as { enabled?: unknown; models?: unknown }
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : true
  if (!input.models || typeof input.models !== 'object' || Array.isArray(input.models)) {
    return { enabled, models: {}, version: 1 }
  }

  const validModels: Record<string, ThinkingLevel> = {}
  for (const [key, level] of Object.entries(input.models)) {
    if (isThinkingLevel(level)) validModels[key] = level
  }

  return { enabled, models: validModels, version: 1 }
}

async function loadPreferences(path: string): Promise<PreferencesFile> {
  try {
    return parsePreferences(JSON.parse(await readFile(path, 'utf8')))
  } catch(error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[model-thinking-levels] Could not read ${path}:`, error)
    }
    return { ...EMPTY_PREFERENCES, models: {} }
  }
}

async function writePreferences(path: string, preferences: PreferencesFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true })

  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(preferences, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    await rename(temporaryPath, path)
  } catch(error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

function hasPinnedThinkingLevel(ctx: ExtensionContext, model: ModelIdentity): boolean {
  const scopedModels = (ctx as ExtensionContext & {
    scopedModels?: Array<{ model: ModelIdentity; thinkingLevel?: ThinkingLevel }>
  }).scopedModels ?? []

  return scopedModels.some(({ model: scopedModel, thinkingLevel }) =>
    thinkingLevel !== undefined
    && scopedModel.provider === model.provider
    && scopedModel.id === model.id,
  )
}

export default function registerModelThinkingLevels(pi: ExtensionAPI): void {
  const preferencesPath = join(getAgentDir(), 'extensions', 'model-thinking-levels.json')

  let activeModelKey: string | undefined
  let enabled = true
  let initialized = false
  let preferences: PreferencesFile = { ...EMPTY_PREFERENCES, models: {} }
  let applyingPreferenceFor: string | undefined
  const pendingSaves = new Set<Promise<void>>()

  async function remember(key: string, level: ThinkingLevel): Promise<void> {
    preferences.models[key] = level

    await withFileMutationQueue(preferencesPath, async() => {
      const latest = await loadPreferences(preferencesPath)
      latest.models[key] = level
      preferences = latest
      await writePreferences(preferencesPath, latest)
    })
  }

  async function rememberSafely(key: string, level: ThinkingLevel): Promise<void> {
    try {
      await remember(key, level)
    } catch(error) {
      console.error(`[model-thinking-levels] Could not save ${key}:`, error)
    }
  }

  async function setEnabled(nextEnabled: boolean): Promise<boolean> {
    enabled = nextEnabled
    preferences.enabled = nextEnabled

    try {
      await withFileMutationQueue(preferencesPath, async() => {
        const latest = await loadPreferences(preferencesPath)
        latest.enabled = nextEnabled
        preferences = latest
        await writePreferences(preferencesPath, latest)
      })
      return true
    } catch(error) {
      console.error('[model-thinking-levels] Could not save enabled state:', error)
      return false
    }
  }

  function rememberIfStillCurrent(key: string, level: ThinkingLevel, ignore: boolean): void {
    const pendingSave = Promise.resolve().then(async() => {
      if (!enabled || ignore || key !== activeModelKey || pi.getThinkingLevel() !== level) return
      await rememberSafely(key, level)
    })

    pendingSaves.add(pendingSave)
    void pendingSave.finally(() => pendingSaves.delete(pendingSave))
  }

  async function applyRememberedLevel(key: string): Promise<void> {
    if (!enabled) return

    const rememberedLevel = preferences.models[key]
    if (!rememberedLevel) return

    applyingPreferenceFor = key
    try {
      pi.setThinkingLevel(rememberedLevel)
    } finally {
      applyingPreferenceFor = undefined
    }

    const effectiveLevel = pi.getThinkingLevel()
    if (effectiveLevel !== rememberedLevel) {
      await rememberSafely(key, effectiveLevel)
    }
  }

  pi.registerCommand('remember-thinking', {
    description: 'Toggle model-specific thinking-level memory',
    handler: async(args, ctx) => {
      const action = args.trim().toLowerCase()
      if (action === 'status') {
        ctx.ui.notify(`Model thinking memory is ${enabled ? 'on' : 'off'}.`, 'info')
        return
      }

      if (action && !['on', 'off'].includes(action)) {
        ctx.ui.notify('Usage: /remember-thinking [on|off|status]', 'warning')
        return
      }

      const nextEnabled = action ? action === 'on' : !enabled
      const persisted = await setEnabled(nextEnabled)

      const model = ctx.model
      const key = model ? modelKey(model) : undefined
      if (nextEnabled && model && key && !hasPinnedThinkingLevel(ctx, model)) {
        await applyRememberedLevel(key)
      }

      const persistenceNote = persisted ? '' : ' for this session only'
      ctx.ui.notify(`Model thinking memory ${nextEnabled ? 'enabled' : 'disabled'}${persistenceNote}.`, persisted ? 'info' : 'warning')
    },
  })

  pi.on('session_start', async(_event, ctx) => {
    preferences = await loadPreferences(preferencesPath)
    enabled = preferences.enabled
    initialized = true

    const model = ctx.model
    const key = model ? modelKey(model) : undefined
    activeModelKey = key

    if (enabled && model && key && !hasPinnedThinkingLevel(ctx, model)) {
      await applyRememberedLevel(key)
    }
  })

  pi.on('model_select', async(event, ctx) => {
    const key = modelKey(event.model)
    activeModelKey = key

    if (enabled && !hasPinnedThinkingLevel(ctx, event.model)) {
      await applyRememberedLevel(key)
    }
  })

  pi.on('thinking_level_select', (event, ctx) => {
    if (!enabled || !initialized || !ctx.model) return

    const key = modelKey(ctx.model)

    // Pi does not await this event before model_select. Defer the write so a
    // model switch can restore its preference before we decide what to keep.
    rememberIfStillCurrent(key, event.level, key !== activeModelKey || key === applyingPreferenceFor)
  })

  pi.on('session_shutdown', async() => {
    await Promise.allSettled(pendingSaves)
  })
}
