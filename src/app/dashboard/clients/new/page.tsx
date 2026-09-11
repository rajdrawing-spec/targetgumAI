import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { listAccountManagerCandidates } from '@/lib/clients/profile'
import { assertPermission } from '@/lib/rbac/guards'
import { PageHeader } from '@/components/ui/page-header'
import { ClientOnboardingForm } from '@/components/clients/client-onboarding-form'

export default async function NewClientPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')
  // Client creation is Super Admin territory (BRD 4.1) - the same rule
  // createClientFullAction enforces server-side; this just avoids showing
  // the form to someone who'd only get a permission error on submit.
  assertPermission(ctx, 'clients.manage')

  const managers = await listAccountManagerCandidates(ctx)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/clients" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Clients
        </Link>
        <div className="mt-2">
          <PageHeader title="Add client" description="Only the client's name is required - fill in whatever else you know now. Everything here can be edited later from the client's workspace." />
        </div>
      </div>
      <ClientOnboardingForm managers={managers} />
    </div>
  )
}
