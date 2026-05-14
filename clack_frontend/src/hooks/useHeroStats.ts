'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClientV2 } from '@/lib/api/client-v2';
import type { BackendTokenV2 } from '@/lib/api/types-v2';

interface HeroStats {
  liveCount: number;
  totalTrades: number;
  totalVolume: string;
  clacdCount: number;
}

export interface HeroLiveToken {
  address: string;
  slug?: string | null;
  name: string;
  symbol: string;
  imageURI: string;
  marketCap: number;
  totalHolders: number;
  change24h: number;
  createdAt: number;
  duration: number;
  dead: boolean;
}

function toHeroToken(t: BackendTokenV2): HeroLiveToken {
  return {
    address: t.address,
    slug: t.slug,
    name: t.name,
    symbol: t.symbol,
    imageURI: t.imageURI,
    marketCap: Number(t.marketCap ?? 0),
    totalHolders: t.totalHolders ?? 0,
    change24h: t.change24h ?? 0,
    createdAt: t.createdAt,
    duration: t.duration,
    dead: t.deathFinalized,
  };
}

export function useHeroStats() {
  const [stats, setStats] = useState<HeroStats>({
    liveCount: 0, totalTrades: 0, totalVolume: '0', clacdCount: 0,
  });
  const [liveTokens, setLiveTokens] = useState<HeroLiveToken[]>([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const [s, tokens] = await Promise.all([
        apiClientV2.getStats(),
        apiClientV2.getTokens('live', 50),
      ]);

      setStats({
        liveCount: s.liveCount ?? 0,
        totalTrades: s.totalTrades ?? 0,
        totalVolume: s.totalVolume ?? '0',
        clacdCount: s.clacdCount ?? 0,
      });

      const heroTokens = tokens
        .map(toHeroToken)
        .filter((t) => !t.dead && t.createdAt + t.duration > now);
      setLiveTokens(heroTokens);
    } catch (err) {
      console.error('[useHeroStats] fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (liveTokens.length <= 1) return;
    const interval = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % liveTokens.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [liveTokens.length]);

  return {
    stats,
    liveTokens,
    featuredToken: liveTokens.length > 0 ? liveTokens[featuredIndex % liveTokens.length] : null,
    featuredIndex,
    loading,
  };
}
