export interface Session {
  sessionId: string
  pid?: number
  cwd: string
  projectName: string
  startedAt: number
  lastActivityAt: number
  entrypoint: 'cli' | 'desktop' | 'unknown'
  isActive: boolean
  displayName: string
  messageCount: number
  gitBranch?: string
  version?: string
}

export interface ConversationMessage {
  uuid: string
  parentUuid: string | null
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'progress' | 'agent_progress' | 'file-history-snapshot' | 'system'
  timestamp: string
  content: MessageContent[]
  model?: string
  usage?: TokenUsage
  isSidechain?: boolean
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: MessageContent[] }
  | { type: 'image'; source: { type: string; media_type: string; data: string } }
  | { type: 'thinking'; thinking: string }

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export interface EditAction {
  timestamp: string
  filePath: string
  toolName: 'Edit' | 'Write'
  oldString?: string
  newString?: string
  content?: string
  messageUuid: string
}

export interface SubagentMeta {
  agentId: string
  agentType: string
  description: string
  sessionId: string
}

export interface PlanSummary {
  name: string
  path: string
  modifiedAt: string
  sizeBytes: number
}

export interface ConfigData {
  settings: Record<string, unknown>
  localSettings: Record<string, unknown>
  plugins: PluginInfo[]
  skills: SkillInfo[]
  mcpServers: McpServerInfo[]
  hooks: HookInfo[]
}

export interface PluginInfo {
  name: string
  scope: string
  version: string
  installedAt: string
  lastUpdated: string
}

export interface SkillInfo {
  name: string
  path: string
  target: string
}

export interface McpServerInfo {
  name: string
  command?: string
  enabled: boolean
  config: Record<string, unknown>
}

export interface HookInfo {
  event: string
  matcher: string
  command: string
}

export interface SummaryBlock {
  turnNumber: number
  userPrompt: string
  toolCalls: { name: string; count: number }[]
  messageCount: number
  startTimestamp: string
  endTimestamp: string
  messages: ConversationMessage[]
}

export interface SSEEvent {
  type: 'session-update' | 'conversation-update' | 'plan-update' | 'config-update'
  sessionId?: string
  timestamp: string
}
