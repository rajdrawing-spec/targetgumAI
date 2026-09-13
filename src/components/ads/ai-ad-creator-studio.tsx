'use client'

import React, { useState } from 'react'
import {
  Megaphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Eye,
  Check,
  Smartphone,
  Layers,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdCreatorProps {
  clients?: Array<{ id: string; name: string }>
}

export function AIAdCreatorStudio({ clients = [] }: AdCreatorProps) {
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '')
  const [step, setStep] = useState<number>(1)
  const [platform, setPlatform] = useState<'META_ADS' | 'GOOGLE_ADS' | 'AMAZON_ADS'>('META_ADS')

  // Brief Inputs
  const [productName, setProductName] = useState('Precision Growth Sprint')
  const [productDescription, setProductDescription] = useState(
    'High-converting automated PPC & social campaign aimed at lowering blended CPA.'
  )
  const [targetAudience, setTargetAudience] = useState('B2B Tech Leaders, E-commerce Founders, Marketing Directors')
  const [targetLocation, setTargetLocation] = useState('United States, Canada, United Kingdom')
  const [dailyBudget, setDailyBudget] = useState(50)
  const [objective, setObjective] = useState('CONVERSIONS')
  const [desiredCta, setDesiredCta] = useState('Claim Free Audit')

  // AI Generated Output
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  const [hasAuthorizedSpend, setHasAuthorizedSpend] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setIsGenerated(true)
      setStep(2)
    }, 900)
  }

  const handlePublish = () => {
    if (!hasAuthorizedSpend) return
    setIsSuccess(true)
  }

  return (
    <div className="terminal-panel p-5 space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono-data text-[10px] text-[var(--text-muted-hex)] mb-1">
            <span className="font-semibold text-[#E5252A]">TARGETGUM CREATIVE ENGINE</span>
            <span>•</span>
            <span>AI MULTI-CHANNEL AD STUDIO</span>
          </div>
          <h2 className="text-lg font-display font-bold text-[var(--text-primary-hex)] flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-[#E5252A]" /> AI Ad Campaign Studio
          </h2>
          <p className="text-xs text-[var(--text-muted-hex)] mt-0.5">
            Formulate high-intent ad copies, creative angles, and platform-specific targeting sets in seconds.
          </p>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex items-center gap-1 rounded bg-[var(--surface-subtle)] p-1 border border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={() => setPlatform('META_ADS')}
            className={cn(
              'px-3 py-1 text-xs font-mono-data rounded transition-colors',
              platform === 'META_ADS'
                ? 'bg-[#E5252A] text-white font-semibold shadow-sm'
                : 'text-[var(--text-muted-hex)] hover:text-[var(--text-primary-hex)]'
            )}
          >
            Meta (FB/IG)
          </button>
          <button
            type="button"
            onClick={() => setPlatform('GOOGLE_ADS')}
            className={cn(
              'px-3 py-1 text-xs font-mono-data rounded transition-colors',
              platform === 'GOOGLE_ADS'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-[var(--text-muted-hex)] hover:text-[var(--text-primary-hex)]'
            )}
          >
            Google Ads
          </button>
          <button
            type="button"
            onClick={() => setPlatform('AMAZON_ADS')}
            className={cn(
              'px-3 py-1 text-xs font-mono-data rounded transition-colors',
              platform === 'AMAZON_ADS'
                ? 'bg-amber-600 text-white font-semibold shadow-sm'
                : 'text-[var(--text-muted-hex)] hover:text-[var(--text-primary-hex)]'
            )}
          >
            Amazon PPC
          </button>
        </div>
      </div>

      {isSuccess ? (
        <div className="p-8 text-center space-y-3 rounded border border-emerald-500/30 bg-emerald-500/10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-display font-semibold text-[var(--text-primary-hex)]">
            Campaign Successfully Staged & Queued!
          </h3>
          <p className="text-xs text-[var(--text-muted-hex)] max-w-md mx-auto">
            The ad set has been submitted to the Approvals Gate. Once validated by the client or super admin, it will deploy live.
          </p>
          <div className="pt-3">
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false)
                setIsGenerated(false)
                setStep(1)
              }}
              className="btn-outline-hairline px-4 py-1.5 text-xs"
            >
              Create Another Campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Campaign Brief */}
          <div className="lg:col-span-6 space-y-4">
            <div className="space-y-3">
              {clients.length > 0 && (
                <div>
                  <label className="block text-xs font-mono-data text-[var(--text-muted-hex)] mb-1">
                    Client Workspace
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full rounded border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-primary-hex)] focus:border-[#E5252A] focus:outline-none"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono-data text-[var(--text-muted-hex)] mb-1">
                  Product / Service Name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-primary-hex)] focus:border-[#E5252A] focus:outline-none"
                  placeholder="e.g., UltraGrowth Core Tier"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-data text-[var(--text-muted-hex)] mb-1">
                  Value Proposition & Key Benefits
                </label>
                <textarea
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="w-full rounded border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-primary-hex)] focus:border-[#E5252A] focus:outline-none resize-none"
                  placeholder="Describe key outcomes, differentiators, and guarantees..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono-data text-[var(--text-muted-hex)] mb-1">
                    Daily Budget ($ USD)
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(Number(e.target.value))}
                    className="w-full rounded border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-primary-hex)] focus:border-[#E5252A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-data text-[var(--text-muted-hex)] mb-1">
                    Campaign Objective
                  </label>
                  <select
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="w-full rounded border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-primary-hex)] focus:border-[#E5252A] focus:outline-none"
                  >
                    <option value="CONVERSIONS">High-Intent Conversions</option>
                    <option value="TRAFFIC">Qualified Click Traffic</option>
                    <option value="LEAD_GENERATION">Direct Lead Capture</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-data text-[var(--text-muted-hex)] mb-1">
                  Primary Call To Action (CTA)
                </label>
                <input
                  type="text"
                  value={desiredCta}
                  onChange={(e) => setDesiredCta(e.target.value)}
                  className="w-full rounded border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-primary-hex)] focus:border-[#E5252A] focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerate}
                  className="w-full btn-brand py-2 text-xs flex items-center justify-center gap-2"
                >
                  <Sparkles className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
                  <span>{isGenerating ? 'AI Engine Synthesizing...' : 'Generate AI Ad Sets & Creative Angles'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Mockup / Generated Strategy */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded border border-[var(--border-hairline)] bg-[var(--surface-footer)] p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2">
                <span className="text-[11px] font-mono-data uppercase tracking-wider text-[var(--text-muted-hex)] flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-[#E5252A]" /> Platform Preview
                </span>
                <span className="font-mono-data text-[10px] text-[var(--text-faint-hex)]">
                  TargetGum Live Renderer
                </span>
              </div>

              {/* Feed Card Simulation */}
              <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-[#E5252A] flex items-center justify-center text-[10px] font-bold text-white">
                    TG
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary-hex)]">TargetGum Performance Ad</p>
                    <p className="text-[9px] font-mono-data text-[var(--text-faint-hex)]">Sponsored · Precision Engine</p>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-primary-hex)] leading-relaxed">
                  {isGenerated
                    ? `Stop burning PPC budget on unverified traffic. The ${productName} leverages multi-tenant AI targeting to drive measurable ROI in 14 days.`
                    : 'AI-generated high-converting ad copy will render here based on your prompt inputs.'}
                </p>

                {/* Simulated Creative Box */}
                <div className="relative h-44 w-full rounded border border-[var(--border-hairline)] bg-gradient-to-br from-[var(--bg-ink)] via-[var(--surface-base)] to-[var(--border-subtle)] flex flex-col items-center justify-center p-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-[#E5252A]/20 border border-[#E5252A]/50 flex items-center justify-center text-[#E5252A] mb-2">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <span className="font-display text-sm font-bold text-[var(--text-primary-hex)] tracking-tight">
                    {productName}
                  </span>
                  <span className="font-mono-data text-[10px] text-[var(--text-muted-hex)] mt-1">
                    Precision Marketing. Real Results.
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-[10px] font-mono-data text-[var(--text-faint-hex)] uppercase">
                      targetgum.com
                    </p>
                    <p className="text-xs font-semibold text-[var(--text-primary-hex)]">
                      {isGenerated ? 'Guaranteed ROAS Threshold' : 'High-Impact Performance'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-brand px-3 py-1 text-xs font-semibold"
                  >
                    {desiredCta}
                  </button>
                </div>
              </div>
            </div>

            {/* Approval Guardrail & Publish Button */}
            {isGenerated && (
              <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] space-y-3">
                <label className="flex items-start gap-2 text-xs text-[var(--text-muted-hex)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAuthorizedSpend}
                    onChange={(e) => setHasAuthorizedSpend(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[#E5252A] focus:ring-[#E5252A]"
                  />
                  <span>
                    I verify and authorize daily ad spend of <strong className="text-white">${dailyBudget}.00/day</strong> through the agency security guardrail.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!hasAuthorizedSpend}
                  onClick={handlePublish}
                  className={cn(
                    'w-full py-2 text-xs font-semibold flex items-center justify-center gap-2 rounded transition-all',
                    hasAuthorizedSpend
                      ? 'btn-brand text-white shadow-glow'
                      : 'bg-[var(--border-hairline)] text-[var(--text-faint-hex)] cursor-not-allowed'
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Submit to Approvals Gate & Stage Campaign</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
