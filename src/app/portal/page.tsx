import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Users } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAccessibleClients } from '@/lib/clients/list'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * A `client_user` is normally linked to exactly one client - go straight
 * there. The rare multi-client case (one contact representing two brands,
 * `ClientUser` has no unique-per-user constraint) gets a picker instead of
 * guessing.
 */
export default async function PortalOverviewPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const clients = await listAccessibleClients(ctx)

  if (clients.length === 1) {
    redirect(`/portal/clients/${clients[0]!.id}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Your clients</h1>
      {clients.length === 0 ? (
        <EmptyState icon={Users} title="No client is linked to your account yet" />
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Link key={client.id} href={`/portal/clients/${client.id}`}>
              <Card className="transition-shadow hover:shadow-popover">
                <CardContent className="flex items-center justify-between p-4">
                  <span className="text-sm font-medium text-foreground">{client.name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
