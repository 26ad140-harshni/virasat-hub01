import { useState } from 'react';
import { X } from 'lucide-react';
import type { ScholarUser } from '../types';

interface ScholarAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (user: ScholarUser) => void;
}

export function ScholarAuthModal({ open, onClose, onSignIn }: ScholarAuthModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [role, setRole] = useState<'scholar' | 'curator'>('scholar');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const id = email
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .slice(0, 48);
    onSignIn({
      id: `sch-${id}`,
      name: name.trim(),
      email: email.trim(),
      affiliation: affiliation.trim() || 'Independent Historical Researcher',
      role,
    });
    onClose();
  };

  const quickDemo = (demoRole: 'scholar' | 'curator') => {
    onSignIn({
      id: demoRole === 'curator' ? 'curator-virasat' : 'scholar-meera',
      name: demoRole === 'curator' ? 'Dr. Arvind Subramanian' : 'Meera Deshmukh',
      email: demoRole === 'curator' ? 'curator@virasathub.org' : 'meera.research@virasathub.org',
      affiliation:
        demoRole === 'curator'
          ? 'Epigraphy & Manuscript Curatorial Desk'
          : 'Deccan Historical Studies Fellow',
      role: demoRole,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#162235]/60 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scholar Sign In"
    >
      <div className="w-full max-w-md bg-[var(--vh-surface)] border border-[var(--vh-border-strong)] rounded-lg shadow-2xl overflow-hidden text-[var(--vh-ink)]">
        <div className="px-6 py-4 border-b border-[var(--vh-border)] bg-[var(--vh-champagne-soft)] flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--vh-ink)]">
              Scholar Workspace Access
            </h2>
            <p className="text-xs text-[var(--vh-ink-muted)]">
              Sign in to synchronize research folders, field notes, and citations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center rounded border border-[var(--vh-border-strong)] bg-[var(--vh-input-bg)] text-[var(--vh-ink)] hover:bg-[var(--vh-surface-alt)] cursor-pointer"
            aria-label="Close sign in dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--vh-ink)] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Dr. Kavita Krishnan"
              className="w-full bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-2 text-sm text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/60 focus:outline-none focus:border-[#B58A45]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--vh-ink)] mb-1">Scholarly Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="scholar@university.edu"
              className="w-full bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-2 text-sm text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/60 focus:outline-none focus:border-[#B58A45]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--vh-ink)] mb-1">
              Affiliation (Optional)
            </label>
            <input
              type="text"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="Institute or Independent Researcher"
              className="w-full bg-[var(--vh-input-bg)] border border-[var(--vh-border)] rounded px-3 py-2 text-sm text-[var(--vh-ink)] placeholder:text-[var(--vh-ink-muted)]/60 focus:outline-none focus:border-[#B58A45]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--vh-ink)] mb-1">Role</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('scholar')}
                className={`py-2 px-3 text-xs font-medium rounded border transition-colors cursor-pointer ${
                  role === 'scholar'
                    ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] border-transparent font-semibold'
                    : 'bg-[var(--vh-input-bg)] text-[var(--vh-ink-muted)] border-[var(--vh-border)] hover:text-[var(--vh-ink)]'
                }`}
              >
                Research Scholar
              </button>
              <button
                type="button"
                onClick={() => setRole('curator')}
                className={`py-2 px-3 text-xs font-medium rounded border transition-colors cursor-pointer ${
                  role === 'curator'
                    ? 'bg-[var(--vh-btn-primary-bg)] text-[var(--vh-btn-primary-text)] border-transparent font-semibold'
                    : 'bg-[var(--vh-input-bg)] text-[var(--vh-ink-muted)] border-[var(--vh-border)] hover:text-[var(--vh-ink)]'
                }`}
              >
                Archive Curator
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#B58A45] text-[#162235] text-sm font-semibold rounded hover:bg-[#DCC8AD] transition-colors cursor-pointer"
          >
            Enter Research Space
          </button>

          <div className="pt-3 border-t border-[var(--vh-border)] space-y-2">
            <p className="text-xs text-[var(--vh-ink-muted)]">Or continue immediately with a curated profile:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => quickDemo('scholar')}
                className="py-2 px-3 text-xs font-medium border border-[var(--vh-border)] rounded bg-[var(--vh-input-alt)] hover:bg-[var(--vh-champagne-soft)] text-[var(--vh-ink)] cursor-pointer"
              >
                Fellow Profile
              </button>
              <button
                type="button"
                onClick={() => quickDemo('curator')}
                className="py-2 px-3 text-xs font-medium border border-[var(--vh-border)] rounded bg-[var(--vh-input-alt)] hover:bg-[var(--vh-champagne-soft)] text-[var(--vh-ink)] cursor-pointer"
              >
                Curator Profile
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
