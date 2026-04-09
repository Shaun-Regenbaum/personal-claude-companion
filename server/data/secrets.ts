import { execSync } from 'child_process'

const cache = new Map<string, string>()

export function getSecret(name: string): string {
  const cached = cache.get(name)
  if (cached !== undefined) return cached

  try {
    const home = process.env.HOME || '/Users/shaunie'
    const setecBin = process.env.SETEC_PATH ?? `${home}/.local/bin/setec`
    const value = execSync(`${setecBin} get ${name}`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim()
    cache.set(name, value)
    return value
  } catch {
    console.warn(`Failed to read secret: ${name}`)
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
