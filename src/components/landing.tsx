import Image from 'next/image';
import Link from 'next/link';
import { LandingHeader } from './landing-header';
import { LearningCarousel } from './learning-carousel';
import { PencilCursor } from './pencil-cursor';
import { ArrowRight } from 'lucide-react';
import { BrandArt } from './brand-art';
import { LandingMotion, LandingQuestion } from './landing-interaction';

export function Landing() {
  return (
    <LandingMotion>
      <PencilCursor />
      <LandingHeader />
      <main id="contenido">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-stage" aria-hidden="true">
            <div className="landing-wordmark">
              Aul<span className="landing-wordmark-i">ı</span>fy
            </div>
            <BrandArt
              name="hero-boy-notebook"
              className="hero-character hero-character-notebook"
              eager
            />
            <BrandArt
              name="hero-girl-laptop"
              className="hero-character hero-character-laptop"
              width={1024}
              height={600}
              eager
            />
            <BrandArt
              name="hero-boy-pencil"
              className="hero-character hero-character-pencil"
              eager
            />
          </div>
          <div className="landing-hero-copy">
            <h1 id="landing-title">El aula digital, más simple e interactiva.</h1>
            <p>Crea recursos de clase, comparte preguntas y acompaña el aprendizaje.</p>
            <div className="landing-cta-row">
              <Link href="/registro" className="button">
                Crear cuenta <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a href="#como-funciona" className="landing-text-link">
                Ver cómo funciona <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
        <section id="como-funciona" className="landing-journey" aria-label="Cómo funciona Aulify">
          <div className="landing-journey-intro">
            <h2>De la explicación a la práctica</h2>
            <BrandArt
              name="teacher-laptop"
              className="landing-journey-art landing-reveal"
              width={800}
              height={600}
            />
          </div>
          <div className="landing-journey-steps">
            {[
              {
                title: 'Prepara tu clase',
                text: 'Organiza explicaciones, imágenes y preguntas en un mismo recurso.',
                art: 'teacher-laptop',
              },
              {
                title: 'Hazla interactiva',
                text: 'Comparte una actividad y deja que cada estudiante participe.',
                art: 'student-phone',
              },
              {
                title: 'Revisa el progreso',
                text: 'Lee las respuestas, da retroalimentación y publica las notas.',
                art: 'student-progress',
              },
            ].map((step) => (
              <article className="landing-step" key={step.title}>
                <div className="landing-step-copy">
                  <h2>{step.title}</h2>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <LearningCarousel />
        <section id="plataforma" className="landing-product" aria-labelledby="product-title">
          <div className="landing-product-copy">
            <h2 id="product-title">Explicaciones y preguntas en el mismo recurso</h2>
            <p>Crea tu contenido, agrega preguntas y material de apoyo en un solo lugar.</p>
            <div className="landing-cta-row">
              <Link href="/registro" className="button">
                Crear cuenta <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/demo?perfil=docente" className="landing-text-link">
                Explorar la plataforma <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="landing-product-surface">
            <figure className="landing-editor-preview landing-reveal">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="preview-light"
                src="/previews/editor-light.webp"
                width={960}
                height={720}
                alt="Vista real del editor de Aulify con una explicación de ecosistemas y su actividad integrada"
                loading="lazy"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="preview-dark"
                src="/previews/editor-dark.webp"
                width={960}
                height={720}
                alt="Vista real del editor de Aulify en modo oscuro"
                loading="lazy"
              />
              <figcaption>Editor de recursos de la demostración</figcaption>
            </figure>
            <LandingQuestion />
          </div>
        </section>
        <section className="landing-close" aria-labelledby="close-title">
          <BrandArt
            name="friends-high-five"
            className="landing-close-art landing-reveal"
            width={900}
            height={650}
          />
          <div>
            <h2 id="close-title">Prepara una clase con Aulify</h2>
            <p>Empieza con un recurso, invita a tu curso y revisa sus respuestas.</p>
            <Link href="/registro" className="button">
              Crear cuenta <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Link href="/" aria-label="Aulify, inicio">
          <Image src="/brand/aulify-logo-white.svg" alt="Aulify" width={132} height={44} />
        </Link>
        <nav aria-label="Enlaces de la presentación">
          <a href="#plataforma">La plataforma</a>
          <a href="#como-funciona">Cómo funciona</a>
          <Link href="/demo/ayuda">Ayuda</Link>
        </nav>
        <nav className="landing-demo-links" aria-label="Demostración sin cuenta">
          <Link href="/demo?perfil=docente">Demo docente</Link>
          <Link href="/demo?perfil=estudiante">Demo estudiante</Link>
        </nav>
      </footer>
    </LandingMotion>
  );
}
