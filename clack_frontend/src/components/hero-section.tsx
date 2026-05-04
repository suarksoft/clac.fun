'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useHeroStats } from '@/hooks/useHeroStats';

function formatTimeLeft(createdAt: number, duration: number): { text: string; seconds: number } {
  const now = Math.floor(Date.now() / 1000);
  const remaining = (createdAt + duration) - now;
  if (remaining <= 0) return { text: "CLAC'D", seconds: 0 };
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return {
    text: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    seconds: remaining,
  };
}

function formatMCap(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return '$0';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

export function HeroSection() {
  const { stats, liveTokens, featuredToken, featuredIndex, loading } = useHeroStats();
  const [clock, setClock] = useState({ text: '--:--:--', seconds: 99999 });

  useEffect(() => {
    if (!featuredToken) return;
    const tick = () => setClock(formatTimeLeft(featuredToken.createdAt, featuredToken.duration));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [featuredToken]);

  const statCards = [
    { icon: '', label: 'Live Now', value: loading ? '-' : String(stats.liveCount), color: 'text-green-400' },
    { icon: '', label: 'Total Trades', value: loading ? '-' : String(stats.totalTrades), color: 'text-white' },
    { icon: '', label: 'Volume', value: loading ? '-' : stats.totalVolume, color: 'text-violet-400', suffix: 'MON' },
    { icon: '', label: "Clac'd", value: loading ? '-' : String(stats.clacdCount), color: 'text-red-400' },
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gray-800/50 bg-gray-900/30 mb-6">
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-violet-600/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 p-5 md:p-8">
        <div className="flex flex-col md:flex-row md:items-stretch gap-6 md:gap-8">

          {/* Sol: Tagline + Stats */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 mb-5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-[11px] font-semibold text-green-400 tracking-wide">LIVE ON MONAD</span>
              </div>

              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-snug mb-2">
                Every token has a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">
                  death clock
                </span>
              </h1>
              <p className="text-sm text-gray-500 max-w-sm mb-6">
                Trade it, flip it, or hold for the lottery. When time&apos;s up — clac.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statCards.map((s) => (
                <div key={s.label} className="bg-gray-800/30 rounded-xl p-3 border border-gray-800/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{s.icon}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</span>
                    {s.suffix && <span className="text-xs text-gray-600">{s.suffix}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sağ: Featured Token */}
          <div className="w-full md:w-72 lg:w-80 flex-shrink-0">
            {featuredToken ? (
              <Link href={`/token/${featuredToken.slug || featuredToken.id}`} className="block group h-full">
                <div className="relative h-full bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden hover:border-violet-500/30 transition-all duration-500">
                  <div className="relative h-40 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featuredToken.imageURI || '/placeholder-token.png'}
                      alt={featuredToken.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-token.png'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />

                    <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded-md text-[10px] font-mono text-gray-300">
                      {featuredToken.duration === 21600 ? '6H' : featuredToken.duration === 43200 ? '12H' : '24H'}
                    </div>

                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Death Clock</span>
                        <span className={`text-base font-mono font-bold ${
                          clock.seconds < 3600 ? 'text-red-400 animate-pulse' :
                          clock.seconds < 7200 ? 'text-orange-400' : 'text-white'
                        }`}>
                          {clock.text}
                        </span>
                      </div>
                      <div className="h-0.5 bg-gray-700/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.max(0, Math.min(100, (clock.seconds / featuredToken.duration) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 bg-violet-500/20 rounded text-[10px] font-bold text-violet-300 font-mono flex-shrink-0">
                          ${featuredToken.symbol}
                        </span>
                        <span className="text-sm font-bold text-white truncate">{featuredToken.name}</span>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ${
                        (featuredToken.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {(featuredToken.change24h || 0) >= 0 ? '+' : ''}
                        {(featuredToken.change24h || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{formatMCap(featuredToken.marketCap)}</span>
                      <span>{featuredToken.totalHolders || 0} holders</span>
                    </div>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-violet-600/10 backdrop-blur-[1px] transition-all duration-300 pointer-events-none">
                    <span className="px-4 py-2 bg-violet-600 rounded-lg text-white text-sm font-bold shadow-lg shadow-violet-500/30">
                      Trade Now →
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-gray-800/20 border border-dashed border-gray-700/50 rounded-xl p-8 text-center min-h-[200px]">
                <span className="text-4xl mb-3 opacity-50">🫰</span>
                <p className="text-sm text-gray-500 mb-4">No tokens live yet</p>
                <Link
                  href="/create"
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm font-bold transition-colors"
                >
                  Create First Token 🚀
                </Link>
              </div>
            )}

            {liveTokens.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {liveTokens.slice(0, 6).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === featuredIndex % liveTokens.length ? 'w-4 bg-violet-500' : 'w-1.5 bg-gray-700'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
