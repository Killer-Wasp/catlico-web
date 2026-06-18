export type ConnectorJobStatus = 'queued' | 'running' | 'success' | 'failure'
export type ConnectorJobVerdict = 'MALICIOUS' | 'SUSPICIOUS' | 'INFO' | 'CLEAN'
export type ConnectorJobObservableType =
  | 'ip'
  | 'domain'
  | 'url'
  | 'hash'
  | 'mail'
export type ConnectorJobTab =
  | 'all'
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'

export type ConnectorJob = {
  id: string
  observableType: ConnectorJobObservableType
  observable: string
  plugin: string
  status: ConnectorJobStatus
  cached?: boolean
  verdict?: ConnectorJobVerdict
  started?: string
  duration?: string
}

export type ConnectorJobReportChip = {
  label: string
  color?: string
}

export type ConnectorJobReportArtifact = {
  type: ConnectorJobObservableType
  value: string
}

export type ConnectorJobReportOperation = {
  action: string
  argument?: string
}

export type ConnectorJobReportEnrichment = {
  id: string
  verdict: ConnectorJobVerdict
  analyzer: string
  meta: string
  chips: ConnectorJobReportChip[]
  artifacts?: ConnectorJobReportArtifact[]
  operations?: ConnectorJobReportOperation[]
}

export type ConnectorJobReportCase = {
  id: string
  title: string
  status: string
}

export type ConnectorJobReport = {
  jobId: string
  observableType: ConnectorJobObservableType
  observable: string
  verdict: ConnectorJobVerdict
  properties: {
    ioc: boolean
    sighted: boolean
    firstSeen: string
    source: string
  }
  enrichments: ConnectorJobReportEnrichment[]
  seenInCases: ConnectorJobReportCase[]
}

export const connectorJobTabs: { value: ConnectorJobTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
]

export const initialConnectorJobs: ConnectorJob[] = [
  {
    id: 'J-7741',
    observableType: 'ip',
    observable: '203.0.113.47',
    plugin: 'AbuseIPDB',
    status: 'success',
    verdict: 'MALICIOUS',
    started: '10:31:02',
    duration: '0.8s',
  },
  {
    id: 'J-7740',
    observableType: 'ip',
    observable: '203.0.113.47',
    plugin: 'MaxMind GeoIP',
    status: 'success',
    cached: true,
    verdict: 'INFO',
    started: '10:31:02',
    duration: '0.1s',
  },
  {
    id: 'J-7739',
    observableType: 'domain',
    observable: 'login-originenergy.support',
    plugin: 'VirusTotal',
    status: 'success',
    verdict: 'SUSPICIOUS',
    started: '10:30:44',
    duration: '2.1s',
  },
  {
    id: 'J-7738',
    observableType: 'url',
    observable: 'hxxps://cdn-au-billing[.]net/invoice.php',
    plugin: 'URLscan.io',
    status: 'running',
    started: '10:33:10',
  },
  {
    id: 'J-7737',
    observableType: 'hash',
    observable: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934...',
    plugin: 'Hybrid Analysis',
    status: 'running',
    started: '10:33:09',
  },
  {
    id: 'J-7736',
    observableType: 'mail',
    observable: 'accounts@billing-origin.co',
    plugin: 'EmailRep',
    status: 'queued',
  },
  {
    id: 'J-7735',
    observableType: 'domain',
    observable: 'secure-origin-payments.example',
    plugin: 'MISP Search',
    status: 'failure',
    started: '10:28:16',
    duration: '0.4s',
  },
  {
    id: 'J-7734',
    observableType: 'hash',
    observable: '44d88612fea8a8f36de82e1278abb02f',
    plugin: 'VirusTotal',
    status: 'success',
    cached: true,
    verdict: 'CLEAN',
    started: '10:24:58',
    duration: '1.3s',
  },
]

export const connectorJobReports: ConnectorJobReport[] = [
  {
    jobId: 'J-7741',
    observableType: 'ip',
    observable: '203.0.113.47',
    verdict: 'MALICIOUS',
    properties: {
      ioc: true,
      sighted: true,
      firstSeen: '09:30',
      source: 'intel feed',
    },
    enrichments: [
      {
        id: 'maxmind',
        verdict: 'INFO',
        analyzer: 'MaxMind GeoIP',
        meta: 'v4.0 · 10:31 · cached',
        chips: [
          { label: 'country=AU', color: 'blue' },
          { label: 'asn=AS7545 TPG', color: 'blue' },
        ],
      },
      {
        id: 'abuseipdb',
        verdict: 'MALICIOUS',
        analyzer: 'AbuseIPDB',
        meta: 'v1.0 · 10:31',
        chips: [
          { label: 'abuse-score=97%', color: 'red' },
          { label: 'reports=41', color: 'yellow' },
        ],
        artifacts: [{ type: 'domain', value: 'cdn-au-billing.net' }],
        operations: [
          { action: 'add_tag', argument: 'tag=abuseipdb:malicious' },
          { action: 'mark_as_ioc' },
        ],
      },
      {
        id: 'greynoise',
        verdict: 'SUSPICIOUS',
        analyzer: 'GreyNoise',
        meta: 'v1.2 · 10:30',
        chips: [
          { label: 'classification=malicious', color: 'red' },
          { label: 'last-seen=2d', color: 'blue' },
        ],
      },
    ],
    seenInCases: [
      {
        id: '#1842',
        title: 'OAuth consent grant — privileged account compromise',
        status: 'IN PROGRESS',
      },
    ],
  },
  {
    jobId: 'J-7740',
    observableType: 'ip',
    observable: '203.0.113.47',
    verdict: 'INFO',
    properties: {
      ioc: true,
      sighted: true,
      firstSeen: '09:30',
      source: 'intel feed',
    },
    enrichments: [
      {
        id: 'maxmind',
        verdict: 'INFO',
        analyzer: 'MaxMind GeoIP',
        meta: 'v4.0 · 10:31 · cached',
        chips: [
          { label: 'country=AU', color: 'blue' },
          { label: 'asn=AS7545 TPG', color: 'blue' },
        ],
      },
    ],
    seenInCases: [
      {
        id: '#1842',
        title: 'OAuth consent grant — privileged account compromise',
        status: 'IN PROGRESS',
      },
    ],
  },
  {
    jobId: 'J-7739',
    observableType: 'domain',
    observable: 'login-originenergy.support',
    verdict: 'SUSPICIOUS',
    properties: {
      ioc: false,
      sighted: true,
      firstSeen: '10:30',
      source: 'phishing inbox',
    },
    enrichments: [
      {
        id: 'virustotal',
        verdict: 'SUSPICIOUS',
        analyzer: 'VirusTotal',
        meta: 'v3.1 · 10:30',
        chips: [
          { label: 'detections=8/92', color: 'yellow' },
          { label: 'registrar=NameSilo', color: 'gray' },
        ],
        artifacts: [{ type: 'ip', value: '198.51.100.22' }],
        operations: [{ action: 'add_tag', argument: 'tag=vt:suspicious' }],
      },
    ],
    seenInCases: [
      {
        id: '#1838',
        title: 'Credential phishing lure targeting retail staff',
        status: 'TRIAGE',
      },
    ],
  },
  {
    jobId: 'J-7734',
    observableType: 'hash',
    observable: '44d88612fea8a8f36de82e1278abb02f',
    verdict: 'CLEAN',
    properties: {
      ioc: false,
      sighted: false,
      firstSeen: '10:24',
      source: 'case upload',
    },
    enrichments: [
      {
        id: 'virustotal',
        verdict: 'CLEAN',
        analyzer: 'VirusTotal',
        meta: 'v3.1 · 10:24 · cached',
        chips: [
          { label: 'detections=0/71', color: 'green' },
          { label: 'type=text/plain', color: 'gray' },
        ],
      },
    ],
    seenInCases: [],
  },
]

export function filterConnectorJobsByTab(
  jobs: ConnectorJob[],
  tab: ConnectorJobTab,
) {
  if (tab === 'all') return jobs
  return jobs.filter((job) => job.status === tab)
}

export function countConnectorJobsByTab(jobs: ConnectorJob[]) {
  return connectorJobTabs.reduce(
    (counts, tab) => ({
      ...counts,
      [tab.value]: filterConnectorJobsByTab(jobs, tab.value).length,
    }),
    {} as Record<ConnectorJobTab, number>,
  )
}

export function getConnectorJobReport(jobId: string) {
  return connectorJobReports.find((report) => report.jobId === jobId)
}
