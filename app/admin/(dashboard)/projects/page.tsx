import { requireSession } from '@/lib/admin/dal'
import { PageHeader, Card, Badge } from '@/components/admin/ui'
import { TRACKED_PROJECTS, getGithubStatus, getVercelStatus } from '@/lib/admin/project-status'

export const revalidate = 0

function timeAgo(iso: string) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

const VERCEL_STATE_TONE: Record<string, 'positive' | 'negative' | 'gold' | 'muted'> = {
  READY: 'positive',
  ERROR: 'negative',
  BUILDING: 'gold',
  QUEUED: 'gold',
  CANCELED: 'muted',
}

export default async function ProjectsPage() {
  await requireSession()

  const rows = await Promise.all(
    TRACKED_PROJECTS.map(async (project) => ({
      project,
      github: await getGithubStatus(project),
      vercel: await getVercelStatus(project),
    }))
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estado de proyectos"
        subtitle="Todos los proyectos de MACD Studios — último commit real en cada repo, y deploy de producción donde se conoce."
      />

      <div className="grid gap-4">
        {rows.map(({ project, github, vercel }) => (
          <Card key={project.key}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-medium">{project.name}</h2>
                  {project.domain && (
                    <a
                      href={`https://${project.domain}`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-zinc-500 hover:text-[#D4AF37]"
                    >
                      {project.domain}
                    </a>
                  )}
                </div>
                <a
                  href={`https://github.com/${project.githubOwner}/${project.githubRepo}`}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-zinc-600 hover:text-zinc-400"
                >
                  {project.githubOwner}/{project.githubRepo} · {project.branch}
                </a>
              </div>

              {vercel && (
                <Badge tone={vercel.ok ? (VERCEL_STATE_TONE[vercel.state] ?? 'muted') : 'muted'}>
                  {vercel.ok ? `Deploy: ${vercel.state}` : vercel.reason === 'no_token' ? 'VERCEL_API_TOKEN no configurado' : 'Deploy: sin datos'}
                </Badge>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
              {github.ok ? (
                <div className="text-sm">
                  <a href={github.url} target="_blank" rel="noopener" className="text-zinc-300 hover:text-white">
                    {github.message}
                  </a>
                  <span className="text-zinc-600 ml-2">
                    {github.sha} · {timeAgo(github.authorDate)}
                  </span>
                </div>
              ) : (
                <div className="text-sm text-zinc-600">
                  {github.reason === 'private_no_token' && 'Repo privado — falta GITHUB_TOKEN para leer su estado.'}
                  {github.reason === 'not_found' && 'No se encontró el repo o la rama.'}
                  {github.reason === 'error' && 'No se pudo consultar GitHub ahora mismo.'}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
