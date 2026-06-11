import fs from 'node:fs';
import path from 'node:path';
import type { GeneratedFile } from './types.js';

export function writeGeneratedFile(file: GeneratedFile, outputDir: string): string {
  const absOutput = path.resolve(outputDir);
  fs.mkdirSync(absOutput, { recursive: true });

  const dest = path.join(absOutput, file.filename);

  // Avoid silently overwriting — rename if file already exists
  const safeDest = resolveConflict(dest);
  fs.writeFileSync(safeDest, file.content, 'utf-8');

  return safeDest;
}

function resolveConflict(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;

  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);

  let counter = 1;
  let candidate = `${base}-${counter}${ext}`;
  while (fs.existsSync(candidate)) {
    counter++;
    candidate = `${base}-${counter}${ext}`;
  }
  return candidate;
}
