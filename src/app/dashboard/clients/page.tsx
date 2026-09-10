import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users, ArrowRight, Plus } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAccessibleClients } from '@/lib/clients/list'
import { createClientAction } from '../actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, toSentenceCase } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default async function ClientsPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const clients = await listAccessibleClients(ctx)
  // Client creation is Super Admin territory (BRD Section 4.1 "Manage
  // clients"); Account Manager's "manage assigned clients" (4.2) is about
  // clients they're already assigned to, not creating new ones.
  const canCreate = ctx.permissions.has('clients.manage')

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description={`${clients.length} client${clients.length === 1 ? '' : 's'} you can access`} />

      {canCreate && (
        <Card>
          <CardContent className="p-4">
            <form action={createClientAction} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1">
                <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-caption">
                  New client name
                </label>
                <Input id="name" name="name" type="text" required placeholder="e.g. Acme Retail" />
              </div>
              <Button type="submit">
                <Plus className="h-4 w-4" /> Create client
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {clients.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet" description={canCreate ? 'Create your first client above to get started.' : 'Ask a Super Admin to create a client and assign you to it.'} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/dashboard/clients/${client.id}`}>
              <Card className="group h-full transition-shadow hover:shadow-popover">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-foreground">
                      {client.name.slice(0, 2).toUpperCase()}
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div>
                    <p className="truncate text-sm font-medium text-foreground">{client.name}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Badge variant={client.status === 'ACTIVE' ? 'success' : 'neutral'}>{toSentenceCase(client.status)}</Badge>
                      <Badge variant="neutral">{toSentenceCase(client.automationLevel)}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
