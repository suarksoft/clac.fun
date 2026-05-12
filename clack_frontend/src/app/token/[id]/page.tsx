'use client'

import { use } from 'react'
import { TokenDetailV2 } from '@/components/v2/token-detail-v2'
import { TokenDetailV1 } from '@/components/token-detail-v1'

export default function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  if (/^0x[a-fA-F0-9]{40}$/.test(id)) {
    return <TokenDetailV2 address={id as `0x${string}`} />
  }

  return <TokenDetailV1 id={id} />
}
