import { useEffect, useState } from 'react';
import { Copy, Check, Download, Sparkles, HardDriveUpload, Link2, ExternalLink, X } from 'lucide-react';
import { fetchProfile, updateProfile } from '../api/client';

// The template is shown as a rendered PNG (frontend/public/cv-template.png) for a
// clean, chrome-free preview. To update the template, replace cv-template.png and
// upload the matching new PDF version in Drive ("Manage versions") so the backend's
// CV_TEMPLATE_FILE_ID keeps pointing to the same file.
const IMAGE_URL = '/cv-template.png';

// Backend root (auth routes live outside the /api prefix). "Guardar en mi Drive"
// is a full-page OAuth redirect, same pattern as the Google login button.
const AUTH_BASE = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3001';
const DRIVE_SAVE_URL = `${AUTH_BASE}/auth/google/drive`;

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

type DriveStatus = 'ok' | 'error' | 'auth';

export default function CVTemplate() {
  const [prompt, setPrompt] = useState<string>(buildPrompt(null));
  const [copied, setCopied] = useState(false);

  const [cvUrl, setCvUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [savingCv, setSavingCv] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [driveFileUrl, setDriveFileUrl] = useState('');

  useEffect(() => {
    fetchProfile()
      .then((profile) => {
        setPrompt(buildPrompt(profile));
        setCvUrl(profile?.cvCopyUrl ?? '');
        setSavedUrl(profile?.cvCopyUrl ?? '');
        // Keep a fresh link from the redirect if we just saved; otherwise use the
        // persisted one from the profile.
        setDriveFileUrl((prev) => prev || profile?.cvDriveFileUrl || '');
      })
      .catch(console.error);

    // Read the result of the "save to Drive" redirect, then clean the URL.
    const params = new URLSearchParams(window.location.search);
    const status = params.get('drive');
    if (status === 'ok' || status === 'error' || status === 'auth') {
      setDriveStatus(status);
      const fileUrl = params.get('fileUrl');
      if (fileUrl) setDriveFileUrl(fileUrl);
      window.history.replaceState({}, '', window.location.pathname);
    }
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

  const handleSaveCv = async () => {
    setSavingCv(true);
    try {
      const value = cvUrl.trim();
      await updateProfile({ cvCopyUrl: value || null });
      setSavedUrl(value);
    } catch (err) {
      console.error(err);
      alert('No se pudo guardar el link.');
    } finally {
      setSavingCv(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(savedUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert('No se pudo copiar el link.');
    }
  };

  const steps = [
    { icon: Download, label: 'Descarga la plantilla' },
    { icon: Copy, label: 'Copia el prompt' },
    { icon: Sparkles, label: 'Pégalo en tu IA' },
  ];

  const driveBanner: Record<DriveStatus, { text: string; className: string }> = {
    ok: {
      text: '¡Listo! Guardamos una copia de la plantilla en tu Google Drive.',
      className: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-300',
    },
    error: {
      text: 'No pudimos guardar la plantilla en tu Drive. Intenta de nuevo.',
      className: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300',
    },
    auth: {
      text: 'Inicia sesión para guardar la plantilla en tu Drive.',
      className: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300',
    },
  };

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

      {/* Banner del resultado de "Guardar en mi Drive" */}
      {driveStatus && (
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${driveBanner[driveStatus].className}`}>
          <p className="flex-1">{driveBanner[driveStatus].text}</p>
          {driveStatus === 'ok' && driveFileUrl && (
            <a
              href={driveFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-black/10 dark:border-white/20 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Ver en Drive
            </a>
          )}
          <button type="button" onClick={() => setDriveStatus(null)} aria-label="Cerrar" className="flex-shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
        <div className="w-full max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Plantilla de referencia
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={DRIVE_SAVE_URL}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <HardDriveUpload className="h-4 w-4" />
                {driveFileUrl ? 'Guardar de nuevo' : 'Guardar en mi Drive'}
              </a>

              {driveFileUrl ? (
                <a
                  href={driveFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 dark:border-indigo-500/40 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver en Drive
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Primero guarda la plantilla en tu Drive"
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-white/10 px-3 py-1.5 text-sm font-medium text-gray-400 dark:text-zinc-600 cursor-not-allowed"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver en Drive
                </button>
              )}
            </div>
          </div>

          {/* Estado de la copia en Drive */}
          <p className="mt-2 text-xs">
            {driveFileUrl ? (
              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                Ya tienes una copia guardada en tu Drive.
              </span>
            ) : (
              <span className="text-gray-400 dark:text-zinc-500">
                Aún no has guardado la plantilla en tu Drive.
              </span>
            )}
          </p>
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

      {/* Mi CV — link de la copia editada del usuario */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#16161a] shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 sm:px-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
            <Link2 className="h-4 w-4 text-indigo-500" />
            Mi CV
          </h3>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="mb-3 text-xs text-gray-500 dark:text-zinc-500">
            Guarda aquí el link de tu copia ya editada (Google Drive, Docs, etc.). Queda a la mano para copiarlo cuando lo necesites.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={cvUrl}
              onChange={(e) => setCvUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              className="flex-1 rounded-md border border-gray-300 dark:border-white/15 bg-white dark:bg-[#0b0b0e] px-3 py-2 text-sm text-gray-800 dark:text-zinc-200 focus:border-indigo-500 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleSaveCv}
              disabled={savingCv || cvUrl.trim() === savedUrl}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingCv ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          {savedUrl && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0b0b0e] px-3 py-2">
              <Link2 className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-zinc-500" />
              <a
                href={savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                title={savedUrl}
              >
                {savedUrl}
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                className={
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ' +
                  (linkCopied
                    ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300'
                    : 'border border-gray-300 dark:border-white/15 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/[0.08]')
                }
              >
                {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {linkCopied ? 'Copiado' : 'Copiar'}
              </button>
              <a
                href={savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir"
                className="inline-flex items-center rounded-md border border-gray-300 dark:border-white/15 px-2 py-1 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
