import { $ } from 'bun'

export async function isPidAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    const result = await $`ps -p ${pid} -o comm=`.text()
    const comm = result.trim().toLowerCase()
    return comm.includes('claude') || comm.includes('node') || comm.includes('bun')
  } catch {
    return false
  }
}
