'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import type { UTCTimestamp } from 'lightweight-charts'
import { formatTokenPrice } from '@/lib/format'
import { apiClient, type CandleData } from '@/lib/api/client'
import { createSocketClient } from '@/lib/api/client'

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
}

interface OhlcState {
  open: number
  high: number
  low: number
  close: number
  change: number
}

interface PriceChartProps {
  tokenId: number
  symbol: string
  currentPrice: number
  virtualSupply?: number
}

// Readable price formatter for very small numbers (e.g. 0.0000000081 → 0.0{8}81)
function formatChartPrice(price: number): string {
  if (price === 0) return '0'
  if (price < 0.0001) {
    const str = price.toFixed(18)
    const match = str.match(/^0\.(0+)([1-9]\d{0,3})/)
    if (match) return `0.0{${match[1].length}}${match[2]}`
  }
  if (price < 1) return price.toFixed(6)
  if (price < 1000) return price.toFixed(2)
  return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function PriceChart({ tokenId, symbol, currentPrice, virtualSupply = 0 }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartApiRef = useRef<any>(null)
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const isChartReadyRef = useRef(false)
  const candlesRef = useRef<CandleData[]>([])
  const lastPriceRef = useRef<number>(0)
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [selectedTimeframe, setSelectedTimeframe] = useState('1m')
  const [chartMode, setChartMode] = useState<'price' | 'mcap'>('price')
  const [ohlc, setOhlc] = useState<OhlcState>({ open: 0, high: 0, low: 0, close: 0, change: 0 })
  const [hasData, setHasData] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [volumeSma, setVolumeSma] = useState(0)

  // ── Init chart once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return
    let disposed = false
    let cleanupFn = () => {}

    const init = async () => {
      const { CandlestickSeries, ColorType, HistogramSeries, createChart } =
        await import('lightweight-charts')
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
          vertLines: { color: 'rgba(255,255,255,0.02)' },
          horzLines: { color: 'rgba(255,255,255,0.02)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(148,163,184,0.12)',
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.05)',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 8,
          minBarSpacing: 4,
        },
        crosshair: {
          mode: 1 as any, // Magnet — snaps to candle bodies
          vertLine: {
            color: 'rgba(139,92,246,0.4)',
            width: 1 as any,
            style: 2 as any,
            labelVisible: true,
            labelBackgroundColor: '#7c3aed',
          },
          horzLine: {
            color: 'rgba(139,92,246,0.4)',
            width: 1 as any,
            style: 2 as any,
            labelVisible: true,
            labelBackgroundColor: '#7c3aed',
          },
        },
        localization: {
          priceFormatter: formatChartPrice,
        },
      })

      // Hide library watermark if present
      try { chart.applyOptions({ watermark: { visible: false } } as any) } catch {}

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00E676',
        downColor: '#FF5252',
        borderUpColor: '#00E676',
        borderDownColor: '#FF5252',
        wickUpColor: '#00E676',
        wickDownColor: '#FF5252',
        borderVisible: true,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'price', precision: 10, minMove: 1e-10 },
      })

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      })
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })

      // Crosshair → update OHLC header
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData) return
        const data = param.seriesData.get(candleSeries) as any
        if (!data) return
        const o = data.open ?? 0
        const c = data.close ?? 0
        setOhlc({
          open: o,
          high: data.high ?? 0,
          low: data.low ?? 0,
          close: c,
          change: o > 0 ? ((c - o) / o) * 100 : 0,
        })
      })

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          chart.applyOptions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          })
        }
      })
      observer.observe(chartContainerRef.current)

      chartApiRef.current = chart
      candleSeriesRef.current = candleSeries
      volumeSeriesRef.current = volumeSeries
      isChartReadyRef.current = true

      cleanupFn = () => {
        observer.disconnect()
        chart.remove()
        isChartReadyRef.current = false
        chartApiRef.current = null
        candleSeriesRef.current = null
        volumeSeriesRef.current = null
      }
    }

    init()
    return () => {
      disposed = true
      cleanupFn()
    }
  }, [])

  // ── Load candles from API ─────────────────────────────────────────────────────
  const loadCandles = useCallback(async () => {
    setIsLoading(true)
    try {
      const candles = await apiClient.getCandles(tokenId, selectedTimeframe, 200)
      candlesRef.current = candles

      if (candles.length === 0) {
        setHasData(false)
        return
      }
      setHasData(true)

      let attempts = 0
      while (!isChartReadyRef.current && attempts < 30) {
        await new Promise((r) => setTimeout(r, 50))
        attempts++
      }
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return

      const multiplier = chartMode === 'mcap' && virtualSupply > 0 ? virtualSupply : 1
      const displayCandles = candles.map((c) => ({
        ...c,
        open: c.open * multiplier,
        high: c.high * multiplier,
        low: c.low * multiplier,
        close: c.close * multiplier,
      }))

      const last = displayCandles[displayCandles.length - 1]
      lastPriceRef.current = candles[candles.length - 1].close
      setOhlc({
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        change: last.open > 0 ? ((last.close - last.open) / last.open) * 100 : 0,
      })

      const last20 = candles.slice(-20)
      setVolumeSma(last20.reduce((s, c) => s + c.volume, 0) / last20.length)

      candleSeriesRef.current.setData(
        displayCandles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      )
      volumeSeriesRef.current.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(0,230,118,0.5)' : 'rgba(255,82,82,0.5)',
        })),
      )
      chartApiRef.current?.timeScale().fitContent()
    } catch {
      setHasData(false)
    } finally {
      setIsLoading(false)
    }
  }, [tokenId, selectedTimeframe, chartMode, virtualSupply])

  useEffect(() => {
    loadCandles()
  }, [loadCandles])

  // ── Live timer — push flat candle each new bucket ─────────────────────────────
  useEffect(() => {
    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current)
      liveTimerRef.current = null
    }

    const bucketSize = INTERVAL_SECONDS[selectedTimeframe] ?? 60
    let lastSeenBucket = Math.floor(Date.now() / 1000 / bucketSize) * bucketSize

    liveTimerRef.current = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const currentBucket = Math.floor(now / bucketSize) * bucketSize
      if (currentBucket <= lastSeenBucket) return
      lastSeenBucket = currentBucket

      const price = lastPriceRef.current
      if (price <= 0 || !candleSeriesRef.current || !volumeSeriesRef.current) return

      candleSeriesRef.current.update({
        time: currentBucket as UTCTimestamp,
        open: price, high: price, low: price, close: price,
      })
      volumeSeriesRef.current.update({
        time: currentBucket as UTCTimestamp,
        value: 0,
        color: 'rgba(100,100,100,0.1)',
      })
      candlesRef.current = [
        ...candlesRef.current,
        { time: currentBucket, open: price, high: price, low: price, close: price, volume: 0 },
      ]
    }, 5000)

    return () => {
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current)
        liveTimerRef.current = null
      }
    }
  }, [selectedTimeframe])

  // ── Real-time candle update via WebSocket ─────────────────────────────────────
  useEffect(() => {
    const socket = createSocketClient()
    const intervalSecs = INTERVAL_SECONDS[selectedTimeframe] ?? 60

    socket.on('trade', (payload: {
      tokenId: number
      newPrice: string
      monAmount: string
      timestamp?: number
      isBuy: boolean
    }) => {
      if (payload.tokenId !== tokenId) return
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return

      const price = parseFloat(payload.newPrice)
      const volume = parseFloat(payload.monAmount)
      if (!Number.isFinite(price) || price <= 0) return
      lastPriceRef.current = price

      const multiplier = chartMode === 'mcap' && virtualSupply > 0 ? virtualSupply : 1
      const now = payload.timestamp ?? Math.floor(Date.now() / 1000)
      const candleTime = (Math.floor(now / intervalSecs) * intervalSecs) as UTCTimestamp

      const prev = candlesRef.current
      const last = prev[prev.length - 1]

      if (last && last.time === candleTime) {
        const updated: CandleData = {
          ...last,
          high: Math.max(last.high, price),
          low: Math.min(last.low, price),
          close: price,
          volume: last.volume + volume,
        }
        candlesRef.current = [...prev.slice(0, -1), updated]
        const upColor = updated.close >= updated.open ? 'rgba(0,230,118,0.5)' : 'rgba(255,82,82,0.5)'
        candleSeriesRef.current.update({
          time: candleTime,
          open: updated.open * multiplier,
          high: updated.high * multiplier,
          low: updated.low * multiplier,
          close: updated.close * multiplier,
        })
        volumeSeriesRef.current.update({ time: candleTime, value: updated.volume, color: upColor })
        setOhlc({
          open: updated.open * multiplier,
          high: updated.high * multiplier,
          low: updated.low * multiplier,
          close: updated.close * multiplier,
          change: updated.open > 0 ? ((updated.close - updated.open) / updated.open) * 100 : 0,
        })
      } else {
        const prevClose = last?.close ?? price
        const newCandle: CandleData = {
          time: candleTime,
          open: prevClose,
          high: Math.max(prevClose, price),
          low: Math.min(prevClose, price),
          close: price,
          volume,
        }
        candlesRef.current = [...prev, newCandle]
        const upColor = newCandle.close >= newCandle.open ? 'rgba(0,230,118,0.5)' : 'rgba(255,82,82,0.5)'
        candleSeriesRef.current.update({
          time: candleTime,
          open: newCandle.open * multiplier,
          high: newCandle.high * multiplier,
          low: newCandle.low * multiplier,
          close: newCandle.close * multiplier,
        })
        volumeSeriesRef.current.update({ time: candleTime, value: newCandle.volume, color: upColor })
        setOhlc({
          open: newCandle.open * multiplier,
          high: newCandle.high * multiplier,
          low: newCandle.low * multiplier,
          close: newCandle.close * multiplier,
          change: 0,
        })
      }
    })

    return () => { socket.disconnect() }
  }, [tokenId, selectedTimeframe, chartMode, virtualSupply])

  const isPositive = ohlc.change >= 0

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {/* Price / MCap toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setChartMode('price')}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                chartMode === 'price' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Price
            </button>
            <button
              onClick={() => setChartMode('mcap')}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                chartMode === 'mcap' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              MCap
            </button>
            <span className="ml-1 text-xs text-gray-600">MON</span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 shrink-0 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="truncate text-sm text-muted-foreground">{symbol} / MON</span>
          </div>

          {hasData && (
            <>
              <div className="hidden min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs sm:flex">
                <span className="text-muted-foreground">O <span className="text-emerald-500">{formatTokenPrice(ohlc.open)}</span></span>
                <span className="text-muted-foreground">H <span className="text-foreground">{formatTokenPrice(ohlc.high)}</span></span>
                <span className="text-muted-foreground">L <span className="text-foreground">{formatTokenPrice(ohlc.low)}</span></span>
                <span className="text-muted-foreground">C <span className={isPositive ? 'text-emerald-500' : 'text-red-500'}>{formatTokenPrice(ohlc.close)}</span></span>
                <span className={`font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{ohlc.change.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:hidden">
                <span className="truncate font-mono font-semibold text-foreground">{formatTokenPrice(ohlc.close)}</span>
                <span className={`shrink-0 font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{ohlc.change.toFixed(2)}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Interval buttons */}
        <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {timeframes.map((tf) => (
            <Button
              key={tf}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTimeframe(tf)}
              className={`h-8 shrink-0 px-2 text-xs sm:h-7 ${
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

      {/* Chart area */}
      <div className="relative">
        <div ref={chartContainerRef} className="h-[320px] w-full md:h-[430px]" />
        {!hasData && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-border bg-secondary/20 text-sm text-muted-foreground">
            Waiting for first trade...
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-card/60 text-sm text-muted-foreground">
            <span className="animate-pulse">Loading...</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Volume SMA (20)</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            Charts by TradingView
          </a>
          <span className="font-mono text-emerald-500">
            {volumeSma > 0 ? volumeSma.toFixed(4) : '--'} MON
          </span>
        </div>
      </div>
    </div>
  )
}
