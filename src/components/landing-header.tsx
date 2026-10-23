'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, BookOpen, Menu, Play, X } from 'lucide-react';
import { ThemeSwitcher } from './theme';
import '@/styles/landing-header.css';

function subscribeScroll(notify: () => void) {
  window.addEventListener('scroll', notify, { passive: true });
  return () => window.removeEventListener('scroll', notify);
}
const scrolledSnapshot = () => window.scrollY > 24;
const topSnapshot = () => false;

// The full-header → floating-pill interaction follows RewampUI Hero Morph Navbar.
// CSS keeps the same controls mounted and respects reduced motion.
export function LandingHeader() {
  const scrolled = useSyncExternalStore(subscribeScroll, scrolledSnapshot, topSnapshot);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="hero-nav-space">
      <header ref={root} className="hero-nav" data-scrolled={scrolled} data-open={open}>
        <Link href="/" className="hero-nav-logo" aria-label="Aulify, inicio">
          <img
            className="hero-nav-wordmark"
            src="/brand/aulify-logo.svg"
            alt="Aulify"
            width="160"
            height="54"
          />
          <img
            className="hero-nav-symbol"
            src="/brand/aulify-symbol.svg"
            alt=""
            width="44"
            height="44"
          />
        </Link>
        <nav
          id="landing-navigation"
          className="hero-nav-links"
          aria-label="Acceso a Aulify"
          onClick={() => setOpen(false)}
        >
          <a href="#plataforma" aria-label="La plataforma" title="La plataforma">
            <BookOpen size={19} aria-hidden="true" />
            <span>La plataforma</span>
          </a>
          <a href="#como-funciona" aria-label="Cómo funciona" title="Cómo funciona">
            <Play size={18} aria-hidden="true" />
            <span>Cómo funciona</span>
          </a>
          <Link href="/acceso" className="hero-nav-login">
            Entrar
          </Link>
        </nav>
        <Link href="/registro" className="button hero-nav-register">
          Crear cuenta <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
        <ThemeSwitcher compact />
        <button
          ref={toggle}
          type="button"
          className="icon-button hero-nav-menu"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="landing-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
    </div>
  );
}
