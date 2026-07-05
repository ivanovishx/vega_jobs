import { useEffect, useState } from 'react';
import { Copy, Check, Download, Sparkles } from 'lucide-react';
import { fetchProfile } from '../api/client';

// The template is shown as a rendered PNG (frontend/public/cv-template.png) for a
// clean, chrome-free preview. The downloadable file stays as the original PDF on
// Google Drive so the user can attach it to the AI. To update the template, replace
// cv-template.png and upload a new PDF version in Drive ("Manage versions") so the
// FILE_ID stays the same.
const FILE_ID = '1wN_z6DRva3dIArIUnWscnF9P7eiQJBZ9';
const IMAGE_URL = '/cv-template.png';
const DOWNLOAD_URL = `https://drive.google.com/uc?export=download&id=${FILE_ID}`;

function buildPrompt(profile: any): string {
  const name = profile?.user?.name || '[Tu nombre]';
  const email = profile?.user?.email || '[Tu email]';
  const phone = profile?.phone || '[Tu teléfono]';

  const links = [profile?.linkedInUrl, profile?.githubUrl, profile?.portfolioUrl]
    .filter(Boolean)
    .join(' · ') || '[LinkedIn / GitHub / Portfolio]';

  const skills = Array.isArray(profile?.resumeKeywords) && profile.resumeKeywords.length
    ? profile.resumeKeywords.join(', ')
    : '[Tus habilidades / keywords]';

  const currentCv = profile?.resumeText?.trim()
    ? profile.resumeText.trim()
    : '[Pega aquí el contenido actual de tu CV]';

  return `Actúa como un experto en redacción de CVs y reclutamiento (ATS).
Voy a adjuntar una PLANTILLA de CV. Reescribe y mejora mi CV siguiendo
exactamente su estructura, orden de secciones y estilo.

Mis datos actuales:
- Nombre: ${name}
- Contacto: ${email} · ${phone} · ${links}
- Habilidades / keywords: ${skills}
- Experiencia y contenido actual:
${currentCv}

Instrucciones:
1. Respeta la estructura de la plantilla adjunta.
2. Usa verbos de acción y cuantifica logros cuando sea posible.
3. Optimiza para ATS incorporando naturalmente las keywords listadas.
4. Mantén todo en 1 página salvo que la experiencia justifique 2.
5. Devuelve el CV final listo para copiar.`;
}

export default function CVTemplate() {
  const [prompt, setPrompt] = useState<string>(buildPrompt(null));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((profile) => setPrompt(buildPrompt(profile)))
      .catch(console.error);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert('No se pudo copiar el prompt.');
    }
  };

  const steps = [
    { icon: Download, label: 'Descarga la plantilla' },
    { icon: Copy, label: 'Copia el prompt' },
    { icon: Sparkles, label: 'Pégalo en tu IA' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-zinc-100 sm:text-3xl sm:tracking-tight">
          Plantilla CV
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
          Usa esta plantilla como referencia y copia el prompt para que una IA mejore tu CV siguiendo su estructura.
        </p>
      </div>

      {/* Guía de 3 pasos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.label}
              className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#16161a] px-4 py-3"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-zinc-100 truncate">{step.label}</p>
              </div>
              <Icon className="ml-auto h-4 w-4 flex-shrink-0 text-gray-300 dark:text-zinc-600" />
            </div>
          );
        })}
      </div>

      {/* Plantilla — como hoja de papel */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full max-w-2xl items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Plantilla de referencia
          </h3>
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-white/15 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            <Download className="h-4 w-4" />
            Descargar PDF
          </a>
        </div>
        <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white ring-1 ring-black/5 shadow-2xl">
          <img
            src={IMAGE_URL}
            alt="Plantilla de CV"
            className="block h-auto w-full"
          />
        </div>
      </div>

      {/* Prompt — tarjeta pulida */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#16161a] shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 sm:px-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Prompt personalizado
          </h3>
          <button
            type="button"
            onClick={handleCopy}
            className={
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
              (copied
                ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300'
                : 'bg-indigo-600 text-white hover:bg-indigo-700')
            }
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                ¡Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar prompt
              </>
            )}
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="mb-3 text-xs text-gray-500 dark:text-zinc-500">
            Ya viene pre-rellenado con los datos de tu perfil. Cópialo, pégalo en ChatGPT o Claude y adjunta la plantilla de arriba.
          </p>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 dark:bg-[#0b0b0e] p-4 text-[13px] leading-relaxed text-gray-700 dark:text-zinc-300 font-sans">
            {prompt}
          </pre>
        </div>
      </div>
    </div>
  );
}
