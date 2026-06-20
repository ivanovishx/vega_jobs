import { prisma } from '../db/prisma';

// Normalize a raw question/label into a stable signature used to match the
// same field across different application sites. Strips accents, punctuation
// and collapses whitespace so "What's your desired salary?" and
// "Desired salary:" map to the same key.
export function normalizeFieldKey(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

interface DiscoveredField {
  fieldKey?: string;
  label: string;
  fieldType?: string;
  options?: string[];
  value?: string | null;
  lastSeenUrl?: string;
}

export const customFieldService = {
  async list(userId: string) {
    return prisma.customField.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  // Upsert a batch of fields discovered by the extension. New fields are
  // created with a null value (so they show up in the profile UI as
  // "needs an answer"); existing fields are left untouched unless a value
  // is explicitly provided. Always returns the full, up-to-date list so the
  // extension can fill any fields it already has answers for.
  async discover(userId: string, fields: DiscoveredField[]) {
    for (const f of fields) {
      const fieldKey = f.fieldKey ? normalizeFieldKey(f.fieldKey) : normalizeFieldKey(f.label);
      if (!fieldKey || !f.label) continue;

      const existing = await prisma.customField.findUnique({
        where: { userId_fieldKey: { userId, fieldKey } },
      });

      if (!existing) {
        await prisma.customField.create({
          data: {
            userId,
            fieldKey,
            label: f.label.slice(0, 500),
            fieldType: f.fieldType || 'text',
            value: f.value ?? null,
            options: f.options ?? [],
            lastSeenUrl: f.lastSeenUrl ?? null,
          },
        });
      } else {
        // Refresh metadata (label wording / new options / last seen). Only
        // overwrite the value when the caller explicitly sends a non-empty one.
        const data: any = {
          label: f.label.slice(0, 500),
          fieldType: f.fieldType || existing.fieldType,
          lastSeenUrl: f.lastSeenUrl ?? existing.lastSeenUrl,
        };
        if (f.options && f.options.length) {
          data.options = Array.from(new Set([...existing.options, ...f.options]));
        }
        if (f.value != null && f.value !== '') {
          data.value = f.value;
        }
        await prisma.customField.update({
          where: { id: existing.id },
          data,
        });
      }
    }

    return this.list(userId);
  },

  // Save/overwrite the answer for a single field (used both by the UI and by
  // the extension when the user edits a field on the page).
  async saveValue(userId: string, payload: DiscoveredField) {
    const fieldKey = payload.fieldKey ? normalizeFieldKey(payload.fieldKey) : normalizeFieldKey(payload.label);
    if (!fieldKey) throw new Error('fieldKey or label required');

    return prisma.customField.upsert({
      where: { userId_fieldKey: { userId, fieldKey } },
      create: {
        userId,
        fieldKey,
        label: (payload.label || fieldKey).slice(0, 500),
        fieldType: payload.fieldType || 'text',
        value: payload.value ?? null,
        options: payload.options ?? [],
        lastSeenUrl: payload.lastSeenUrl ?? null,
      },
      update: {
        value: payload.value ?? null,
        ...(payload.label ? { label: payload.label.slice(0, 500) } : {}),
        ...(payload.options && payload.options.length ? { options: payload.options } : {}),
        ...(payload.lastSeenUrl ? { lastSeenUrl: payload.lastSeenUrl } : {}),
      },
    });
  },

  async updateById(userId: string, id: string, value: string | null) {
    const field = await prisma.customField.findFirst({ where: { id, userId } });
    if (!field) return null;
    return prisma.customField.update({ where: { id }, data: { value } });
  },

  async remove(userId: string, id: string) {
    const field = await prisma.customField.findFirst({ where: { id, userId } });
    if (!field) return null;
    await prisma.customField.delete({ where: { id } });
    return field;
  },
};
