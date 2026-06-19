// One-shot codemod: append `dark:` variants to light-mode Tailwind utility
// classes across the app, producing a lambda.ai-inspired dark theme.
//
// Strategy: each light class token (e.g. `text-gray-900`) gets a curated dark
// counterpart appended (`text-gray-900 dark:text-zinc-100`). Tokens are matched
// only on Tailwind class-token boundaries so partial matches (e.g. `bg-gray-50`
// inside `bg-gray-500` or `hover:bg-gray-50`) and already-processed `dark:`
// tokens are never touched.
//
// Run once:  node scripts/darkmode-codemod.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// light token -> dark token to append (no `dark:` prefix here, added below)
const MAP = {
  // surfaces
  'bg-white': 'bg-[#16161a]',
  'bg-gray-50': 'bg-white/[0.04]',
  'bg-gray-50/40': 'bg-white/[0.03]',
  'bg-gray-100': 'bg-white/[0.06]',
  'bg-gray-200': 'bg-white/[0.09]',
  'hover:bg-gray-50': 'hover:bg-white/[0.05]',
  'hover:bg-gray-100': 'hover:bg-white/[0.08]',

  // text
  'text-gray-900': 'text-zinc-100',
  'text-gray-800': 'text-zinc-100',
  'text-gray-700': 'text-zinc-300',
  'text-gray-600': 'text-zinc-400',
  'text-gray-500': 'text-zinc-400',
  'text-gray-400': 'text-zinc-500',
  'text-gray-300': 'text-zinc-600',
  'hover:text-gray-900': 'hover:text-zinc-100',
  'hover:text-gray-700': 'hover:text-zinc-200',
  'hover:text-gray-600': 'hover:text-zinc-300',
  'placeholder-gray-400': 'placeholder-zinc-500',

  // borders / dividers
  'border-gray-300': 'border-white/15',
  'border-gray-200': 'border-white/10',
  'border-gray-100': 'border-white/[0.07]',
  'border-gray-50': 'border-white/5',
  'divide-gray-300': 'divide-white/15',
  'divide-gray-200': 'divide-white/10',
  'divide-gray-100': 'divide-white/[0.07]',
  'sm:divide-gray-200': 'sm:divide-white/10',
  'ring-gray-300': 'ring-white/15',

  // indigo accent
  'text-indigo-600': 'text-indigo-400',
  'text-indigo-700': 'text-indigo-300',
  'text-indigo-800': 'text-indigo-300',
  'text-indigo-900': 'text-indigo-200',
  'text-indigo-500': 'text-indigo-400',
  'hover:text-indigo-900': 'hover:text-indigo-200',
  'hover:text-indigo-800': 'hover:text-indigo-300',
  'hover:text-indigo-600': 'hover:text-indigo-400',
  'hover:text-indigo-500': 'hover:text-indigo-400',
  'group-hover:text-indigo-500': 'group-hover:text-indigo-400',
  'bg-indigo-50': 'bg-indigo-500/15',
  'bg-indigo-100': 'bg-indigo-500/20',
  'hover:bg-indigo-50': 'hover:bg-indigo-500/15',
  'hover:bg-indigo-200': 'hover:bg-indigo-500/25',
  'file:bg-indigo-50': 'file:bg-indigo-500/15',
  'file:bg-indigo-100': 'file:bg-indigo-500/20',
  'file:text-indigo-700': 'file:text-indigo-300',
  'border-indigo-100': 'border-indigo-500/30',

  // red
  'text-red-600': 'text-red-400',
  'text-red-500': 'text-red-400',
  'text-red-700': 'text-red-300',
  'text-red-800': 'text-red-300',
  'hover:text-red-700': 'hover:text-red-300',
  'hover:text-red-800': 'hover:text-red-300',
  'hover:text-red-500': 'hover:text-red-400',
  'bg-red-50': 'bg-red-500/10',
  'bg-red-100': 'bg-red-500/15',
  'hover:bg-red-50': 'hover:bg-red-500/10',
  'border-red-200': 'border-red-500/30',
  'border-red-300': 'border-red-500/40',
  'border-red-100': 'border-red-500/20',

  // emerald / green
  'text-emerald-600': 'text-emerald-400',
  'text-emerald-700': 'text-emerald-300',
  'text-emerald-800': 'text-emerald-300',
  'hover:text-emerald-800': 'hover:text-emerald-300',
  'bg-emerald-50': 'bg-emerald-500/10',
  'bg-emerald-100': 'bg-emerald-500/15',
  'border-emerald-200': 'border-emerald-500/30',
  'text-green-600': 'text-green-400',
  'text-green-800': 'text-green-300',
  'bg-green-100': 'bg-green-500/15',

  // amber / yellow
  'text-amber-700': 'text-amber-300',
  'text-amber-600': 'text-amber-400',
  'bg-amber-50': 'bg-amber-500/10',
  'bg-amber-100': 'bg-amber-500/15',
  'border-amber-200': 'border-amber-500/30',
  'text-yellow-600': 'text-yellow-400',

  // purple / blue
  'text-purple-700': 'text-purple-300',
  'bg-purple-100': 'bg-purple-500/15',
  'text-blue-700': 'text-blue-300',
  'text-blue-800': 'text-blue-300',
  'bg-blue-100': 'bg-blue-500/15',
};

// Characters that are part of a Tailwind class token. Boundaries ensure we only
// match whole tokens and never re-touch the appended `dark:` variants.
const TOKEN_CHAR = "A-Za-z0-9:/_\\-.\\[\\]%#";
const before = `(?<![${TOKEN_CHAR}])`;
const after = `(?![${TOKEN_CHAR}])`;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function transform(src) {
  let out = src;
  for (const [light, dark] of Object.entries(MAP)) {
    const re = new RegExp(`${before}${escapeRe(light)}${after}`, 'g');
    out = out.replace(re, `${light} dark:${dark}`);
  }
  return out;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.vercel') continue;
      walk(p, acc);
    } else if (extname(p) === '.tsx') {
      acc.push(p);
    }
  }
  return acc;
}

const root = new URL('../src', import.meta.url).pathname;
let changed = 0;
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  const next = transform(src);
  if (next !== src) {
    writeFileSync(file, next);
    changed++;
    console.log('updated', file.replace(root, 'src'));
  }
}
console.log(`\nDone. ${changed} files updated.`);
