import { useRef, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Modal from '../Modal';

function Harness({
  variant,
  dismissible,
  withDescription = true,
  useInitialFocusRef = false,
}: {
  variant?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
  withDescription?: boolean;
  useInitialFocusRef?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const secondRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open-modal
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Titre de la modale"
        description={withDescription ? 'Description de la modale' : undefined}
        variant={variant}
        dismissible={dismissible}
        initialFocusRef={useInitialFocusRef ? secondRef : undefined}
      >
        <input aria-label="premier" />
        <input aria-label="second" ref={secondRef} />
      </Modal>
    </>
  );
}

function openModal() {
  const trigger = screen.getByText('open-modal');
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe('ui/Modal', () => {
  it('ne rend rien quand open=false', () => {
    render(<Modal open={false} onClose={jest.fn()} title="Caché" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('expose role=dialog, aria-labelledby (titre) et aria-describedby (description)', () => {
    render(<Harness />);
    openModal();

    const dialog = screen.getByRole('dialog');
    const title = screen.getByText('Titre de la modale');
    const description = screen.getByText('Description de la modale');
    expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    expect(dialog).toHaveAttribute('aria-describedby', description.id);
    expect(screen.getByRole('dialog', { name: 'Titre de la modale' })).toBe(dialog);
    expect(dialog).toHaveAccessibleDescription('Description de la modale');
  });

  it("n'ajoute pas aria-describedby quand il n'y a pas de description", () => {
    render(<Harness withDescription={false} />);
    openModal();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });

  it('variante alertdialog : role=alertdialog', () => {
    render(<Harness variant="alertdialog" />);
    openModal();
    expect(screen.getByRole('alertdialog', { name: 'Titre de la modale' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("place le focus initial sur le premier champ de la modale", async () => {
    render(<Harness />);
    openModal();
    await waitFor(() => expect(screen.getByLabelText('premier')).toHaveFocus());
  });

  it('respecte initialFocusRef pour le focus initial', async () => {
    render(<Harness useInitialFocusRef />);
    openModal();
    await waitFor(() => expect(screen.getByLabelText('second')).toHaveFocus());
  });

  it('Escape ferme la modale et rend le focus au déclencheur', async () => {
    render(<Harness />);
    const trigger = openModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('premier')).toHaveFocus());

    fireEvent.keyDown(screen.getByLabelText('premier'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('Escape appelle onClose une seule fois', async () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="Titre" />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('dismissible=false : Escape ne ferme pas et le bouton Fermer est désactivé', () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="Titre" dismissible={false} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'close' })).toBeDisabled();
  });

  it('le bouton Fermer (aria-label) ferme la modale', async () => {
    render(<Harness />);
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('hideCloseButton masque la croix', () => {
    render(<Modal open onClose={jest.fn()} title="Titre" hideCloseButton />);
    expect(screen.queryByRole('button', { name: 'close' })).not.toBeInTheDocument();
  });
});
