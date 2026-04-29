'use client'

import Image, { type ImageProps } from 'next/image'
import { useEffect, useState } from 'react'

const PLACEHOLDER = '/clac-logo.svg'

type TokenImageProps = Omit<ImageProps, 'src' | 'onError'> & {
  src?: string | null
}

export function TokenImage({ src, alt, ...props }: TokenImageProps) {
  const resolved = src && String(src).length > 0 ? src : PLACEHOLDER
  const [imgSrc, setImgSrc] = useState(resolved)

  useEffect(() => {
    setImgSrc(src && String(src).length > 0 ? src : PLACEHOLDER)
  }, [src])

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      onError={() => setImgSrc(PLACEHOLDER)}
    />
  )
}
