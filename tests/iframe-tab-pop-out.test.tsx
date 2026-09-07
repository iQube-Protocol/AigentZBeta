// @vitest-environment jsdom
/**
 * IframeTab — "pop out" affordance (a small floating overlay, not a chrome
 * row that would eat the embedded site's vertical space — see the
 * component's own header comment for why it lives here rather than in the
 * cartridge sub-header, which does not reliably render for a singleton-
 * group embed tab like qriptopia-web-embed / metame-web-embed).
 */
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { IframeTab } from '@/app/triad/components/codex/tabs/IframeTab';

describe('IframeTab — pop-out link', () => {
  it('renders an "Open in new tab" link pointing at the embed src, opened in a new tab', () => {
    render(<IframeTab src="https://qriptopia.com" title="qriptopia.com" />);
    const link = screen.getByRole('link', { name: 'Open embed URL in new tab' });
    expect(link).toHaveAttribute('href', 'https://qriptopia.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('never renders the pop-out link when no src is configured', () => {
    render(<IframeTab />);
    expect(screen.queryByRole('link', { name: 'Open embed URL in new tab' })).not.toBeInTheDocument();
  });

  it('still renders the iframe itself alongside the pop-out link', () => {
    render(<IframeTab src="https://metame.com" title="metame.com" />);
    expect(screen.getByTitle('metame.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open embed URL in new tab' })).toBeInTheDocument();
  });
});
