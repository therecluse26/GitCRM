import { describe, expect, it } from 'vitest';
import { leadFormLink, leadFormSnippet } from './lead-form-html.ts';

describe('leadFormLink', () => {
  it('puts the form page beside index.html and the form ID in the hash', () => {
    expect(leadFormLink('exampleForm1', { origin: 'https://octo.github.io', pathname: '/gitcrm/' })).toBe('https://octo.github.io/gitcrm/lead.html#form=exampleForm1');
    expect(leadFormLink('exampleForm1', { origin: 'https://octo.github.io', pathname: '/gitcrm/index.html' })).toBe('https://octo.github.io/gitcrm/lead.html#form=exampleForm1');
    expect(leadFormLink('exampleForm1', { origin: 'http://localhost:5199', pathname: '/' })).toBe('http://localhost:5199/lead.html#form=exampleForm1');
  });
});

describe('leadFormSnippet', () => {
  it('posts the four fields and the honeypot to the form', () => {
    const html = leadFormSnippet('exampleForm1');
    expect(html).toContain('action="https://formcarry.com/s/exampleForm1"');
    for (const name of ['name', 'email', 'phone', 'message', '_gotcha']) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('<input type="email" name="email" required>');
    expect(html).not.toContain('<script');
  });
});
