'use client'

import { useState, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  Sparkles,
  CheckCircle2,
  Clock,
  Share2,
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'

interface SocialHubProps {
  clients?: Array<{ id: string; name: string }>
}

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X'] as const

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: 'bg-success-bg text-success',
  PENDING_APPROVAL: 'bg-destructive-bg text-destructive',
  SCHEDULED: 'bg-info-bg text-info',
  DRAFT: 'bg-muted text-muted-foreground',
}

/**
 * The Social Hub's calendar + composer - rebuilt onto the app's design
 * system (Card/Button/Input, semantic success/warning/destructive/info
 * tokens) rather than the old dark "terminal" theme's `terminal-panel`/
 * `font-mono-data`/raw hex classes, which had never been migrated (this was
 * the one screen still rendering the pre-redesign look by default, since
 * it's the Content Calendar page's default "Calendar" view - see
 * docs/DECISIONS.md).
 */
export function SocialCalendarHub({ clients = [] }: SocialHubProps) {
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '')
  const [activePlatform, setActivePlatform] = useState<(typeof PLATFORMS)[number]>('INSTAGRAM')
  const [caption, setCaption] = useState(
    'Precision targeting drives predictable customer acquisition. Discover how the TargetGum Operating System streamlines your multi-channel ad spend.'
  )
  const [hashtags, setHashtags] = useState('#PerformanceMarketing #PPC #GrowthEngine #TargetGum')
  const [selectedDate, setSelectedDate] = useState('2026-09-15')
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)

  // September 2026 calendar days (illustrative sample data)
  const calendarDays = useMemo(() => {
    const days = []
    for (let p = 0; p < 2; p++) {
      days.push({ day: 30 + p, isCurrentMonth: false, date: `2026-08-${30 + p}` })
    }
    for (let d = 1; d <= 30; d++) {
      const dStr = d < 10 ? `0${d}` : `${d}`
      days.push({ day: d, isCurrentMonth: true, date: `2026-09-${dStr}` })
    }
    while (days.length % 7 !== 0) {
      days.push({ day: days.length - 31, isCurrentMonth: false, date: `2026-10-01` })
    }
    return days
  }, [])

  const samplePosts = [
    { date: '2026-09-04', platform: 'INSTAGRAM', title: 'Product Showcase Reel', status: 'PUBLISHED' },
    { date: '2026-09-08', platform: 'LINKEDIN', title: 'Q3 Agency ROAS Report', status: 'PUBLISHED' },
    { date: '2026-09-12', platform: 'FACEBOOK', title: 'High-Intent Ad Angle', status: 'PENDING_APPROVAL' },
    { date: '2026-09-15', platform: 'INSTAGRAM', title: 'Titanium Cold Retention', status: 'SCHEDULED' },
    { date: '2026-09-18', platform: 'X', title: 'Performance Metrics Teardown', status: 'DRAFT' },
    { date: '2026-09-22', platform: 'LINKEDIN', title: 'Autonomous AI Case Study', status: 'SCHEDULED' },
  ]

  const handleEnhanceCopy = () => {
    setIsGeneratingCopy(true)
    setTimeout(() => {
      setIsGeneratingCopy(false)
      setCaption(
        'Stop guessing your ad budget. High-performing digital agencies utilize precision telemetry and automated multi-channel optimization to scale ROAS by 4.2x without increasing CAC.'
      )
    }, 700)
  }

  return (
    <div className="space-y-6">
      {/* Hub Header */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Metricool &amp; Social Engine</p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <CalendarIcon className="h-5 w-5 text-primary" /> Social Hub &amp; Visual Scheduler
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Plan, compose, and automate social media releases with multi-network Metricool integration.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {clients.length > 0 && (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="rounded-xl border-2 border-input bg-card px-3 py-1.5 text-xs text-foreground focus-visible:border-primary focus-visible:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <Button type="button" size="sm" onClick={handleEnhanceCopy} disabled={isGeneratingCopy} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Copy Enhancer</span>
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: 30-Day Interactive Calendar Grid */}
        <Card className="space-y-3 p-4 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold text-foreground">September 2026</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className="flex items-center gap-1 text-success">
                <span className="h-2 w-2 rounded-full bg-success" /> Published
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <span className="h-2 w-2 rounded-full bg-destructive" /> Pending
              </span>
              <span className="flex items-center gap-1 text-info">
                <span className="h-2 w-2 rounded-full bg-info" /> Scheduled
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 border-b border-border py-1 text-center text-[10px] font-semibold text-muted-foreground">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d, i) => {
              const postsOnDay = samplePosts.filter((p) => p.date === d.date)
              const isSelected = selectedDate === d.date

              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => d.isCurrentMonth && setSelectedDate(d.date)}
                  className={cn(
                    'flex min-h-[58px] flex-col justify-between rounded-lg border p-1.5 text-left transition-colors',
                    d.isCurrentMonth ? 'bg-muted/40 border-border hover:bg-muted' : 'border-transparent bg-muted/10 opacity-40',
                    isSelected && 'border-primary ring-2 ring-primary/25',
                  )}
                >
                  <span className={cn('text-[10px] font-semibold', isSelected ? 'text-primary' : 'text-muted-foreground')}>
                    {d.day}
                  </span>

                  <div className="space-y-0.5">
                    {postsOnDay.map((post, pIdx) => (
                      <div
                        key={pIdx}
                        className={cn('truncate rounded px-1 py-0.5 text-[8px] font-bold uppercase', STATUS_STYLE[post.status])}
                        title={post.title}
                      >
                        {post.platform.slice(0, 2)}: {post.title}
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        {/* Right: Live Composer & Platform Simulation */}
        <Card className="space-y-4 p-4 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
              <Share2 className="h-3.5 w-3.5 text-primary" /> Post Composer
            </span>
            <div className="flex items-center gap-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePlatform(p)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10px] font-semibold transition-colors',
                    activePlatform === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {p.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>

          {/* Live Mobile Feed Card Preview */}
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                TG
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">TargetGum Marketing</p>
                <p className="text-[10px] text-muted-foreground">
                  {activePlatform} · Scheduled for {selectedDate}
                </p>
              </div>
            </div>

            <p className="whitespace-pre-line text-xs leading-relaxed text-foreground">{caption}</p>

            <p className="text-[11px] font-medium text-primary">{hashtags}</p>

            <div className="flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
              <div className="flex items-center gap-3">
                <Heart className="h-3.5 w-3.5" />
                <MessageCircle className="h-3.5 w-3.5" />
                <Repeat className="h-3.5 w-3.5" />
              </div>
              <Bookmark className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Composer Inputs */}
          <div className="space-y-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Post Caption
              </label>
              <Textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tags &amp; Hashtags
              </label>
              <Input type="text" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full gap-2"
              onClick={() => {
                setIsScheduled(true)
                setTimeout(() => setIsScheduled(false), 2500)
              }}
            >
              {isScheduled ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Post Scheduled to Metricool Queue</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Schedule Post for {selectedDate}</span>
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
