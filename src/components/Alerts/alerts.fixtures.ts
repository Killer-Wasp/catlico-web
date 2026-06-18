// Mock alert data for the Alerts triage queue, ported from the design
// prototype (docs/webdesign.html). Test fixture: the live list is served by
// alertsQueries; this seed only primes the query cache in tests.

import type { Alert } from './alerts.types'

export const initialAlerts: Alert[] = [
  {
    id: 'AL-9123',
    sev: 4,
    tlp: 3,
    title: 'Possible ransomware staging — mass file rename on FILESRV-AU02',
    src: 'CrowdStrike',
    tags: ['T1486', 'ransomware'],
    ageMin: 14,
    breach: false,
    description:
      'CrowdStrike detected >4,000 file renames with appended extension .0rgn on FILESRV-AU02 within 90 seconds, initiated by svchost.exe spawned from an unsigned binary in C:\\PerfLogs\\. Shadow copies deletion attempted (blocked).',
    observables: [
      { type: 'host', value: 'FILESRV-AU02' },
      { type: 'hash', value: '9f86d081884c7d65...' },
      { type: 'file', value: 'C:\\PerfLogs\\upd.exe' },
    ],
    similarCases: [
      {
        id: '#1841',
        title: 'Ransomware staging on FILESRV-AU02',
        status: 'Open',
      },
    ],
  },
  {
    id: 'AL-9119',
    sev: 4,
    tlp: 2,
    title: 'OAuth consent grant to unverified app for 3 privileged users',
    src: 'Defender XDR',
    tags: ['T1528', 'identity'],
    ageMin: 42,
    breach: true,
    description:
      'Defender XDR raised this alert after an unverified multi-tenant application was granted Mail.ReadWrite and offline_access by three privileged users within 11 minutes.',
    observables: [
      { type: 'user', value: 'svc-finops@origin.example' },
      { type: 'app', value: '7f3c...91ab' },
      { type: 'scope', value: 'Mail.ReadWrite' },
    ],
    similarCases: [
      {
        id: '#1842',
        title: 'OAuth consent grant — privileged account compromise',
        status: 'In progress',
      },
    ],
  },
  {
    id: 'AL-9111',
    sev: 3,
    tlp: 2,
    title: 'Impossible travel: AU → RO sign-in, MFA fatigue pattern',
    src: 'Defender XDR',
    tags: ['T1110.003'],
    ageMin: 67,
    breach: false,
    description:
      'Microsoft sign-in telemetry shows a successful AU login followed by repeated MFA prompts and a Romania login attempt from a new device fingerprint.',
    observables: [
      { type: 'user', value: 'r.joshi@origin.example' },
      { type: 'ip', value: '203.0.113.84' },
    ],
    similarCases: [],
  },
  {
    id: 'AL-9108',
    sev: 3,
    tlp: 2,
    title: 'Outbound beaconing to rare domain from OT jump host',
    src: 'Splunk ES',
    tags: ['T1071', 'ot-segment'],
    ageMin: 88,
    breach: true,
    description:
      'Splunk ES detected periodic outbound TLS traffic from the OT jump host to a rare domain with no prior enterprise reputation.',
    observables: [
      { type: 'host', value: 'OT-JUMP-02' },
      { type: 'domain', value: 'relay-update.example' },
    ],
    similarCases: [
      {
        id: '#1839',
        title: 'Beaconing from OT jump host — rare destination',
        status: 'In progress',
      },
    ],
  },
  {
    id: 'AL-9102',
    sev: 3,
    tlp: 1,
    title: 'Credential-phish campaign targeting retail billing team (38 rcpts)',
    src: 'Proofpoint',
    tags: ['T1566.002', 'phishing'],
    ageMin: 121,
    breach: false,
    description:
      'Proofpoint identified a credential-harvesting campaign impersonating the retail billing portal and delivered to 38 recipients.',
    observables: [
      { type: 'domain', value: 'billing-origin.example' },
      { type: 'mail', value: 'billing-update@example.net' },
    ],
    similarCases: [
      {
        id: '#1834',
        title: 'Credential phish — retail billing team',
        status: 'In progress',
      },
    ],
  },
  {
    id: 'AL-9097',
    sev: 2,
    tlp: 1,
    title: 'New local admin created outside change window — WKS-4471',
    src: 'Splunk ES',
    tags: ['T1136.001'],
    ageMin: 163,
    breach: false,
    description:
      'A local administrator account was created on WKS-4471 outside the approved change window and without a matching service desk ticket.',
    observables: [
      { type: 'host', value: 'WKS-4471' },
      { type: 'user', value: 'localadmin-temp' },
    ],
    similarCases: [
      {
        id: '#1836',
        title: 'Local admin created outside change window',
        status: 'Waiting',
      },
    ],
  },
  {
    id: 'AL-9093',
    sev: 2,
    tlp: 2,
    title: 'MISP IOC match: known C2 IP touched perimeter (blocked)',
    src: 'MISP',
    tags: ['ioc-match'],
    ageMin: 201,
    breach: false,
    description:
      'MISP matched a known command-and-control IP in blocked perimeter traffic. No successful session was observed.',
    observables: [
      { type: 'ip', value: '203.0.113.47' },
      { type: 'rule', value: 'misp-c2-feed' },
    ],
    similarCases: [],
  },
  {
    id: 'AL-9090',
    sev: 2,
    tlp: 0,
    title: 'Unusual volume of DNS TXT queries from CI runner pool',
    src: 'Splunk ES',
    tags: ['T1071.004'],
    ageMin: 240,
    breach: false,
    description:
      'DNS telemetry shows elevated TXT query volume from CI runners, including repeated lookups for encoded subdomains.',
    observables: [
      { type: 'host', value: 'CI-RUNNER-POOL' },
      { type: 'domain', value: 'txt-sync.example' },
    ],
    similarCases: [
      {
        id: '#1830',
        title: 'DNS TXT exfil pattern from CI runners',
        status: 'Waiting',
      },
    ],
  },
  {
    id: 'AL-9084',
    sev: 1,
    tlp: 1,
    title: 'EDR sensor offline > 72h on 6 corporate laptops',
    src: 'CrowdStrike',
    tags: ['hygiene'],
    ageMin: 355,
    breach: false,
    description:
      'CrowdStrike reports that six corporate laptops have not checked in for more than 72 hours and are missing current sensor health data.',
    observables: [{ type: 'fleet', value: '6 endpoints' }],
    similarCases: [
      {
        id: '#1827',
        title: 'EDR coverage gap — 6 laptops offline',
        status: 'Resolved',
      },
    ],
  },
  {
    id: 'AL-9080',
    sev: 1,
    tlp: 0,
    title: 'TLS certificate for partner API expires in 9 days',
    src: 'Splunk ES',
    tags: ['hygiene'],
    ageMin: 402,
    breach: false,
    description:
      'Certificate monitoring reports the partner API TLS certificate will expire in 9 days without a replacement certificate observed.',
    observables: [
      { type: 'host', value: 'partner-api.origin.example' },
      { type: 'cert', value: 'expires in 9 days' },
    ],
    similarCases: [],
  },
]
