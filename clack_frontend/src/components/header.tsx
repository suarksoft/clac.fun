'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Search, Plus, Menu, X } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image 
            src="/clac-logo.svg" 
            alt="Clac.fun" 
            width={44} 
            height={44}
            className="h-11 w-11"
          />
          <span className="text-2xl font-bold text-foreground">Clac<span className="text-primary">.fun</span></span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link 
            href="/" 
            className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Terminal
          </Link>
          <Link 
            href="/leaderboard" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Leaderboard
          </Link>
          <Link 
            href="/create" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Create
          </Link>
          <Link 
            href="/portfolio" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Portfolio
          </Link>
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="hidden text-muted-foreground hover:text-foreground md:flex"
          >
            <Search className="h-5 w-5" />
          </Button>
          
          <Link href="/create">
            <Button className="hidden gap-2 bg-primary text-primary-foreground hover:bg-primary/90 md:flex">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </Link>

          <ConnectButton
            label="Connect"
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'address',
            }}
            chainStatus={{
              smallScreen: 'icon',
              largeScreen: 'name',
            }}
            showBalance={false}
          />

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container mx-auto flex flex-col gap-2 px-4 py-4">
            <Link 
              href="/" 
              className="rounded-lg px-4 py-2 text-sm font-medium text-primary hover:bg-secondary"
              onClick={() => setIsMenuOpen(false)}
            >
              Terminal
            </Link>
            <Link 
              href="/leaderboard" 
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Leaderboard
            </Link>
            <Link href="/create" onClick={() => setIsMenuOpen(false)}>
              <Button className="mt-1 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Create Token
              </Button>
            </Link>
            <Link 
              href="/portfolio" 
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              Portfolio
            </Link>
            <div className="mt-2 px-1">
              <ConnectButton label="Connect" showBalance={false} />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
