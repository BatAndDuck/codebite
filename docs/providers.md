# Supported Providers & Models

All LLM calls go through the [Vercel AI SDK](https://sdk.vercel.ai/docs), giving you a unified runtime across every provider listed here.

## Quick reference

| Provider | `--provider` | Embedding support | Notes |
|----------|-------------|:-----------------:|-------|
| OpenAI | `openai` | ✓ | |
| Anthropic | `anthropic` | — | No embedding API |
| Google Gemini | `google` | ✓ | |
| Mistral | `mistral` | ✓ | |
| Vercel AI Gateway | `vercel` | ✓ | Routes to any backend via your gateway |
| Groq | `groq` | — | Fast inference; Llama, Mixtral, Gemma models |
| xAI (Grok) | `xai` | — | |
| Cohere | `cohere` | ✓ | |
| DeepSeek | `deepseek` | — | |
| AWS Bedrock | `bedrock` | ✓ | Uses AWS credential chain, not an API key |
| Azure OpenAI | `azure` | ✓ | Requires `--base-url` |
| Together AI | `togetherai` | — | Open models via Together AI |
| Fireworks AI | `fireworks` | — | Fast open-model inference |
| LiteLLM | `litellm` | ✓ | OpenAI-compatible proxy; runs locally or remotely |

---

## Provider details

### OpenAI

```bash
codebite init --provider openai --model gpt-4o --apikey sk-...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `gpt-4o` | Flagship multimodal model |
| `gpt-4o-mini` | Faster, cheaper |
| `o3` | Advanced reasoning |
| `o4-mini` | Fast reasoning |

**Embedding model:** `text-embedding-3-small` (used automatically for `codebite index`)

---

### Anthropic

```bash
codebite init --provider anthropic --model claude-opus-4-5 --apikey sk-ant-...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `claude-opus-4-5` | Most capable |
| `claude-sonnet-4-5` | Balanced |
| `claude-haiku-4-5-20251001` | Fastest, cheapest |

**Embeddings:** Not supported. Use a different provider for `codebite index`.

---

### Google Gemini

```bash
codebite init --provider google --model gemini-2.0-flash --apikey AIza...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `gemini-2.5-pro` | Most capable |
| `gemini-2.0-flash` | Fast, cheap |
| `gemini-2.0-flash-lite` | Very fast |

**Embedding model:** `text-embedding-004`

---

### Mistral

```bash
codebite init --provider mistral --model mistral-large-latest --apikey ...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `mistral-large-latest` | Most capable |
| `mistral-small-latest` | Fast, cost-effective |
| `codestral-latest` | Code-focused |

**Embedding model:** `mistral-embed`

---

### Vercel AI Gateway

Routes all calls through your [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). The model string includes the backend provider as a prefix: `openai/gpt-4o`, `anthropic/claude-sonnet-4-5`, etc.

```bash
codebite init --provider vercel --model openai/gpt-4o-mini --apikey vck_...
```

**Examples:**

| Model string | Backend |
|-------------|---------|
| `openai/gpt-4o` | OpenAI GPT-4o |
| `openai/gpt-4o-mini` | OpenAI GPT-4o mini |
| `anthropic/claude-opus-4-5` | Anthropic Claude |
| `google/gemini-2.0-flash` | Google Gemini |

Configure the gateway URL via environment variables:

```
VERCEL_TEAM_ID=your-team-slug       # defaults to "default"
VERCEL_GATEWAY_NAME=my-gateway      # defaults to "default"
```

**Embedding model:** Routes `openai/text-embedding-3-small` through the gateway.

---

### Groq

Fast inference via [Groq](https://groq.com). Uses Llama, Mixtral, and Gemma models.

```bash
codebite init --provider groq --model llama-3.3-70b-versatile --apikey gsk_...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `llama-3.3-70b-versatile` | Best quality |
| `llama-3.1-8b-instant` | Fastest |
| `mixtral-8x7b-32768` | Long context |
| `gemma2-9b-it` | Google Gemma |

**Embeddings:** Not supported.

---

### xAI (Grok)

[xAI](https://x.ai) Grok models.

```bash
codebite init --provider xai --model grok-3 --apikey xai-...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `grok-3` | Most capable |
| `grok-3-fast` | Faster variant |
| `grok-2-1212` | Previous generation |

**Embeddings:** Not supported.

---

### Cohere

[Cohere](https://cohere.com) Command models.

```bash
codebite init --provider cohere --model command-r-plus --apikey ...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `command-r-plus` | Best quality, long context |
| `command-r` | Balanced |
| `command-a-03-2025` | Latest generation |

**Embedding model:** `embed-multilingual-v3.0`

---

### DeepSeek

[DeepSeek](https://deepseek.com) reasoning and chat models.

```bash
codebite init --provider deepseek --model deepseek-chat --apikey sk-...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `deepseek-chat` | Chat model (DeepSeek V3) |
| `deepseek-reasoner` | Reasoning model (R1) |

**Embeddings:** Not supported.

---

### AWS Bedrock

[Amazon Bedrock](https://aws.amazon.com/bedrock/) — access Anthropic, Meta, Amazon, and other models through AWS.

**Auth:** Uses the AWS credential chain. Set standard AWS environment variables — no `--apikey` is used. Set `--apikey` to any placeholder value.

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

codebite init --provider bedrock \
  --model anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --apikey aws-iam
```

**Popular models:**

| Model ID | Notes |
|----------|-------|
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | Claude 3.5 Sonnet |
| `anthropic.claude-3-5-haiku-20241022-v1:0` | Claude 3.5 Haiku |
| `amazon.nova-pro-v1:0` | Amazon Nova Pro |
| `amazon.nova-lite-v1:0` | Amazon Nova Lite |
| `meta.llama3-3-70b-instruct-v1:0` | Meta Llama 3.3 70B |

**Embedding model:** `amazon.titan-embed-text-v2:0`

---

### Azure OpenAI

[Azure OpenAI Service](https://azure.microsoft.com/en-us/products/ai-services/openai-service). Requires your Azure endpoint as `--base-url`.

```bash
codebite init --provider azure \
  --model gpt-4o \
  --apikey <azure-api-key> \
  --base-url https://<resource>.openai.azure.com/openai/deployments
```

The model name must match your Azure **deployment name**.

**Embedding model:** `text-embedding-3-small` (must be deployed in your Azure resource)

---

### Together AI

[Together AI](https://www.together.ai) — hosted open models.

```bash
codebite init --provider togetherai \
  --model meta-llama/Llama-3.3-70B-Instruct-Turbo \
  --apikey ...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `meta-llama/Llama-3.3-70B-Instruct-Turbo` | Llama 3.3 70B |
| `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | Llama 3.1 8B |
| `mistralai/Mixtral-8x7B-Instruct-v0.1` | Mixtral 8x7B |
| `Qwen/Qwen2.5-72B-Instruct-Turbo` | Qwen 2.5 72B |

**Embeddings:** Not supported.

---

### Fireworks AI

[Fireworks AI](https://fireworks.ai) — fast open-model inference.

```bash
codebite init --provider fireworks \
  --model accounts/fireworks/models/llama-v3p3-70b-instruct \
  --apikey fw_...
```

**Popular models:**

| Model | Notes |
|-------|-------|
| `accounts/fireworks/models/llama-v3p3-70b-instruct` | Llama 3.3 70B |
| `accounts/fireworks/models/llama-v3p1-8b-instruct` | Llama 3.1 8B |
| `accounts/fireworks/models/mixtral-8x7b-instruct` | Mixtral 8x7B |
| `accounts/fireworks/models/deepseek-r1` | DeepSeek R1 |

**Embeddings:** Not supported.

---

### LiteLLM

[LiteLLM](https://github.com/BerriAI/litellm) is an OpenAI-compatible proxy that can route to 100+ models from any provider. Run it locally or point to a hosted instance.

```bash
# Start LiteLLM locally (example)
litellm --model ollama/llama3

# Configure codebite to use it
codebite init --provider litellm \
  --model ollama/llama3 \
  --apikey none \
  --base-url http://localhost:4000
```

When `--base-url` is omitted, codebite defaults to `http://localhost:4000`.

**Examples — model strings depend on your LiteLLM config:**

| Model string | What LiteLLM routes to |
|-------------|------------------------|
| `ollama/llama3` | Local Ollama |
| `ollama/mistral` | Local Mistral via Ollama |
| `openai/gpt-4o` | OpenAI (via LiteLLM proxy) |
| `anthropic/claude-3-5-sonnet` | Anthropic (via LiteLLM proxy) |
| `bedrock/anthropic.claude-3-5-sonnet` | AWS Bedrock (via LiteLLM proxy) |

**Embedding model:** Routes `text-embedding-3-small` through LiteLLM. Ensure your LiteLLM instance supports embeddings.

---

## Choosing a provider for `codebite index`

`codebite index` requires embeddings. Only the following providers support `codebite index`:

| Provider | Embedding model used |
|----------|---------------------|
| `openai` | `text-embedding-3-small` |
| `vercel` | `openai/text-embedding-3-small` (via gateway) |
| `google` | `text-embedding-004` |
| `mistral` | `mistral-embed` |
| `cohere` | `embed-multilingual-v3.0` |
| `bedrock` | `amazon.titan-embed-text-v2:0` |
| `azure` | `text-embedding-3-small` |
| `litellm` | `text-embedding-3-small` (proxied) |

If your primary provider doesn't support embeddings (e.g. Anthropic, Groq, xAI), you have two options:

1. Use a different provider for indexing — switch temporarily:
   ```bash
   # Temporarily use openai for indexing
   CODEBITE_API_KEY=sk-... codebite index
   ```
   ...and keep your preferred provider for `codebite ask`.

2. Skip indexing — semantic search won't be available, but all other tools still work.
