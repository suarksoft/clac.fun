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
        const tokens = await tokensRes.json();
        const live = (Array.isArray(tokens) ? tokens : []).filter(
          (t: LiveToken) => !t.dead && (t.createdAt + t.duration) > now
        );
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
