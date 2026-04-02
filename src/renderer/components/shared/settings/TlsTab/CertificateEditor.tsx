import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddIcon, DeleteIcon, FolderSearchIcon } from '@/components/icons';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { ClientCertificate } from 'shim/objects/collection';

const eventService = RendererEventService.instance;

export interface CertificateEditorProps {
  certificate: ClientCertificate | null;
  onCertificateChange: (certificate: ClientCertificate | null) => void;
}

async function pickFile(): Promise<string | null> {
  const result = await eventService.showOpenDialog({ properties: ['openFile'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

export const CertificateEditor = ({ certificate, onCertificateChange }: CertificateEditorProps) => {
  const handleBrowse = async (field: keyof ClientCertificate) => {
    const path = await pickFile();
    if (path == null) return;
    onCertificateChange({ ...(certificate ?? { certPath: '', keyPath: '' }), [field]: path });
  };

  if (certificate == null) {
    return (
      <div className="flex h-full flex-col p-4">
        <Button
          className="h-fit gap-1 pl-0 hover:bg-transparent"
          size="sm"
          variant="ghost"
          onClick={() => onCertificateChange({ certPath: '', keyPath: '', caPath: undefined })}
        >
          <AddIcon /> Add Certificate
        </Button>

        <div className="text-muted-foreground flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 text-lg font-medium">No Client Certificate</div>
            <div className="text-sm">Add a certificate to enable mutual TLS authentication</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sidebar-foreground font-medium">Client Certificate</h3>
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-accent-primary active:text-accent-secondary hover:bg-transparent"
            aria-label="Remove"
            onClick={() => onCertificateChange(null)}
          >
            <DeleteIcon size={24} />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <CertField
          label="Certificate"
          value={certificate.certPath}
          placeholder="Path to client certificate (.pem / .crt)"
          onChange={(v) => onCertificateChange({ ...certificate, certPath: v })}
          onBrowse={() => handleBrowse('certPath')}
        />
        <CertField
          label="Private Key"
          value={certificate.keyPath}
          placeholder="Path to private key (.pem / .key)"
          onChange={(v) => onCertificateChange({ ...certificate, keyPath: v })}
          onBrowse={() => handleBrowse('keyPath')}
        />
        <CertField
          label="CA Certificate (optional)"
          value={certificate.caPath ?? ''}
          placeholder="Path to CA certificate (.pem / .crt)"
          onChange={(v) => onCertificateChange({ ...certificate, caPath: v || undefined })}
          onBrowse={() => handleBrowse('caPath')}
        />
      </div>
    </div>
  );
};

interface CertFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onBrowse: () => void;
}

const CertField = ({ label, value, placeholder, onChange, onBrowse }: CertFieldProps) => (
  <div className="space-y-1">
    <label className="text-sm font-medium">{label}</label>
    <div className="flex gap-2">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />
      <Button
        variant="ghost"
        size="icon"
        className="[&_.fills_path]:fill-foreground [&_.strokes_path]:stroke-foreground hover:[&_.fills_path]:fill-accent-primary hover:[&_.strokes_path]:stroke-accent-primary shrink-0 hover:bg-transparent"
        aria-label="Browse"
        onClick={onBrowse}
      >
        <FolderSearchIcon size={28} />
      </Button>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="hover:text-accent-primary active:text-accent-secondary shrink-0 hover:bg-transparent"
          aria-label="Clear"
          onClick={() => onChange('')}
        >
          <DeleteIcon size={28} />
        </Button>
      )}
    </div>
  </div>
);
