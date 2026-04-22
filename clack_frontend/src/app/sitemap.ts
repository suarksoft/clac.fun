import type { MetadataRoute } from 'next'
import { publicEnv } from '@/lib/env'

const SITE_URL = publicEnv.NEXT_PUBLIC_SITE_URL

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/create`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/portfolio`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/bridge`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]
}
