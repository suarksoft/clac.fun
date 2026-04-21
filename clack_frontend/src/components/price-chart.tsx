'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { UTCTimestamp } from 'lightweight-charts'
import type { Trade } from '@/lib/ui-types'

type CandlePoint = {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']
const timeframeSeconds: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
}

function toUnitPrice(trade: Trade): number {
  if (trade.tokenAmount <= 0) return 0
  return trade.amount / trade.tokenAmount
}

function buildCandlesFromTrades(trades: Trade[], bucketSeconds: number): CandlePoint[] {
  if (!trades.length) return []

  const sorted = [...trades].sort((a, b) => a.time.getTime() - b.time.getTime())
  const byBucket = new Map<number, Trade[]>()

  for (const trade of sorted) {
    const unix = Math.floor(trade.time.getTime() / 1000)
    const bucketStart = Math.floor(unix / bucketSeconds) * bucketSeconds
    const arr = byBucket.get(bucketStart) || []
    arr.push(trade)
    byBucket.set(bucketStart, arr)
  }

  const points: CandlePoint[] = []
  for (const [bucketStart, bucketTrades] of byBucket.entries()) {
    const prices = bucketTrades.map(toUnitPrice).filter((price) => Number.isFinite(price) && price > 0)
    if (!prices.length) continue
    const open = prices[0]
    const close = prices[prices.length - 1]
    const high = Math.max(...prices)
    const low = Math.min(...prices)
    const volume = bucketTrades.reduce((sum, trade) => sum + trade.amount, 0)

    points.push({
      time: bucketStart as UTCTimestamp,
      open,
      high,
      low,
      close,
      volume,
    })
  }

  return points.sort((a, b) => a.time - b.time)
}

interface PriceChartProps {
  currentPrice: number
  priceChange: number
  high: number
  low: number
  open: number
  trades: Trade[]
}

export function PriceChart({ currentPrice, priceChange, high, low, open, trades }: PriceChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m')
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const isPositive = priceChange >= 0

  const seriesData = useMemo(() => {
    const bucketSeconds = (timeframeSeconds[selectedTimeframe] ?? 1) * 60
    return buildCandlesFromTrades(trades, bucketSeconds)
  }, [selectedTimeframe, trades])

  const volumeSma = useMemo(() => {
    const last20 = seriesData.slice(-20)
    if (!last20.length) return 0
    return last20.reduce((acc, item) => acc + item.volume, 0) / last20.length
  }, [seriesData])

  useEffect(() => {
    if (!chartContainerRef.current || seriesData.length === 0) return
    let disposed = false
    let cleanup = () => {}

    const setupChart = async () => {
      const { CandlestickSeries, ColorType, HistogramSeries, createChart } = await import('lightweight-charts')
      if (disposed || !chartContainerRef.current) return

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: '#06080f' },
          textColor: '#8f93a6',
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(148, 163, 184, 0.12)',
        },
        timeScale: {
          borderColor: 'rgba(148, 163, 184, 0.12)',
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          vertLine: { color: 'rgba(148, 163, 184, 0.35)' },
          horzLine: { color: 'rgba(148, 163, 184, 0.35)' },
        },
      })

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        borderVisible: false,
        priceLineVisible: false,
        lastValueVisible: true,
      })

      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: isPositive ? 'rgba(34, 197, 94, 0.32)' : 'rgba(239, 68, 68, 0.32)',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      })

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.82,
          bottom: 0,
        },
      })

      candleSeries.setData(
        seriesData.map((item) => ({
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        })),
      )
      volumeSeries.setData(
        seriesData.map((item) => {
          const isUp = item.close >= item.open
          return {
            time: item.time,
            value: item.volume,
            color: isUp ? 'rgba(34, 197, 94, 0.34)' : 'rgba(239, 68, 68, 0.34)',
          }
        }),
      )

      chart.timeScale().fitContent()

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          chart.applyOptions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          })
        }
      })
      observer.observe(chartContainerRef.current)

      cleanup = () => {
        observer.disconnect()
        chart.remove()
      }
    }

    setupChart()
    return () => {
      disposed = true
      cleanup()
    }
  }, [isPositive, seriesData])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">PEPE / USD</span>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-muted-foreground">
              O <span className="text-emerald-500">{(open / 1000).toFixed(2)}K</span>
            </span>
            <span className="text-muted-foreground">
              H <span className="text-foreground">{(high / 1000).toFixed(2)}K</span>
            </span>
            <span className="text-muted-foreground">
              L <span className="text-foreground">{(low / 1000).toFixed(2)}K</span>
            </span>
            <span className="text-muted-foreground">
              C <span className={isPositive ? 'text-emerald-500' : 'text-red-500'}>
                {(currentPrice / 1000).toFixed(2)}K
              </span>
            </span>
            <span className={`font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {timeframes.map((tf) => (
            <Button
              key={tf}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTimeframe(tf)}
              className={`h-7 px-2 text-xs ${
                selectedTimeframe === tf
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {seriesData.length === 0 ? (
        <div className="flex h-[320px] w-full items-center justify-center rounded-lg border border-border bg-secondary/20 text-sm text-muted-foreground md:h-[430px]">
          Gercek trade verisi bekleniyor...
        </div>
      ) : (
        <div ref={chartContainerRef} className="h-[320px] w-full md:h-[430px]" />
      )}

      {/* Volume Bar */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Volume SMA</span>
        <div className="flex items-center gap-4">
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            Charts by TradingView
          </a>
          <span className="font-mono text-emerald-500">{volumeSma.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
