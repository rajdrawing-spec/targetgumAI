'use client'

import React, { useState, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  Sparkles,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  Plus,
  Share2,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SocialHubProps {
  clients?: Array<{ id: string; name: string }>
}

export function SocialCalendarHub({ clients = [] }: SocialHubProps) {
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '')
  const [activePlatform, setActivePlatform] = useState<'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'X'>('INSTAGRAM')
  const [caption, setCaption] = useState(
    'Precision targeting drives predictable customer acquisition. Discover how the TargetGum Operating System streamlines your multi-channel ad spend.'
  )
  const [hashtags, setHashtags] = useState('#PerformanceMarketing #PPC #GrowthEngine #TargetGum')
  const [selectedDate, setSelectedDate] = useState('2026-09-15')
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)

  // September 2026 Calendar days simulation
  const calendarDays = useMemo(() => {
    const days = []
    // Pad for Tuesday start
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

  // Sample scheduled posts
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
      <div className="terminal-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono-data text-[10px] text-[#A1A1AA] mb-1">
            <span className="font-semibold text-[#E5252A]">METRICOOL & SOCIAL ENGINE</span>
            <span>•</span>
            <span>MULTI-CHANNEL POST DISPATCHER</span>
          </div>
          <h2 className="text-lg font-display font-bold text-[#FFFFFF] flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-[#E5252A]" /> Social Hub & Visual Scheduler
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Plan, compose, and automate social media releases with multi-network Metricool integration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {clients.length > 0 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="rounded border border-[#27272A] bg-[#18181C] px-3 py-1.5 text-xs text-[#F4F4F6] focus:border-[#E5252A] focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleEnhanceCopy}
            className="btn-brand flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Copy Enhancer</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 30-Day Interactive Calendar Grid */}
        <div className="lg:col-span-7 terminal-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-[#E5252A]" />
              <span className="font-display text-sm font-semibold text-[#FFFFFF]">
                September 2026
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono-data">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Published
              </span>
              <span className="flex items-center gap-1 text-[#FF4D4F]">
                <span className="h-2 w-2 rounded-full bg-[#E5252A]" /> Pending
              </span>
              <span className="flex items-center gap-1 text-blue-400">
                <span className="h-2 w-2 rounded-full bg-blue-400" /> Scheduled
              </span>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono-data text-[#71717A] py-1 border-b border-[#27272A]">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d, i) => {
              const postsOnDay = samplePosts.filter((p) => p.date === d.date)
              const isSelected = selectedDate === d.date

              return (
                <div
                  key={i}
                  onClick={() => d.isCurrentMonth && setSelectedDate(d.date)}
                  className={cn(
                    'min-h-[58px] p-1.5 rounded border transition-all cursor-pointer flex flex-col justify-between',
                    d.isCurrentMonth ? 'bg-[#18181C] border-[#27272A]' : 'bg-[#0E0E11] border-transparent opacity-40',
                    isSelected && 'border-[#E5252A] ring-1 ring-[#E5252A]'
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px] font-mono-data font-semibold',
                      isSelected ? 'text-[#E5252A]' : 'text-[#A1A1AA]'
                    )}
                  >
                    {d.day}
                  </span>

                  <div className="space-y-0.5">
                    {postsOnDay.map((post, pIdx) => (
                      <div
                        key={pIdx}
                        className={cn(
                          'truncate px-1 py-0.2 rounded text-[8px] font-mono-data font-bold uppercase',
                          post.status === 'PUBLISHED' && 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
                          post.status === 'PENDING_APPROVAL' && 'bg-[#E5252A]/20 text-[#FF4D4F] border border-[#E5252A]/40',
                          post.status === 'SCHEDULED' && 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
                          post.status === 'DRAFT' && 'bg-[#27272A] text-[#A1A1AA]'
                        )}
                        title={post.title}
                      >
                        {post.platform.slice(0, 2)}: {post.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Live Composer & Platform Simulation */}
        <div className="lg:col-span-5 terminal-card p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
            <span className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF] flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5 text-[#E5252A]" /> Post Composer
            </span>
            <div className="flex items-center gap-1">
              {(['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePlatform(p)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono-data rounded transition-colors',
                    activePlatform === p
                      ? 'bg-[#E5252A] text-white font-bold'
                      : 'text-[#A1A1AA] hover:text-white bg-[#18181C]'
                  )}
                >
                  {p.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>

          {/* Live Mobile Feed Card Preview */}
          <div className="rounded border border-[#27272A] bg-[#18181C] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-[#E5252A] flex items-center justify-center text-[10px] font-bold text-white">
                  TG
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FFFFFF]">TargetGum Marketing</p>
                  <p className="text-[9px] font-mono-data text-[#71717A]">
                    {activePlatform} · Scheduled for {selectedDate}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-[#F4F4F6] leading-relaxed whitespace-pre-line">
              {caption}
            </p>

            <p className="text-[11px] font-mono-data text-[#E5252A]">{hashtags}</p>

            {/* Social Engagement Icons */}
            <div className="flex items-center justify-between pt-1 border-t border-[#27272A] text-[#71717A]">
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
              <label className="block text-[11px] font-mono-data text-[#A1A1AA] mb-1">
                Post Caption
              </label>
              <textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full rounded border border-[#27272A] bg-[#18181C] px-3 py-2 text-xs text-[#F4F4F6] focus:border-[#E5252A] focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono-data text-[#A1A1AA] mb-1">
                Tags & Hashtags
              </label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                className="w-full rounded border border-[#27272A] bg-[#18181C] px-3 py-1.5 text-xs text-[#F4F4F6] focus:border-[#E5252A] focus:outline-none font-mono-data"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsScheduled(true)
                  setTimeout(() => setIsScheduled(false), 2500)
                }}
                className="w-full btn-brand py-2 text-xs flex items-center justify-center gap-2"
              >
                {isScheduled ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-white" />
                    <span>Post Scheduled to Metricool Queue</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Schedule Post for {selectedDate}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
