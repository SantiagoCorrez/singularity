import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { figureSchema, reportSchema } from '@/generated/schemas';
import type { Report } from '@/types/report';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(figureSchema as object);
const validateFn = ajv.compile(reportSchema as object);

export function validateReport(data: unknown): { ok: true; report: Report } | { ok: false; errors: string[] } {
  if (validateFn(data)) return { ok: true, report: data as Report };
  const errors = (validateFn.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim());
  return { ok: false, errors };
}
