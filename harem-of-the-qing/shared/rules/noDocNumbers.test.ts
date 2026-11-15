/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

/**
 * "No number from the doc may appear anywhere else" than shared/balance.ts. Rule files may
 * only write 0 and 1 (nothing, and one step); every other number has to come from balance.ts.
 */
const ruleSources = import.meta.glob<string>(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const ALLOWED = new Set(['0', '1']);

function withoutCommentsAndText(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

function numbersIn(source: string): string[] {
  return withoutCommentsAndText(source).match(/(?<![\w$.])\d+(?:\.\d+)?(?![\w$])/g) ?? [];
}

describe('numbers from the doc', () => {
  it('finds the rule files to check', () => {
    expect(Object.keys(ruleSources)).toEqual(
      expect.arrayContaining(['./clock.ts', './training.ts', './relationships.ts', './money.ts', './gifting.ts']),
    );
  });

  it('spots a number written straight into a rule', () => {
    expect(numbersIn("const cost = 25; // not 3\nconst label = 'top 5';")).toEqual(['25']);
    expect(numbersIn('const half = value * 0.5;')).toEqual(['0.5']);
  });

  for (const [file, source] of Object.entries(ruleSources)) {
    it(`${file} takes every number from balance.ts`, () => {
      expect(numbersIn(source).filter((number) => !ALLOWED.has(number))).toEqual([]);
    });
  }
});
