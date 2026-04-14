import { describe, it, expect } from 'vitest';
import { detectLanguage, isBinaryFile } from '../../src/utils/language-detect.js';

describe('detectLanguage', () => {
  it('detects TypeScript', () => {
    expect(detectLanguage('src/index.ts')).toBe('TypeScript');
  });

  it('detects TypeScript React', () => {
    expect(detectLanguage('components/App.tsx')).toBe('TypeScript React');
  });

  it('detects JavaScript', () => {
    expect(detectLanguage('lib/utils.js')).toBe('JavaScript');
  });

  it('detects Python', () => {
    expect(detectLanguage('script.py')).toBe('Python');
  });

  it('detects Rust', () => {
    expect(detectLanguage('src/main.rs')).toBe('Rust');
  });

  it('detects Go', () => {
    expect(detectLanguage('main.go')).toBe('Go');
  });

  it('detects Dockerfile', () => {
    expect(detectLanguage('Dockerfile')).toBe('Dockerfile');
  });

  it('detects Makefile', () => {
    expect(detectLanguage('Makefile')).toBe('Makefile');
  });

  it('returns Unknown for unrecognized', () => {
    expect(detectLanguage('data.xyz')).toBe('Unknown');
  });

  it('detects CSS', () => {
    expect(detectLanguage('styles.css')).toBe('CSS');
  });

  it('detects JSON', () => {
    expect(detectLanguage('package.json')).toBe('JSON');
  });

  it('detects YAML', () => {
    expect(detectLanguage('config.yml')).toBe('YAML');
    expect(detectLanguage('config.yaml')).toBe('YAML');
  });

  it('detects Markdown', () => {
    expect(detectLanguage('README.md')).toBe('Markdown');
  });
});

describe('isBinaryFile', () => {
  it('identifies PNG as binary', () => {
    expect(isBinaryFile('image.png')).toBe(true);
  });

  it('identifies JPEG as binary', () => {
    expect(isBinaryFile('photo.jpg')).toBe(true);
  });

  it('identifies ZIP as binary', () => {
    expect(isBinaryFile('archive.zip')).toBe(true);
  });

  it('identifies EXE as binary', () => {
    expect(isBinaryFile('program.exe')).toBe(true);
  });

  it('does not identify TS as binary', () => {
    expect(isBinaryFile('index.ts')).toBe(false);
  });

  it('does not identify MD as binary', () => {
    expect(isBinaryFile('README.md')).toBe(false);
  });

  it('identifies lock files as binary', () => {
    expect(isBinaryFile('db.lock')).toBe(true);
  });

  it('identifies font files as binary', () => {
    expect(isBinaryFile('font.woff2')).toBe(true);
  });
});
