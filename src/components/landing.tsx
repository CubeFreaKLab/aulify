'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ThemeSwitcher } from './theme';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Layers2,
  Play,
  Plus,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';

function PlantDrawing({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 230" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M116 188c-4-33-1-86 18-130" />
        <path d="M126 100c-30-1-50-17-51-47 33 2 52 17 51 47Z" fill="var(--mint)" />
        <path d="M126 100 90 66" />
        <path d="M124 128c28 1 50-12 58-43-30-2-52 12-58 43Z" fill="var(--green)" />
        <path d="m125 127 41-29" />
        <path d="M116 149c-31 0-53-16-58-44 30 1 50 13 58 44Z" fill="var(--mint)" />
        <path d="m115 149-38-30" />
        <path d="M132 77c24-10 30-31 22-56-24 11-30 30-22 56Z" fill="var(--green)" />
        <path d="m133 76 15-37M115 187l-18 27m18-27 6 31m-6-31 29 24m-32-11-8 19m25-20 14 7M79 189c26 6 51 5 76-3" />
        <circle cx="43" cy="40" r="12" fill="var(--mint)" />
        <path d="M43 19v-7m0 56v-7M22 40h-7m57 0h-8M28 25l-5-5m40 40-5-5M28 55l-5 5m40-40-5 5M184 160c14-3 25-14 28-27m-10 2 10-2 2 11" />
      </g>
    </svg>
  );
}

function PencilDrawing() {
  return (
    <svg viewBox="0 0 330 55" fill="none" aria-hidden="true">
      <g stroke="var(--ink)" strokeWidth="2.7" strokeLinejoin="round">
        <path d="m6 27 42-17h247c21 0 21 35 0 35H48L6 27Z" fill="var(--paper)" />
        <path d="M48 10h227v35H48l6-12-6-10V10Z" fill="var(--green)" />
        <path d="M59 21h213M275 10v35m13-35v35" />
        <path d="m6 27 18-7 5 14-23-7Z" fill="var(--ink)" />
      </g>
    </svg>
  );
}

function HeroScene() {
  return (
    <div
      className="l-scene"
      role="group"
      aria-label="Un cuaderno, explicaciones y preguntas se reúnen para formar una clase"
    >
      <div className="l-scene-line" aria-hidden="true" />
      <div className="l-scene-book" aria-hidden="true">
        <Image
          src="/illustrations/cuaderno.svg"
          alt=""
          width={1706}
          height={922}
          priority
          sizes="(max-width: 600px) 94vw, (max-width: 1000px) 66vw, 720px"
        />
      </div>
      <div className="l-paper l-paper-question" aria-hidden="true">
        <span className="l-paper-label">
          <CircleHelp size={19} /> Pregunta
        </span>
        <p>
          ¿Qué hace posible
          <br />
          la fotosíntesis?
        </p>
        <div className="l-paper-answer">
          <span>A</span> El agua
        </div>
        <div className="l-paper-answer l-paper-answer-active">
          <span>B</span> La luz, el agua y el CO₂
        </div>
        <div className="l-paper-answer">
          <span>C</span> El oxígeno
        </div>
      </div>
      <div className="l-paper l-paper-plant" aria-hidden="true">
        <span className="l-paper-label">La fotosíntesis</span>
        <PlantDrawing />
      </div>
      <div className="l-scene-pencil" aria-hidden="true">
        <PencilDrawing />
      </div>
      <svg className="l-scene-marks" viewBox="0 0 1050 530" fill="none" aria-hidden="true">
        <g stroke="var(--green)" strokeWidth="3" strokeLinecap="round">
          <path d="m81 34 11 19m-35 7 20 5m-26 21 22-3M888 11l-10 20m34-5-19 15M925 357l24-3m-24 16 16 10M245 401c-25 4-45-7-54-22M798 454c24 0 41-12 49-33" />
        </g>
      </svg>
    </div>
  );
}

const sampleQuestions = [
  {
    title: '¿Qué necesita una planta para producir su alimento?',
    options: ['Luz, agua y dióxido de carbono', 'Solo agua y oxígeno', 'Tierra y oscuridad'],
    correct: 0,
    explanation:
      'Con la energía de la luz, la planta transforma agua y dióxido de carbono en azúcares y libera oxígeno.',
    type: 'Selección simple',
  },
  {
    title: 'La fotosíntesis libera oxígeno.',
    options: ['Verdadero', 'Falso'],
    correct: 0,
    explanation:
      'Así es: el oxígeno se libera durante el proceso. Los azúcares producidos sirven de alimento para la planta.',
    type: 'Verdadero o falso',
  },
  {
    title: '¿Qué le explicarías a alguien que deja su planta siempre a oscuras?',
    options: [],
    correct: -1,
    explanation:
      'Esta respuesta necesita una mirada humana. En una clase, el docente la revisa y te deja una devolución.',
    type: 'Respuesta escrita',
  },
];

function PracticeExample() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [written, setWritten] = useState('');
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const question = sampleQuestions[index];
  const isWritten = question.options.length === 0;
  const correct = selected === question.correct;

  function next() {
    if (index === sampleQuestions.length - 1) {
      setFinished(true);
      window.requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setWritten('');
    setAnswered(false);
    window.requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
  }

  function restart() {
    setIndex(0);
    setSelected(null);
    setWritten('');
    setAnswered(false);
    setFinished(false);
    window.requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
  }

  if (finished) {
    return (
      <div className="l-question l-question-complete">
        <span className="l-complete-mark">
          <CheckCheck size={32} />
        </span>
        <span className="l-small-label">Ejemplo completado</span>
        <h3 tabIndex={-1} ref={title}>
          Tu clase también
          <br />
          puede empezar así.
        </h3>
        <p>
          Una explicación, distintas formas de responder y espacio para la devolución del docente.
        </p>
        <Link className="button mint" href="/demo?perfil=estudiante">
          Explorar como estudiante <ArrowUpRight size={18} />
        </Link>
        <button className="l-text-button" onClick={restart}>
          <RotateCcw size={15} /> Repetir el ejemplo
        </button>
      </div>
    );
  }

  return (
    <div className="l-question">
      <div className="l-question-top">
        <span>{question.type}</span>
        <span>
          {index + 1} <span aria-hidden="true">/</span>
          <span className="sr-only">de</span> {sampleQuestions.length}
        </span>
      </div>
      <div className="l-question-progress" aria-hidden="true">
        {sampleQuestions.map((_, i) => (
          <span key={i} className={i <= index ? 'is-current' : ''} />
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if ((isWritten && written.trim()) || selected !== null) setAnswered(true);
        }}
      >
        <h3 tabIndex={-1} ref={title} id="l-example-question">
          {question.title}
        </h3>
        {isWritten ? (
          <label className="l-written-answer">
            Tu explicación
            <textarea
              value={written}
              onChange={(event) => setWritten(event.target.value)}
              maxLength={500}
              disabled={answered}
              placeholder="Pienso que…"
              rows={4}
            />
          </label>
        ) : (
          <fieldset
            className="l-example-choices"
            disabled={answered}
            aria-labelledby="l-example-question"
          >
            <legend className="sr-only">Elige una respuesta</legend>
            {question.options.map((option, optionIndex) => (
              <label
                key={option}
                className={`l-example-choice${selected === optionIndex ? ' is-selected' : ''}${answered && optionIndex === question.correct ? ' is-correct' : ''}${answered && selected === optionIndex && !correct ? ' is-incorrect' : ''}`}
              >
                <input
                  type="radio"
                  name={`sample-question-${index}`}
                  value={optionIndex}
                  checked={selected === optionIndex}
                  onChange={() => setSelected(optionIndex)}
                />
                <span className="l-choice-letter" aria-hidden="true">
                  {answered && optionIndex === question.correct ? (
                    <Check size={18} />
                  ) : answered && selected === optionIndex && !correct ? (
                    <X size={18} />
                  ) : (
                    String.fromCharCode(65 + optionIndex)
                  )}
                </span>
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
        )}
        {!answered && (
          <button
            type="submit"
            className="button"
            disabled={isWritten ? !written.trim() : selected === null}
          >
            Responder <ArrowRight size={18} />
          </button>
        )}
      </form>
      {answered && (
        <div className="l-example-feedback" role="status">
          <strong>
            {isWritten
              ? 'Para revisión del docente'
              : correct
                ? '¡Lo tienes!'
                : 'Una oportunidad para entenderlo'}
          </strong>
          <p>{question.explanation}</p>
          <button className="button" onClick={next}>
            {index === sampleQuestions.length - 1 ? 'Terminar ejemplo' : 'Siguiente pregunta'}{' '}
            <ArrowRight size={18} />
          </button>
        </div>
      )}
      <p className="l-example-disclaimer">
        Actividad de ejemplo. Tus respuestas aquí no generan una nota.
      </p>
    </div>
  );
}

function EditorPreview() {
  const [title, setTitle] = useState('La vida en una hoja');
  const [explanation, setExplanation] = useState(
    'Las plantas transforman la luz, el agua y el dióxido de carbono en alimento. ¿Qué ocurre si les falta luz?',
  );
  const [question, setQuestion] = useState(false);
  return (
    <div className="l-editor-preview" aria-label="Prueba de creación de un recurso">
      <div className="l-editor-bar">
        <span>
          <BookOpen size={17} /> Tu recurso de prueba
        </span>
      </div>
      <div className="l-editor-page">
        <label className="l-editor-title">
          Título del recurso
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
        </label>
        <label className="l-editor-explanation">
          Explicación
          <textarea
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            rows={4}
            maxLength={800}
          />
        </label>
        <div className="l-editor-image">
          <PlantDrawing />
          <p>
            Luz + agua + CO₂
            <br />
            <strong>Alimento para crecer.</strong>
          </p>
        </div>
        {question && (
          <div className="l-editor-quiz-block" role="status">
            <CircleHelp size={22} />
            <div>
              <strong>¿Qué necesita una planta para crecer?</strong>
              <p>Selección simple · Luz, agua y CO₂</p>
            </div>
            <button
              className="icon-button"
              onClick={() => setQuestion(false)}
              aria-label="Quitar pregunta de ejemplo"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {!question && (
          <button className="l-block-add" onClick={() => setQuestion(true)}>
            <Plus size={18} /> Añadir una pregunta de ejemplo
          </button>
        )}
      </div>
      <p className="l-editor-caption">
        Puedes escribir aquí. Este ejemplo no se guarda ni se publica.
      </p>
    </div>
  );
}

export function Landing() {
  return (
    <div className="l-page">
      <header className="l-header">
        <Link className="l-brand" href="/" aria-label="Aulify, inicio">
          <Image src="/brand/aulify-logo.svg" width={166} height={50} alt="Aulify" priority />
        </Link>
        <nav aria-label="Navegación principal" className="l-navigation">
          <a href="#la-idea" className="l-nav-section">
            La idea
          </a>
          <a href="#probar" className="l-nav-section">
            Pruébalo
          </a>
          <ThemeSwitcher compact />
          <Link href="/acceso">
            Entrar <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link className="button mint l-nav-create" href="/registro">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main id="contenido">
        <section className="l-hero" aria-labelledby="l-hero-title">
          <div className="l-hero-copy">
            <h1 id="l-hero-title">
              Que tu clase
              <br />
              <span>tome parte.</span>
            </h1>
            <p className="l-hero-description">
              Crea recursos con explicaciones y preguntas. Comparte una clase en la que todos puedan
              participar.
            </p>
            <div className="l-hero-actions">
              <Link className="button" href="/demo?perfil=docente">
                Explorar una clase <ArrowUpRight size={19} />
              </Link>
              <a className="l-inline-link" href="#probar">
                <Play size={17} /> Probar una pregunta
              </a>
            </div>
          </div>
          <HeroScene />
        </section>

        <section className="l-intro l-shell" id="la-idea" aria-labelledby="l-intro-title">
          <div className="l-intro-copy">
            <h2 id="l-intro-title">
              Una explicación puede
              <br />
              abrir muchas preguntas.
            </h2>
            <p>
              Un texto puede abrir una idea. Una imagen, hacerla más clara. Y una pregunta, darle
              voz a toda la clase. En Aulify, todo eso vive en el mismo recurso.
            </p>
          </div>
        </section>

        <section className="l-playground" id="probar" aria-labelledby="l-playground-title">
          <div className="l-shell l-playground-heading">
            <h2 id="l-playground-title">Entra en la clase.</h2>
            <p>Lee, piensa y responde. Prueba esta actividad de biología sin registrarte.</p>
          </div>
          <div className="l-shell l-example-grid">
            <div className="l-lesson-note">
              <div className="l-lesson-caption">
                <span>Biología</span>
                <span>La fotosíntesis</span>
              </div>
              <h3>
                Una hoja.
                <br />
                Todo un mundo.
              </h3>
              <PlantDrawing className="l-lesson-plant" />
              <p>
                Las plantas usan la luz del sol para transformar agua y dióxido de carbono en
                alimento.
              </p>
              <div className="l-lesson-formula">
                <span>Luz</span>
                <Plus size={12} />
                <span>Agua</span>
                <Plus size={12} />
                <span>CO₂</span>
                <ArrowRight size={19} />
                <span>Alimento</span>
              </div>
              <span className="l-note-corner" aria-hidden="true" />
            </div>
            <PracticeExample />
          </div>
          <div className="l-shell l-playground-bottom">
            <span>El docente decide cuándo mostrar respuestas y calificaciones.</span>
            <Link href="/demo?perfil=estudiante">
              Conocer la experiencia del estudiante <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>

        <section className="l-create l-shell" id="crear" aria-labelledby="l-create-title">
          <div className="l-create-copy">
            <h2 id="l-create-title">
              Prepara la clase
              <br />a tu manera.
            </h2>
            <p>
              Escribe una explicación, añade una imagen y suma preguntas justo donde hacen falta.
              Prepara a tu ritmo, mira cómo queda y decide cuándo compartirlo.
            </p>
            <ul className="l-create-benefits">
              <li>
                <Check size={18} /> Un borrador que puedes seguir trabajando
              </li>
              <li>
                <Check size={18} /> Práctica o examen: tú defines las reglas
              </li>
              <li>
                <Check size={18} /> Respuestas y devoluciones en su lugar
              </li>
            </ul>
            <Link className="button" href="/demo?perfil=docente">
              Conocer el espacio docente <ArrowUpRight size={18} />
            </Link>
          </div>
          <EditorPreview />
        </section>

        <section className="l-journey l-shell" aria-labelledby="l-journey-title">
          <div className="l-journey-heading">
            <h2 id="l-journey-title">
              Y después,
              <br />
              acompaña el aprendizaje.
            </h2>
          </div>
          <ol className="l-journey-list">
            <li>
              <span className="l-step-number">01</span>
              <Layers2 size={28} aria-hidden="true" />
              <div>
                <h3>Prepara algo tuyo.</h3>
                <p>
                  Reúne explicaciones, imágenes y preguntas en un recurso. Revísalo antes de
                  publicar.
                </p>
              </div>
            </li>
            <li>
              <span className="l-step-number">02</span>
              <Users size={28} aria-hidden="true" />
              <div>
                <h3>Abre la participación.</h3>
                <p>
                  Compártelo con tu materia. Cada estudiante responde desde su cuenta, en
                  computadora o celular.
                </p>
              </div>
            </li>
            <li>
              <span className="l-step-number">03</span>
              <CheckCheck size={28} aria-hidden="true" />
              <div>
                <h3>Escucha lo que aprendieron.</h3>
                <p>
                  Revisa respuestas, deja una devolución y publica las calificaciones cuando estén
                  listas.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="l-invitation" aria-labelledby="l-invitation-title">
          <div className="l-shell l-invitation-inner">
            <div>
              <h2 id="l-invitation-title">
                Hay lugar para
                <br />
                <span>tus ideas.</span>
              </h2>
            </div>
            <div className="l-invitation-actions">
              <p>Conoce Aulify desde los dos lados del aula.</p>
              <Link className="button" href="/demo?perfil=docente">
                Soy docente <ArrowRight size={19} />
              </Link>
              <Link className="l-invitation-student" href="/demo?perfil=estudiante">
                Soy estudiante <ArrowRight size={19} />
              </Link>
              <span>Explora una demostración con datos ficticios.</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="l-footer l-shell">
        <div className="l-footer-top">
          <Link href="/" aria-label="Aulify, volver al inicio">
            <Image src="/brand/aulify-logo.svg" width={155} height={47} alt="Aulify" />
          </Link>
          <p>El aula digital, más simple e interactiva.</p>
          <a href="#contenido">
            Volver arriba <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="l-footer-bottom">
          <span>Aulify · Recursos de clase interactivos</span>
          <nav aria-label="Más sobre Aulify">
            <a href="#crear">Para docentes</a>
            <a href="#probar">Para estudiantes</a>
            <Link href="/acceso">
              Iniciar sesión <ChevronRight size={15} />
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
