import 'server-only'

export type TrackedProject = {
  key: string
  name: string
  githubOwner: string
  githubRepo: string
  branch: string
  domain: string | null
  vercelProjectId: string | null // solo se conoce con certeza para macd-studios (ver WORKLOG 22/09/2026)
}

// Inventario real, sincronizado a mano con MAP.md — no hay forma de leer esto en vivo
// porque los repos viven en el disco local del usuario, no en algo que este servidor pueda ver.
export const TRACKED_PROJECTS: TrackedProject[] = [
  {
    key: 'macd-studios',
    name: 'MACD Studios (web + panel)',
    githubOwner: 'klarospro',
    githubRepo: 'macd-studios-web',
    branch: 'main',
    domain: 'macdestudios.com',
    vercelProjectId: 'macd-studios-web-nd4m',
  },
  {
    key: 'group365',
    name: 'GROUP 360 (cliente)',
    githubOwner: 'moiseschirinooficial99-ops',
    githubRepo: 'group365',
    branch: 'main',
    domain: 'group360iniciativas.com',
    vercelProjectId: null,
  },
  {
    key: 'vida-nueva-reus',
    name: 'Vida Nueva Reus (cliente)',
    githubOwner: 'reusvidanueva',
    githubRepo: 'vida-nueva-reus.',
    branch: 'main',
    domain: null,
    vercelProjectId: null,
  },
  {
    key: 'aurora-dental',
    name: 'Aurora Dental (demo)',
    githubOwner: 'klarospro',
    githubRepo: 'aurora-dental-demo',
    branch: 'main',
    domain: null,
    vercelProjectId: null,
  },
  {
    key: 'pizza-studio',
    name: 'Pizza Studio (demo)',
    githubOwner: 'klarospro',
    githubRepo: 'pizza-studio-demo',
    branch: 'main',
    domain: null,
    vercelProjectId: null,
  },
  {
    key: 'vista-inmobiliaria',
    name: 'Vista Inmobiliaria (demo)',
    githubOwner: 'klarospro',
    githubRepo: 'vista-inmobiliaria-demo',
    branch: 'main',
    domain: null,
    vercelProjectId: null,
  },
]

export type GithubStatus =
  | { ok: true; message: string; sha: string; authorDate: string; url: string }
  | { ok: false; reason: 'private_no_token' | 'not_found' | 'error' }

export async function getGithubStatus(project: TrackedProject): Promise<GithubStatus> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(
      `https://api.github.com/repos/${project.githubOwner}/${project.githubRepo}/commits/${project.branch}`,
      { headers, next: { revalidate: 300 } }
    )

    if (res.status === 404) {
      return { ok: false, reason: token ? 'not_found' : 'private_no_token' }
    }
    if (!res.ok) return { ok: false, reason: 'error' }

    const data = await res.json()
    return {
      ok: true,
      message: (data.commit?.message as string)?.split('\n')[0] ?? '(sin mensaje)',
      sha: (data.sha as string)?.slice(0, 7) ?? '',
      authorDate: data.commit?.author?.date ?? '',
      url: data.html_url ?? `https://github.com/${project.githubOwner}/${project.githubRepo}`,
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export type VercelStatus =
  | { ok: true; state: string; createdAt: string; url: string }
  | { ok: false; reason: 'no_token' | 'error' }

export async function getVercelStatus(project: TrackedProject): Promise<VercelStatus | null> {
  if (!project.vercelProjectId) return null
  const token = process.env.VERCEL_API_TOKEN
  if (!token) return { ok: false, reason: 'no_token' }

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${project.vercelProjectId}&target=production&limit=1`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } }
    )
    if (!res.ok) return { ok: false, reason: 'error' }

    const data = await res.json()
    const dep = data.deployments?.[0]
    if (!dep) return { ok: false, reason: 'error' }

    return {
      ok: true,
      state: dep.state ?? dep.readyState ?? 'UNKNOWN',
      createdAt: dep.createdAt ? new Date(dep.createdAt).toISOString() : '',
      url: dep.url ? `https://${dep.url}` : '',
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
