/**
 * Per-model configuration for the curated NVIDIA NIM models.
 *
 * Each model has individually tuned parameters (max_tokens, category, etc.)
 * that are known to work with the NVIDIA API.
 *
 * ─── How to use ───────────────────────────────────────────────
 *   • Add a model    → add an entry to CURATED_MODELS
 *   • Remove a model → delete (or comment out) its entry
 *   • Tune a model   → change maxTokens / category and test
 * ──────────────────────────────────────────────────────────────
 */

export interface ModelConfig {
  /** Substring matched against NVIDIA model IDs (case-insensitive) */
  keyword: string;

  /** Clean display name shown in the sidebar */
  displayName: string;

  /** Maximum output tokens sent as `max_tokens` to the API */
  maxTokens: number;

  /** "chat" = text only, "vision" = enables image upload in the UI */
  category: "chat" | "vision";

  /** Short description shown under the selected model */
  description: string;
}

/**
 * The curated set of models exposed to the user.
 * Order here determines sidebar display order.
 */
export const CURATED_MODELS: ModelConfig[] = [
  // ── Chat Models ─────────────────────────────────────────────
  {
    keyword: "kimi-k2.6",
    displayName: "Kimi K2.6",
    maxTokens: 4096,
    category: "vision",
    description: "Moonshot AI's multimodal model — text, image & strong reasoning",
  },
  {
    keyword: "glm-5.1",
    displayName: "GLM 5.1",
    maxTokens: 4096,
    category: "chat",
    description: "Zhipu AI's general-purpose language model",
  },
  {
    keyword: "minimax-m2.7",
    displayName: "MiniMax M2.7",
    maxTokens: 4096,
    category: "chat",
    description: "MiniMax's flagship chat model",
  },
  {
    keyword: "qwen3.5-397b",
    displayName: "Qwen 3.5 397B",
    maxTokens: 2048,
    category: "chat",
    description: "Alibaba's largest reasoning model — conservative token limit",
  },

  // ── Vision Models ───────────────────────────────────────────
  {
    keyword: "llama-3.2-90b",
    displayName: "LLaMA 3.2 90B Vision",
    maxTokens: 4096,
    category: "vision",
    description: "Meta's large multimodal model — text + image understanding",
  },
  {
    keyword: "llama-3.2-11b",
    displayName: "LLaMA 3.2 11B Vision",
    maxTokens: 4096,
    category: "vision",
    description: "Meta's compact vision model — fast image analysis",
  },
];

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Look up the config for a model by its full NVIDIA ID.
 * Returns `undefined` for unknown models.
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  const id = modelId.toLowerCase();
  return CURATED_MODELS.find((c) => id.includes(c.keyword));
}

/**
 * Fallback max_tokens when a model isn't in the curated list.
 * Set conservatively so unknown models don't crash.
 */
export const DEFAULT_MAX_TOKENS = 2048;
