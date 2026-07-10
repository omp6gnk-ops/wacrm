// ============================================================
// Shared types for the AI reply assistant (bring-your-own-key).
//
// One small provider-agnostic surface so the inbox draft route and the
// inbound auto-reply bot both talk to `generateReply` without caring
// whether the account is on OpenAI or Anthropic.
// ============================================================

export type AiProvider = 'openai' | 'anthropic'

/**
 * Account AI setup, decrypted and ready to use. Produced by
 * `loadAiConfig` — `apiKey` is the plaintext BYO provider key
 * (stored AES-256-GCM-encrypted at rest).
 */
export interface CollectField {
  field: string // 'name' | 'email' | 'company' | 'custom:<uuid>'
  required: boolean
}

export interface AiConfig {
  provider: AiProvider
  model: string
  apiKey: string
  systemPrompt: string | null
  isActive: boolean
  autoReplyEnabled: boolean
  autoReplyMaxPerConversation: number
  /** How many minutes of agent inactivity before AI takes over an
   *  assigned conversation. 0 = instant. */
  aiTakeoverMinutes: number
  /** How many minutes of inactivity before the per-conversation AI reply count resets. */
  aiReplyLimitResetMinutes?: number
  /** Optional OpenAI-compatible key for embeddings. */
  embeddingsApiKey: string | null
  
  // Trigger controls
  coexistWithAutomations?: boolean
  triggerOnButtonReply?: boolean

  // Sales mode
  salesModeEnabled?: boolean
  salesSystemPrompt?: string | null
  collectFields?: CollectField[]

  // Auto-categorization
  autoCategorizeEnabled?: boolean
  categorizeAfterReplies?: number
  interestedTagId?: string | null
  notInterestedTagId?: string | null
  interestedStatusId?: string | null
  notInterestedStatusId?: string | null

  // Payment/QR
  paymentQrUrl?: string | null
  paymentInstructions?: string | null

  // Razorpay Dynamic Link Payment Settings
  restrictToAgentIds?: string[]
  razorpayEnabled?: boolean
  razorpayKeyId?: string | null
  razorpayKeySecret?: string | null
  razorpayWebhookSecret?: string | null
}

export interface AiAgentConfig {
  id: string
  accountId: string
  agentId: string
  systemPrompt: string
  maxReplies: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

/** A single conversation turn in the shape both providers accept. */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Outcome of a generation call. */
export interface GenerateResult {
  /** The reply text, with any handoff sentinel stripped. */
  text: string
  /** True when the model asked to hand off to a human (auto-reply mode). */
  handoff: boolean
}

/**
 * Typed error for every AI failure mode. `status` maps cleanly to an
 * HTTP response in the draft route; `code` lets the UI/tests branch
 * (invalid_key vs rate_limited vs timeout, etc.).
 */
export class AiError extends Error {
  readonly code: string
  readonly status: number
  constructor(message: string, opts: { code?: string; status?: number } = {}) {
    super(message)
    this.name = 'AiError'
    this.code = opts.code ?? 'ai_error'
    this.status = opts.status ?? 502
  }
}
