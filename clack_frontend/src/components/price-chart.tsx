'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { UTCTimestamp } from 'lightweight-charts'

type CandlePoint = {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']
const timeframeMinutes: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
}

function generateBaseSeries(basePrice: number): CandlePoint[] {
  const points: CandlePoint[] = []
  const now = Math.floor(Date.now() / 1000)
  let close = Math.max(basePrice, 100)

  for (let i = 0; i < 720; i++) {
    const time = (now - (719 - i) * 60) as UTCTimestamp
    const volatility = basePrice * 0.0035
    const drift = (Math.random() - 0.49) * volatility
    const open = close
    close = Math.max(100, close + drift)
    const wickOffset = Math.max(basePrice * 0.001, Math.random() * volatility * 0.65)
    const high = Math.max(open, close) + wickOffset
    const low = Math.min(open, close) - wickOffset

    points.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(Math.max(1, low).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.random() * 12000 + 1200,
    })
  }

  return points
}

function aggregateSeries(data: CandlePoint[], stepMinutes: number): CandlePoint[] {
  if (stepMinutes <= 1) return data
  const step = stepMinutes
  const grouped: CandlePoint[] = []

  for (let i = 0; i < data.length; i += step) {
    const slice = data.slice(i, i + step)
    if (!slice.length) continue
    const first = slice[0]
    const last = slice[slice.length - 1]
    const volume = slice.reduce((acc, item) => acc + item.volume, 0)
    const high = Math.max(...slice.map((item) => item.high))
    const low = Math.min(...slice.map((item) => item.low))

    grouped.push({
      time: last.time,
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
    })
  }

  return grouped
}

interface PriceChartProps {
  currentPrice: number
  priceChange: number
  high: number
  low: number
  open: number
}

export function PriceChart({ currentPrice, priceChange, high, low, open }: PriceChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m')
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const isPositive = priceChange >= 0

  const seriesData = useMemo(() => {
    const base = generateBaseSeries(currentPrice)
    const step = timeframeMinutes[selectedTimeframe] ?? 1
    return aggregateSeries(base, step)
  }, [currentPrice, selectedTimeframe])

  const volumeSma = useMemo(() => {
    const last20 = seriesData.slice(-20)
    if (!last20.length) return 0
    return last20.reduce((acc, item) => acc + item.volume, 0) / last20.length
  }, [seriesData])

  useEffect(() => {
    if (!chartContainerRef.current) return
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
      <div ref={chartContainerRef} className="h-[320px] w-full md:h-[430px]" />

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
