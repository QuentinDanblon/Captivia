import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemePreference, ThemeToggle } from '../ThemePreference';

function mockColorScheme(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches: dark,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme preference', () => {
  it('defaults to the system theme and follows its dark preference', async () => {
    mockColorScheme(true);
    render(<ThemePreference />);

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
    expect(screen.getByRole('button', { name: 'themeSystem' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('captivia.theme')).toBeNull();
  });

  it('persists explicit light and dark choices', async () => {
    mockColorScheme(false);
    render(<ThemePreference />);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));

    fireEvent.click(screen.getByRole('button', { name: 'themeDark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('captivia.theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'themeLight' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('captivia.theme')).toBe('light');
  });

  it('the compact header toggle switches and persists the effective theme', async () => {
    mockColorScheme(false);
    render(<ThemeToggle />);
    const toggle = screen.getByRole('button', { name: 'themeTitle' });
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
    fireEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('captivia.theme')).toBe('dark');
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
  });

  it('updates the current theme when another tab changes the saved preference', async () => {
    mockColorScheme(false);
    render(<ThemePreference />);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
    localStorage.setItem('captivia.theme', 'dark');
    fireEvent(window, new StorageEvent('storage', { key: 'captivia.theme', newValue: 'dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'themeDark' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('the external prepaint bootstrap honors storage or the system before hydration', () => {
    mockColorScheme(true);
    const source = readFileSync(path.join(process.cwd(), 'public/theme-init.js'), 'utf8');
    window.eval(source);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    localStorage.setItem('captivia.theme', 'light');
    window.eval(source);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
