'use client';

import { useState, useEffect, useCallback } from 'react';

interface HeroStats {
  liveCount: number;
  totalTrades: number;
  totalVolume: string;
  clacdCount: number;
}

interface LiveToken {
  id: number;
  name: string;
  symbol: string;
  imageURI: string;
  marketCap: string;
  totalHolders: number;
  change24h: number;
  createdAt: number;
  duration: number;
  dead: boolean;
}

export function useHeroStats() {
  const [stats, setStats] = useState<HeroStats>({
    liveCount: 0, totalTrades: 0, totalVolume: '0', clacdCount: 0,
  });
  const [liveTokens, setLiveTokens] = useState<LiveToken[]>([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';

  const fetchData = useCallback(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const [statsRes, tokensRes] = await Promise.all([
        fetch(`${backendUrl}/api/stats`),
        fetch(`${backendUrl}/api/tokens?filter=live&limit=50`),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats({
          liveCount: data.liveCount ?? 0,
          totalTrades: data.totalTrades ?? 0,
          totalVolume: data.totalVolume ?? '0',
          clacdCount: data.clacdCount ?? 0,
        });
      }

      if (tokensRes.ok) {
        const raw = await tokensRes.json();
        console.log('Hero raw tokens:', raw);
        // Handle wrapped responses: { data: [] } | { tokens: [] } | []
        const tokenList: LiveToken[] = Array.isArray(raw)
          ? raw
          : (raw.data ?? raw.tokens ?? []);
        const live = tokenList.filter((t) => {
          const isDead = t.dead ?? (t as any).isDead ?? false;
          // createdAt may be seconds or ms — normalise to seconds
          const createdAtSec =
            t.createdAt > 1e10 ? Math.floor(t.createdAt / 1000) : t.createdAt;
          return !isDead && createdAtSec + t.duration > now;
        });
        setLiveTokens(live);
      }

      setLoading(false);
    } catch (err) {
      console.error('Hero stats fetch failed:', err);
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchData();
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
