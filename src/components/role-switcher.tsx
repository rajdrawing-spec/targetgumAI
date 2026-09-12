'use client'

import { useTransition } from 'react'
import { Shield, Briefcase, User, Sparkles, Loader2 } from 'lucide-react'
import { switchRoleAction } from '@/app/actions/switch-role'
import { cn } from '@/lib/utils'

interface RoleSwitcherProps {
  currentRole: string
  userName?: string | null
}

const ROLES = [
  {
    id: 'super_admin' as const,
    label: 'Super Admin',
    desc: 'Full Agency Access, Delete Clients, All Tools',
    icon: Shield,
    color: 'bg-[#E5252A]/15 text-[#FF4D4F] border border-[#E5252A]/40',
    activeRing: 'ring-1 ring-[#E5252A]',
  },
  {
    id: 'marketing_employee' as const,
    label: 'Marketing Manager',
    desc: 'Ad Sets, Keywords, Post Scheduling, AI Reports',
    icon: Briefcase,
    color: 'bg-blue-500/15 text-blue-300 border border-blue-500/40',
    activeRing: 'ring-1 ring-blue-500',
  },
  {
    id: 'client_user' as const,
    label: 'Client User',
    desc: 'Client Portal, Ad Impressions, Shared Reports',
    icon: User,
    color: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
    activeRing: 'ring-1 ring-emerald-500',
  },
]

export function RoleSwitcher({ currentRole }: RoleSwitcherProps) {
  const [isPending, startTransition] = useTransition()

  const handleSwitch = (roleId: 'super_admin' | 'marketing_employee' | 'client_user') => {
    if (roleId === currentRole || (roleId === 'marketing_employee' && currentRole === 'account_manager')) return
    startTransition(async () => {
      await switchRoleAction(roleId)
    })
  }

  const isRoleActive = (roleId: string) => {
    if (roleId === currentRole) return true
    if (roleId === 'marketing_employee' && (currentRole === 'marketing_employee' || currentRole === 'account_manager')) return true
    return false
  }

  return (
    <div className="flex items-center gap-2 rounded border border-[#27272A] bg-[#121215] p-1 shadow-subtle">
      <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-[#A1A1AA]">
        <Sparkles className="h-3.5 w-3.5 text-[#E5252A]" />
        <span className="font-semibold text-[#F4F4F6] hidden sm:inline">Role:</span>
      </div>

      <div className="flex items-center gap-1">
        {ROLES.map((r) => {
          const active = isRoleActive(r.id)
          const Icon = r.icon

          return (
            <button
              key={r.id}
              type="button"
              disabled={isPending}
              onClick={() => handleSwitch(r.id)}
              title={`${r.label} — ${r.desc}`}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all',
                active
                  ? `${r.color} ${r.activeRing} font-semibold shadow-sm`
                  : 'text-[#A1A1AA] hover:bg-[#18181C] hover:text-[#F4F4F6]',
                isPending && 'opacity-60 cursor-not-allowed'
              )}
            >
              {isPending && active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="hidden md:inline">{r.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
