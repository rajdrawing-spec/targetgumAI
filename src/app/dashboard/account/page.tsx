import { redirect } from 'next/navigation'
import { KeyRound, ShieldCheck, User } from 'lucide-react'
import { getCurrentAuthContext } from '@/lib/auth/current-context'
import { getOwnProfile } from '@/lib/users/profile'
import { changeOwnPasswordAction, updateOwnProfileAction } from './actions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'
import { ActionForm, FieldError, SubmitButton } from '@/components/ui/action-form'
import { formatDateTime } from '@/lib/format'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  employee: 'Employee',
  client: 'Client',
}

/**
 * "My Account" - a signed-in user's own details and password, self-service
 * only (src/lib/users/profile.ts - every action here touches exclusively
 * `ctx.userId`, never a caller-supplied id, so no permission check is
 * needed beyond being signed in). Reachable by any authenticated staff
 * member from the sidebar (src/components/dashboard-nav.tsx).
 */
export default async function AccountPage() {
  const ctx = await getCurrentAuthContext()
  if (!ctx) redirect('/sign-in')

  const profile = await getOwnProfile(ctx)

  return (
    <div className="space-y-6">
      <PageHeader title="My Account" description="Your own details and password. Changes here affect only your account." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" /> Profile details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-caption">
            <Badge variant="accent">{ROLE_LABEL[ctx.roleKey] ?? ctx.roleKey}</Badge>
            <span>Member since {formatDateTime(profile.createdAt)}</span>
          </div>

          <ActionForm action={updateOwnProfileAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" defaultValue={profile.name ?? ''} required maxLength={200} />
              <FieldError name="name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email} disabled />
              <p className="mt-1 text-xs text-caption">
                Your email is your sign-in identity and can&apos;t be changed here - ask a Super Admin.
              </p>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> {profile.hasPassword ? 'Change password' : 'Set a password'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profile.hasPassword && (
            <p className="text-sm text-caption">
              Your account currently signs in with Google only. Set a password to also be able to sign in with email + password.
            </p>
          )}
          <ActionForm action={changeOwnPasswordAction} resetOnSuccess className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profile.hasPassword && (
              <div className="sm:col-span-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
                <FieldError name="currentPassword" />
              </div>
            )}
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
              />
              <FieldError name="newPassword" />
              <p className="mt-1 text-xs text-caption">At least 10 characters.</p>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Saving…">{profile.hasPassword ? 'Update password' : 'Set password'}</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Two-factor authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={profile.mfaEnabled ? 'success' : 'neutral'}>{profile.mfaEnabled ? 'Enabled' : 'Not enabled'}</Badge>
            <span className="text-caption">Self-service enrollment isn&apos;t available yet - ask a Super Admin.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
