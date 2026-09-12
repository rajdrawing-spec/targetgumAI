'use client'

import React, { useState } from 'react'
import {
  BrainCircuit,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  Tag,
  BookOpen,
  ShieldAlert,
  Sparkles,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandBrainProps {
  initialClientName?: string
  initialVoice?: string
  initialTone?: string
  initialUsps?: string[]
  initialBannedWords?: string[]
  initialCtas?: string[]
  onSave?: (data: any) => void
}

export function BrandBrainView({
  initialClientName = 'TargetGum Agency Workspace',
  initialVoice = 'Authoritative, precise, data-backed and performance-driven',
  initialTone = 'Confident, modern, high-clarity without marketing fluff',
  initialUsps = [
    'Autonomous Multi-Tenant AI Engine with Real-Time Telemetry',
    'Full Multi-Platform Integration: Meta, Google, Amazon PPC, and Metricool',
    'Enterprise Security Guardrail with Human-In-The-Loop Approval Gates',
  ],
  initialBannedWords = ['guaranteed overnight riches', 'cheap leads', 'unlimited free traffic', 'spam'],
  initialCtas = ['Claim Growth Audit', 'Launch Precision Campaign', 'Schedule Strategy Call'],
}: BrandBrainProps) {
  const [voice, setVoice] = useState(initialVoice)
  const [tone, setTone] = useState(initialTone)
  const [usps, setUsps] = useState<string[]>(initialUsps)
  const [bannedWords, setBannedWords] = useState<string[]>(initialBannedWords)
  const [ctas, setCtas] = useState<string[]>(initialCtas)

  const [newUsp, setNewUsp] = useState('')
  const [newBannedWord, setNewBannedWord] = useState('')
  const [newCta, setNewCta] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSave = () => {
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  const addUsp = () => {
    if (newUsp.trim()) {
      setUsps((prev) => [...prev, newUsp.trim()])
      setNewUsp('')
    }
  }

  const removeUsp = (idx: number) => {
    setUsps((prev) => prev.filter((_, i) => i !== idx))
  }

  const addBannedWord = () => {
    if (newBannedWord.trim()) {
      setBannedWords((prev) => [...prev, newBannedWord.trim()])
      setNewBannedWord('')
    }
  }

  const removeBannedWord = (idx: number) => {
    setBannedWords((prev) => prev.filter((_, i) => i !== idx))
  }

  const addCta = () => {
    if (newCta.trim()) {
      setCtas((prev) => [...prev, newCta.trim()])
      setNewCta('')
    }
  }

  const removeCta = (idx: number) => {
    setCtas((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="terminal-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono-data text-[10px] px-2 py-0.5 rounded bg-[#18181C] text-[#A1A1AA] border border-[#27272A] flex items-center gap-1.5">
              <BrainCircuit className="h-3 w-3 text-[#E5252A]" />
              BRAND MEMORY VAULT
            </span>
          </div>
          <h2 className="text-lg font-display font-bold text-[#FFFFFF]">
            {initialClientName} Brand DNA & Governance
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Every AI agent references these rules, banned terms, and voice guidelines prior to generating ad sets or social posts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="btn-brand flex items-center gap-1.5 px-4 py-2 text-xs shrink-0"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>Saved to Memory Vault</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              <span>Update Brand DNA</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Tone & Voice */}
        <div className="terminal-card p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#27272A] pb-3">
            <BookOpen className="h-4 w-4 text-[#E5252A]" />
            <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Brand Voice & Strategic Persona
            </h3>
          </div>

          <div>
            <label className="block text-xs font-mono-data text-[#A1A1AA] mb-1">
              Brand Voice Persona
            </label>
            <textarea
              rows={3}
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full rounded border border-[#27272A] bg-[#18181C] px-3 py-2 text-xs text-[#F4F4F6] focus:border-[#E5252A] focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono-data text-[#A1A1AA] mb-1">
              Emotional Tone & Style
            </label>
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded border border-[#27272A] bg-[#18181C] px-3 py-2 text-xs text-[#F4F4F6] focus:border-[#E5252A] focus:outline-none"
            />
          </div>
        </div>

        {/* Banned Words & Compliance Safety Guardrails */}
        <div className="terminal-card p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#27272A] pb-3">
            <ShieldAlert className="h-4 w-4 text-[#FF4D4F]" />
            <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Compliance & Banned Words Guardrail
            </h3>
          </div>

          <p className="text-[11px] text-[#A1A1AA]">
            AI agents will automatically reject or replace these words to avoid platform ad disapprovals and policy violations.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newBannedWord}
              onChange={(e) => setNewBannedWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBannedWord()}
              placeholder="Add prohibited claim or word..."
              className="flex-1 rounded border border-[#27272A] bg-[#18181C] px-3 py-1.5 text-xs text-[#F4F4F6] focus:border-[#E5252A] focus:outline-none"
            />
            <button
              type="button"
              onClick={addBannedWord}
              className="btn-outline-hairline px-3 py-1.5 text-xs flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {bannedWords.map((word, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded bg-[#E5252A]/10 border border-[#E5252A]/30 px-2 py-0.5 text-xs font-mono-data text-[#FF4D4F]"
              >
                <span>{word}</span>
                <button
                  type="button"
                  onClick={() => removeBannedWord(idx)}
                  className="hover:text-white"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Unique Selling Points */}
        <div className="terminal-card p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#27272A] pb-3">
            <Tag className="h-4 w-4 text-[#E5252A]" />
            <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Core Value Propositions (USPs)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newUsp}
              onChange={(e) => setNewUsp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUsp()}
              placeholder="Add a key selling point..."
              className="flex-1 rounded border border-[#27272A] bg-[#18181C] px-3 py-1.5 text-xs text-[#F4F4F6] focus:border-[#E5252A] focus:outline-none"
            />
            <button
              type="button"
              onClick={addUsp}
              className="btn-outline-hairline px-3 py-1.5 text-xs flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>

          <ul className="space-y-1.5">
            {usps.map((usp, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 rounded bg-[#18181C] px-3 py-2 border border-[#27272A] text-xs text-[#F4F4F6]"
              >
                <span>{usp}</span>
                <button
                  type="button"
                  onClick={() => removeUsp(idx)}
                  className="text-[#71717A] hover:text-[#FF4D4F]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* High-Intent CTAs */}
        <div className="terminal-card p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#27272A] pb-3">
            <Sparkles className="h-4 w-4 text-[#E5252A]" />
            <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Approved Call To Actions (CTAs)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCta}
              onChange={(e) => setNewCta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCta()}
              placeholder="e.g. Claim Free Diagnostic..."
              className="flex-1 rounded border border-[#27272A] bg-[#18181C] px-3 py-1.5 text-xs text-[#F4F4F6] focus:border-[#E5252A] focus:outline-none"
            />
            <button
              type="button"
              onClick={addCta}
              className="btn-outline-hairline px-3 py-1.5 text-xs flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {ctas.map((cta, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded bg-[#18181C] border border-[#27272A] px-2.5 py-1 text-xs font-mono-data text-[#F4F4F6]"
              >
                <span>{cta}</span>
                <button
                  type="button"
                  onClick={() => removeCta(idx)}
                  className="text-[#71717A] hover:text-[#FF4D4F]"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
