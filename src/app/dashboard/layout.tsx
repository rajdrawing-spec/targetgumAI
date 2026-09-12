import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { LogOut, Activity } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { signOut } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard-nav'
import { ToastProvider } from '@/components/ui/toast'
import { RoleSwitcher } from '@/components/role-switcher'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  account_manager: 'Account Manager',
  marketing_employee: 'Marketing Specialist',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')
  if (ctx.isClientUser) redirect('/portal')

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#09090B] text-[#F4F4F6]">
        {/* Left Precision Sidebar */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-[#27272A] bg-[#121215]">
          {/* Brand Header with TargetGum Logo */}
          <div className="px-5 py-4 border-b border-[#27272A]">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#27272A] bg-[#09090B] shadow-sm group-hover:border-[#E5252A] transition-colors">
                <Image
                  src="/logo.jpg"
                  alt="TargetGum"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-display text-base font-bold tracking-tight text-[#FFFFFF]">
                  Target<span className="text-[#E5252A]">Gum</span>
                </div>
                <span className="text-[10px] font-mono-data font-semibold uppercase tracking-wider text-[#A1A1AA] block truncate">
                  Precision Marketing
                </span>
              </div>
            </Link>
          </div>

          {/* Nav List */}
          <div className="flex-1 overflow-y-auto">
            <DashboardNav />
          </div>

          {/* User & Org Session Footer */}
          <div className="mt-auto border-t border-[#27272A] p-3 bg-[#0E0E11]">
            <div className="flex items-center justify-between gap-2 rounded px-2.5 py-1.5 bg-[#141418] border border-[#27272A]">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#F4F4F6]">
                  {ROLE_LABEL[ctx.roleKey] ?? ctx.roleKey}
                </p>
                <p className="truncate text-[11px] font-mono-data text-[#A1A1AA]">
                  {ctx.organizationId ? `Org: ${ctx.organizationId.slice(0, 8)}...` : 'System Mode'}
                </p>
              </div>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/sign-in' })
                }}
              >
                <button
                  type="submit"
                  title="Sign out"
                  className="flex h-7 w-7 items-center justify-center rounded text-[#71717A] transition-colors hover:bg-[#E5252A]/15 hover:text-[#FF4D4F]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#27272A] bg-[#121215]/85 px-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm font-semibold tracking-tight text-[#FFFFFF] hover:text-[#E5252A] transition-colors"
              >
                TargetGum Agency Terminal
              </Link>
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#E5252A]/30 bg-[#E5252A]/10 px-2.5 py-0.5 text-[11px] font-mono-data font-medium text-[#FF4D4F]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E5252A] animate-pulse" />
                <span>AI ENGINE ONLINE</span>
              </div>
            </div>

            <RoleSwitcher currentRole={ctx.roleKey} userName={ctx.userId} />
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 bg-[#09090B]">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
