import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CertificateEditor } from './CertificateEditor';
import { ClientCertificate } from 'shim/objects/collection';

const { showOpenDialogMock } = vi.hoisted(() => ({ showOpenDialogMock: vi.fn() }));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: { showOpenDialog: showOpenDialogMock },
  },
}));

const CERT: ClientCertificate = {
  certPath: '/path/to/cert.pem',
  keyPath: '/path/to/key.pem',
  caPath: '/path/to/ca.pem',
};

describe('CertificateEditor', () => {
  beforeEach(() => {
    showOpenDialogMock.mockReset();
  });

  it('shows empty state when no certificate is configured', () => {
    render(<CertificateEditor certificate={null} onCertificateChange={vi.fn()} />);
    expect(screen.getByText(/no client certificate/i)).toBeTruthy();
  });

  it('shows configured certificate paths', () => {
    render(<CertificateEditor certificate={CERT} onCertificateChange={vi.fn()} />);
    expect(screen.getByDisplayValue('/path/to/cert.pem')).toBeTruthy();
    expect(screen.getByDisplayValue('/path/to/key.pem')).toBeTruthy();
    expect(screen.getByDisplayValue('/path/to/ca.pem')).toBeTruthy();
  });

  it('calls onCertificateChange with null when Remove is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    render(<CertificateEditor certificate={CERT} onCertificateChange={onChangeMock} />);
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onChangeMock).toHaveBeenCalledWith(null);
  });

  it('opens file dialog and updates certPath when Browse is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    showOpenDialogMock.mockResolvedValue({ canceled: false, filePaths: ['/new/cert.pem'] });
    render(<CertificateEditor certificate={CERT} onCertificateChange={onChangeMock} />);

    const browseButtons = screen.getAllByRole('button', { name: /browse/i });
    await user.click(browseButtons[0]); // first Browse = certPath

    expect(onChangeMock).toHaveBeenCalledWith({ ...CERT, certPath: '/new/cert.pem' });
  });

  it('does not update when file dialog is canceled', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });
    render(<CertificateEditor certificate={CERT} onCertificateChange={onChangeMock} />);

    const browseButtons = screen.getAllByRole('button', { name: /browse/i });
    await user.click(browseButtons[0]);

    expect(onChangeMock).not.toHaveBeenCalled();
  });

  it('initializes empty certificate fields when Add Certificate is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    render(<CertificateEditor certificate={null} onCertificateChange={onChangeMock} />);

    await user.click(screen.getByRole('button', { name: /add certificate/i }));

    expect(onChangeMock).toHaveBeenCalledWith({ certPath: '', keyPath: '', caPath: undefined });
  });

  it('shows clear buttons only for fields that have a value', () => {
    const partialCert: ClientCertificate = {
      certPath: '/path/to/cert.pem',
      keyPath: '',
      caPath: undefined,
    };
    render(<CertificateEditor certificate={partialCert} onCertificateChange={vi.fn()} />);

    const clearButtons = screen.getAllByRole('button', { name: /clear/i });
    expect(clearButtons).toHaveLength(1); // only certPath has a value
  });

  it('clears certPath when its Clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    render(<CertificateEditor certificate={CERT} onCertificateChange={onChangeMock} />);

    const clearButtons = screen.getAllByRole('button', { name: /clear/i });
    await user.click(clearButtons[0]); // first Clear = certPath

    expect(onChangeMock).toHaveBeenCalledWith({ ...CERT, certPath: '' });
  });

  it('clears keyPath when its Clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    render(<CertificateEditor certificate={CERT} onCertificateChange={onChangeMock} />);

    const clearButtons = screen.getAllByRole('button', { name: /clear/i });
    await user.click(clearButtons[1]); // second Clear = keyPath

    expect(onChangeMock).toHaveBeenCalledWith({ ...CERT, keyPath: '' });
  });

  it('clears caPath when its Clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    render(<CertificateEditor certificate={CERT} onCertificateChange={onChangeMock} />);

    const clearButtons = screen.getAllByRole('button', { name: /clear/i });
    await user.click(clearButtons[2]); // third Clear = caPath

    expect(onChangeMock).toHaveBeenCalledWith({ ...CERT, caPath: undefined });
  });
});
