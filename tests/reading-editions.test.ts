import { describe, it, expect } from 'vitest';
import { getReadingEditions, resolveReadingEdition, defaultReadingText, readingAudioId, type EditionReadSource } from '../services/smartcontent/readingEditions';

const read: EditionReadSource = {
  text: 'Research [^1]\n\n[^1]: Immutable reference.', pdf_url: 'https://example.com/research.pdf', duration: '35 min read',
  defaultEdition: 'reading', editions: [
    { id: 'reading', label: 'Reading Edition', source: 'inline', text: 'Continuous prose.', pdf_url: '/api/content/media/reading', duration: '18 min read' },
    { id: 'research', label: 'Research Edition', source: 'canonical' },
  ],
};
describe('one publication, additive reading editions', () => {
  it('defaults Read and card Listen to prose', () => {
    expect(resolveReadingEdition(read)?.id).toBe('reading');
    expect(defaultReadingText(read)).toBe('Continuous prose.');
  });
  it('preserves canonical research bytes, duration and PDF', () => {
    const before=JSON.stringify(read);
    expect(resolveReadingEdition(read,'research')).toMatchObject({ text:read.text, pdf_url:read.pdf_url, duration:read.duration });
    expect(JSON.stringify(read)).toBe(before);
  });
  it('resolves edition-specific PDFs without falling back to the wrong PDF', () => {
    expect(resolveReadingEdition(read)?.pdf_url).toBe('/api/content/media/reading');
    expect(resolveReadingEdition({...read,editions:[{id:'reading',label:'Reading',source:'inline',text:'Prose'}]})?.pdf_url).toBeUndefined();
  });
  it('keeps legacy publications unchanged', () => {
    expect(getReadingEditions({text:'005'})).toEqual([]);
    expect(defaultReadingText({text:'005'})).toBe('005');
    expect(readingAudioId('005')).toBe('005');
  });
  it('uses separate audio identities for editions', () => {
    expect(readingAudioId('006',resolveReadingEdition(read))).toBe('006:edition:reading');
    expect(readingAudioId('006',resolveReadingEdition(read,'research'))).toBe('006:edition:research');
  });
  it('invalid selection returns the configured default', () => {
    expect(resolveReadingEdition(read,'obsolete')?.id).toBe('reading');
  });
  it('ignores malformed, empty and duplicate entries', () => {
    const malformed={...read,editions:[null,{}, {id:'reading',label:'Reading',source:'inline',text:''},...read.editions!,read.editions![0]]} as any;
    expect(getReadingEditions(malformed)).toHaveLength(2);
    expect(defaultReadingText({text:'legacy',editions:'bad'} as any)).toBe('legacy');
  });
  it.each(['javascript:alert(1)','//evil.example/a','http://example.com/a','/\\evil.example/a','https://user:pass@example.com/a'])('rejects unsafe PDF link %s', url => {
    expect(resolveReadingEdition({...read,editions:[{...read.editions![0],pdf_url:url}]})?.pdf_url).toBeUndefined();
  });
  it('canonical edition cannot override the original research source', () => {
    const r=resolveReadingEdition({...read,editions:[{id:'research',label:'Research',source:'canonical',text:'tampered',pdf_url:'/wrong.pdf'}]});
    expect(r?.text).toBe(read.text);
    expect(r?.pdf_url).toBe(read.pdf_url);
  });
});
