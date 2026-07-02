import type { FunctionPublic } from '#/components/Functions/functionsQueries'

export type FunctionTrigger = 'scheduled' | 'event' | 'manual' | 'api'
export type FunctionRuntime = 'javascript' | 'python'

export type FunctionAutomation = {
  id: number
  name: string
  description: string
  runtime: FunctionRuntime
  trigger: FunctionTrigger
  triggerConfig: Record<string, unknown>
  profile: string
  enabled: boolean
  timeout: number
  egress: string
  approval: boolean
  code: string
  secrets: string[]
  runCount: number
  errorCount: number
  runs: {
    status: string
    trigger: string
    started: string
    duration: string
    attempts: number
    error?: string
  }[]
}

export type DraftUpdater = (
  update: (current: FunctionAutomation) => FunctionAutomation,
) => void

export const SAMPLE_CODE = `// runs as the pinned profile; ctx is the SDK
export async function handler(ctx, event) {
  const obs = event.observable;
  if (obs.dataType !== "ip") return;
  const rep = await ctx.analyzers.run("AbuseIPDB", obs);
  if (rep.verdict === "malicious") {
    await ctx.case.addTag(event.caseId, "auto:malicious-ip");
    await ctx.notify.slack("#soc-alerts",
      \`Malicious IP \${obs.data} auto-tagged on \${event.caseId}\`);
  }
}`

export const PROFILE_OPTIONS = [
  'analyst',
  'read-only',
  'senior-analyst',
  'org-admin',
]

export function fromApi(f: FunctionPublic): FunctionAutomation {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    runtime: f.runtime,
    trigger: f.trigger,
    triggerConfig: f.trigger_config,
    profile: f.profile,
    enabled: f.enabled,
    timeout: f.timeout_ms,
    egress: f.egress,
    approval: f.approval,
    code: f.code,
    secrets: f.secrets,
    runCount: f.run_count,
    errorCount: f.error_count,
    runs: (f.runs ?? []).map((r) => ({
      status: r.status,
      trigger: r.trigger,
      started: new Date(r.started_at).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      duration: `${(r.duration_ms / 1000).toFixed(1)}s`,
      attempts: r.attempts,
      error: r.error ?? undefined,
    })),
  }
}

export function newFunctionAutomation(): FunctionAutomation {
  return {
    id: 0,
    name: '',
    description: '',
    runtime: 'javascript',
    trigger: 'event',
    triggerConfig: { condition: '' },
    profile: 'analyst',
    enabled: false,
    timeout: 15000,
    egress: '',
    approval: false,
    code: SAMPLE_CODE,
    secrets: [],
    runCount: 0,
    errorCount: 0,
    runs: [],
  }
}
