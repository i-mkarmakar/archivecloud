'use client'

import {
  Avatar,
  Button,
  buttonVariants,
  Popover,
  ProgressBar,
  ScrollShadow,
  Separator,
  Surface,
} from '@heroui/react'
import { ArrowRightFromSquare, EllipsisVertical, Gear } from '@gravity-ui/icons'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BrandLogo } from '@/components/drive/BrandLogo'
import { formatBytes } from '@/lib/api'
import type { AuthUser } from '@/lib/auth'
import { getGravatarUrl } from '@/lib/gravatar'
import { cn } from '@/lib/utils'
import {
  type AppMode,
  developerNavItems,
  workspaceNavItems,
} from './config'

type StorageSummary = {
  totalBytes: string
  usedBytes: string
  availableBytes: string
}

type StorageBreakdown = {
  photo: string
  video: string
  document: string
}

export function DashboardSidebar({
  safePathname,
  user,
  storage,
  breakdown,
  onLogout,
  onNavigate,
  className,
  mode,
  onSwitchMode,
}: {
  safePathname: string
  user: AuthUser | null
  storage: StorageSummary | null
  breakdown: StorageBreakdown
  onLogout: () => void
  onNavigate?: () => void
  className?: string
  mode: AppMode
  onSwitchMode: (mode: AppMode) => void
}) {
  const navItems = mode === 'developer' ? developerNavItems : workspaceNavItems
  const used = Number(storage?.usedBytes ?? 0)
  const total = Number(storage?.totalBytes ?? 0)
  const progress = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [avatarError, setAvatarError] = useState(false)

  const breakdownItems = [
    { label: 'Photo', value: formatBytes(breakdown.photo), dotClass: 'bg-success' },
    { label: 'Video', value: formatBytes(breakdown.video), dotClass: 'bg-accent' },
    { label: 'Document', value: formatBytes(breakdown.document), dotClass: 'bg-warning' },
    { label: 'Free Storage', value: formatBytes(storage?.availableBytes), dotClass: 'bg-muted' },
  ]

  useEffect(() => {
    setAvatarError(false)
    getGravatarUrl(user?.email, 64).then(setProfileImageUrl).catch(() => setProfileImageUrl(''))
  }, [user?.email])

  return (
    <Surface
      variant="default"
      className={cn('flex h-full w-64 shrink-0 flex-col border-r border-separator bg-surface', className)}
    >
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
        <BrandLogo className="h-8 w-8" />
        <div className="min-w-0">
          <span className="text-xl font-extrabold tracking-tight text-foreground">ArchiveCloud</span>
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted">
            {mode === 'developer' ? 'Developer Console' : 'Workspace'}
          </p>
        </div>
      </div>

      <Separator />

      <ScrollShadow className="flex-1 px-3 py-3" hideScrollBar>
        <nav className="grid gap-1">
          {navItems.map((item) => {
            const isActive =
              safePathname === item.href ||
              (item.href !== '/developer' &&
                safePathname.startsWith(`${item.href}/`))

            if (item.disabled) {
              return (
                <Button
                  key={item.label}
                  variant="ghost"
                  size="sm"
                  fullWidth
                  isDisabled
                  className="justify-start gap-2.5 font-semibold"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Button>
              )
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                className={buttonVariants({
                  variant: isActive ? 'secondary' : 'ghost',
                  size: 'sm',
                  className: cn(
                    'w-full justify-start gap-2.5 font-semibold',
                    isActive && 'bg-accent-soft text-accent-soft-foreground',
                  ),
                })}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {mode === 'developer' ? (
          <div className="mt-3 border-t border-separator pt-3">
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              className="justify-start gap-2.5 font-semibold"
              onPress={() => onSwitchMode('workspace')}
            >
              Back to Workspace
            </Button>
          </div>
        ) : null}
      </ScrollShadow>

      {mode === 'workspace' ? (
        <div className="border-t border-separator px-4 pb-3 pt-3">
          <div className="mb-3 space-y-2">
            {breakdownItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-2 font-medium">
                  <span className={cn('h-1.5 w-1.5 rounded-full', item.dotClass)} />
                  {item.label}
                </span>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm font-bold text-foreground">
            <span>{formatBytes(storage?.usedBytes)} used</span>
            <span className="text-muted">{formatBytes(storage?.totalBytes)}</span>
          </div>
          <ProgressBar aria-label="Storage usage" value={progress} className="mt-2">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      ) : null}

      <div className="border-t border-separator px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            {profileImageUrl && !avatarError ? (
              <Avatar.Image src={profileImageUrl} alt="" onError={() => setAvatarError(true)} />
            ) : null}
            <Avatar.Fallback>{(user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase()}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{user?.name ?? 'User'}</p>
            <p className="truncate text-xs text-muted">{user?.email ?? 'Loading...'}</p>
          </div>
          <Popover>
            <Popover.Trigger
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                isIconOnly: true,
                className: 'inline-flex shrink-0 items-center justify-center text-muted',
              })}
              aria-label="Account options"
            >
              <EllipsisVertical className="h-4 w-4" />
            </Popover.Trigger>
            <Popover.Content placement="top end" className="w-44 p-1">
              <Popover.Dialog>
                <div className="grid gap-0.5">
                  <Link
                    href="/settings"
                    onClick={onNavigate}
                    className={buttonVariants({
                      variant: 'ghost',
                      size: 'sm',
                      className: 'w-full justify-start gap-2 font-semibold',
                    })}
                  >
                    <Gear className="h-4 w-4 shrink-0" />
                    Settings
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    className="justify-start gap-2 font-semibold text-danger"
                    onPress={onLogout}
                  >
                    <ArrowRightFromSquare className="h-4 w-4 shrink-0" />
                    Log Out
                  </Button>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </div>
      </div>
    </Surface>
  )
}
