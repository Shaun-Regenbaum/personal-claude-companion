import { execSync } from 'child_process'

interface CachedSecret {
  value: string
  expiresAt: number
}

const cache = new Map<string, CachedSecret>()

// Successful lookups cached for 1 hour, failures for 60 seconds
const SUCCESS_TTL = 60 * 60_000
const FAILURE_TTL = 60_000

export function getSecret(name: string): string {
  const cached = cache.get(name)
  if (cached && Date.now() < cached.expiresAt) return cached.value

  try {
    const home = process.env.HOME || '/Users/shaunie'
    const setecBin = process.env.SETEC_PATH ?? `${home}/.local/bin/setec`
    const value = execSync(`${setecBin} get ${name}`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim()
    cache.set(name, { value, expiresAt: Date.now() + SUCCESS_TTL })
    return value
  } catch {
    console.warn(`Failed to read secret: ${name}`)
    cache.set(name, { value: '', expiresAt: Date.now() + FAILURE_TTL })
    return ''
  }
}

export function getWorkerUrl(): string {
  return getSecret('companion/worker-url') || 'https://kimi.402.network'
}

export function getCfAccessHeaders(): Record<string, string> {
  const clientId = getSecret('companion/cf-access-client-id')
  const clientSecret = getSecret('companion/cf-access-client-secret')
  if (!clientId || !clientSecret) return {}
  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
  }
}
