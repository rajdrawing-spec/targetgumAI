'use client'

import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { TrendingUp, PieChart as PieIcon, Plug, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

export interface DailyTrendPoint {
  day: string
  spend: number
  revenue: number
}

export interface ChannelMixPoint {
  name: string
  value: number
  spend: number
  color: string
}

interface TelemetryProps {
  totalSpend: number
  totalRevenue: number
  avgRoas: number
  campaignCount: number
  dailyTrends?: DailyTrendPoint[]
  channelMix?: ChannelMixPoint[]
}

const DEFAULT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export function CommandCenterTelemetry({
  totalSpend,
  totalRevenue,
  avgRoas,
  campaignCount,
  dailyTrends,
  channelMix,
}: TelemetryProps) {
  // Use strictly genuine daily trend data, or genuine zero-line if no spend has occurred yet
  const performanceTrendData =
    dailyTrends && dailyTrends.length > 0
      ? dailyTrends
      : DEFAULT_DAYS.map((d) => ({ day: d, spend: 0, revenue: 0 }))

  const hasGenuineSpend = totalSpend > 0
  const hasGenuineChannelData = channelMix && channelMix.some((c) => c.spend > 0)

  // Default empty channel allocation
  const displayChannelMix: ChannelMixPoint[] =
    hasGenuineChannelData && channelMix
      ? channelMix
      : [
          { name: 'Meta Ads', value: 0, spend: 0, color: '#E5252A' },
          { name: 'Google Ads', value: 0, spend: 0, color: '#3B82F6' },
          { name: 'Amazon Ads', value: 0, spend: 0, color: '#F59E0B' },
          { name: 'LinkedIn / Social', value: 0, spend: 0, color: '#64748B' },
        ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 7-Day Performance Velocity Chart */}
      <Card className="lg:col-span-2 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-primary">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Performance Velocity (7-Day Trend)</h3>
              <p className="text-xs text-muted-foreground">Live telemetry: Daily Ad Spend vs Gross Return</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Ad Spend (${totalSpend.toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-foreground" />
              <span className="text-muted-foreground">Gross Return (${totalRevenue.toLocaleString()})</span>
            </div>
          </div>
        </div>

        <div className="h-56 w-full pt-2 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={performanceTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E5252A" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#E5252A" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--text-primary-hex)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--text-primary-hex)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                stroke="var(--chart-grid-hex)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-hairline)' }}
                fontFamily="var(--font-mono)"
              />
              <YAxis
                stroke="var(--chart-grid-hex)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-hairline)' }}
                tickFormatter={(v) => `$${v}`}
                fontFamily="var(--font-mono)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface-base)',
                  borderColor: 'var(--border-hairline)',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary-hex)',
                }}
                formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--text-primary-hex)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#revenueGradient)"
                name="Gross Return"
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="#E5252A"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#spendGradient)"
                name="Ad Spend"
              />
            </AreaChart>
          </ResponsiveContainer>

          {!hasGenuineSpend && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-[1px] rounded-2xl">
              <p className="text-xs text-foreground font-medium mb-1">No active ad spend telemetry recorded yet</p>
              <p className="text-xs text-muted-foreground max-w-sm text-center mb-3">
                Connect your genuine Meta Ads or Google Ads account to start streaming daily live spend and return metrics.
              </p>
              <Link href="/dashboard/integrations" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Plug className="h-3.5 w-3.5" /> Connect Meta Ads Account <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* Multi-Channel Spend Allocation Donut */}
      <Card className="p-4 space-y-3 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <PieIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Channel Mix</h3>
              <p className="text-xs text-muted-foreground">Multi-platform budget weighting</p>
            </div>
          </div>
          <span className="text-xs text-primary font-semibold">
            {avgRoas > 0 ? `${avgRoas.toFixed(1)}x ROAS` : '0.0x ROAS'}
          </span>
        </div>

        <div className="h-40 w-full flex items-center justify-center relative">
          {hasGenuineChannelData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayChannelMix}
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="var(--surface-base)"
                  strokeWidth={2}
                >
                  {displayChannelMix.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-base)',
                    borderColor: 'var(--border-hairline)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary-hex)',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Allocation']}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center p-4">
              <div className="h-16 w-16 mx-auto rounded-full border-2 border-dashed border-border flex items-center justify-center text-xs font-medium text-muted-foreground mb-2">
                0%
              </div>
              <p className="text-xs text-muted-foreground">No ad platform spend allocated yet</p>
            </div>
          )}
        </div>

        {/* Legend Breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          {displayChannelMix.map((channel) => (
            <div key={channel.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: channel.color }} />
                <span className="text-muted-foreground truncate">{channel.name}</span>
              </div>
              <span className="text-foreground font-semibold ml-1">{channel.value}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
