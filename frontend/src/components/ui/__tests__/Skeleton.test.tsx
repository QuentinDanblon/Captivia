import { render, screen } from '@testing-library/react';
import Skeleton, { SkeletonGroup, SkeletonText } from '../Skeleton';

describe('ui/Skeleton', () => {
  it('gabarit décoratif, dimensions et forme', () => {
    const { container } = render(<Skeleton shape="circle" width={40} height={40} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('motion-safe:animate-pulse');
    expect(el.style.width).toBe('40px');
  });

  it('SkeletonText : n lignes, la dernière raccourcie', () => {
    const { container } = render(<SkeletonText lines={4} />);
    const lines = container.querySelectorAll('[data-skeleton]');
    expect(lines).toHaveLength(4);
    expect((lines[3] as HTMLElement).style.width).toBe('62%');
  });

  it('SkeletonGroup annonce le chargement (status, aria-busy, libellé masqué)', () => {
    render(
      <SkeletonGroup label="Chargement du carnet…">
        <SkeletonText />
      </SkeletonGroup>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Chargement du carnet…');
    expect(screen.getByText('Chargement du carnet…')).toHaveClass('sr-only');
  });
});
