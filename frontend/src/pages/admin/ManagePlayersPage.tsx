import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getPlayers,
  adminCreatePlayer,
  adminUpdatePlayer,
  adminDeletePlayer,
  adminUnarchivePlayer,
  generatePlayerInvite,
  sendPlayerInviteEmail,
  PlayerResponse,
  AdminCreatePlayerResponse,
} from '../../api/players';

export default function ManagePlayersPage() {
  const { user: currentUser } = useAuth();
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Shared invite dialog
  const [inviteResult, setInviteResult] = useState<AdminCreatePlayerResponse | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Create player modal
  const [showCreate, setShowCreate] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createNickname, setCreateNickname] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit player modal
  const [editTarget, setEditTarget] = useState<PlayerResponse | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editRole, setEditRole] = useState('player');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<PlayerResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Archived toggle
  const [showArchived, setShowArchived] = useState(false);

  const refreshPlayers = (archived = showArchived) => getPlayers(archived).then(setPlayers);

  useEffect(() => {
    setLoading(true);
    refreshPlayers(showArchived).finally(() => setLoading(false));
  }, [showArchived]);

  // --- Invite dialog ---
  const openInviteDialog = (result: AdminCreatePlayerResponse) => {
    setInviteResult(result);
    setEmailSent(false);
    setEmailSending(false);
    setEmailError('');
  };

  const closeInviteDialog = () => {
    setInviteResult(null);
    refreshPlayers();
  };

  const handleSendEmail = async () => {
    if (!inviteResult) return;
    setEmailSending(true);
    setEmailError('');
    try {
      await sendPlayerInviteEmail(inviteResult.userId);
      setEmailSent(true);
    } catch {
      setEmailError('Failed to send email.');
    } finally {
      setEmailSending(false);
    }
  };

  // --- Create ---
  const openCreate = () => {
    setShowCreate(true);
    setCreateUsername('');
    setCreateEmail('');
    setCreateNickname('');
    setCreateError('');
  };

  const handleCreate = async () => {
    setCreateError('');
    if (!createUsername.trim()) { setCreateError('Username is required.'); return; }
    if (!createEmail.trim()) { setCreateError('Email is required.'); return; }
    setCreating(true);
    try {
      const result = await adminCreatePlayer({
        username: createUsername.trim(),
        email: createEmail.trim(),
        nickname: createNickname.trim() || undefined,
      });
      setShowCreate(false);
      openInviteDialog(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setCreateError(err?.response?.data?.message ?? 'Failed to create player.');
    } finally {
      setCreating(false);
    }
  };

  // --- Edit ---
  const openEdit = (p: PlayerResponse) => {
    setEditTarget(p);
    setEditUsername(p.username);
    setEditEmail(p.email);
    setEditNickname(p.nickname ?? '');
    setEditRole(p.role);
    setEditError('');
  };

  const closeEdit = () => setEditTarget(null);

  const handleSave = async () => {
    if (!editTarget) return;
    setEditError('');
    if (!editUsername.trim()) { setEditError('Username is required.'); return; }
    if (!editEmail.trim()) { setEditError('Email is required.'); return; }
    setSaving(true);
    try {
      await adminUpdatePlayer(editTarget.id, {
        username: editUsername.trim(),
        email: editEmail.trim(),
        nickname: editNickname.trim() || undefined,
        role: editRole,
      });
      setEditTarget(null);
      refreshPlayers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setEditError(err?.response?.data?.message ?? 'Failed to update player.');
    } finally {
      setSaving(false);
    }
  };

  // --- Delete ---
  const openDelete = (p: PlayerResponse) => {
    setDeleteTarget(p);
    setDeleteError('');
  };

  const closeDelete = () => setDeleteTarget(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminDeletePlayer(deleteTarget.id);
      setDeleteTarget(null);
      refreshPlayers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setDeleteError(err?.response?.data?.message ?? 'Failed to delete player.');
    } finally {
      setDeleting(false);
    }
  };

  const handleUnarchive = async (player: PlayerResponse) => {
    try {
      await adminUnarchivePlayer(player.id);
      refreshPlayers();
    } catch {
      // swallow
    }
  };

  const handleResetPassword = async (player: PlayerResponse) => {
    try {
      const result = await generatePlayerInvite(player.id);
      openInviteDialog(result);
    } catch {
      // swallow
    }
  };

  const resetLink = inviteResult
    ? `${window.location.origin}/reset-password?token=${inviteResult.resetToken}`
    : '';

  const filtered = players.filter(
    (p) => p.username.toLowerCase().includes(search.toLowerCase()) ||
           p.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={styles.loading}>Loading players...</div>;

  return (
    <div>
      <div style={styles.headingRow}>
        <h1 style={styles.heading}>
          {showArchived ? 'Archived Players' : 'Players'} ({players.length})
        </h1>
        <div style={styles.headingActions}>
          <button
            type="button"
            style={showArchived ? styles.toggleBtnActive : styles.toggleBtn}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Viewing Archived' : 'Show Archived'}
          </button>
          {!showArchived && (
            <button type="button" style={styles.createBtn} onClick={openCreate}>+ Create Player</button>
          )}
        </div>
      </div>
      <input
        style={styles.search}
        placeholder="Search by username or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Username</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Wins</th>
            <th style={styles.th}>Losses</th>
            <th style={styles.th}>Draws</th>
            <th style={styles.th}>Total</th>
            <th style={styles.th}>Win Rate</th>
            <th style={styles.th}>Member Since</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const winRate = p.totalMatches > 0
              ? ((p.lifetimeWins / p.totalMatches) * 100).toFixed(1)
              : '0.0';
            const isSelf = p.id === currentUser?.userId;
            return (
              <tr key={p.id}>
                <td style={styles.td}>{p.username}{isSelf && <span style={styles.selfBadge}> (you)</span>}</td>
                <td style={styles.td}>{p.email}</td>
                <td style={styles.td}>
                  <span style={p.role === 'admin' ? styles.roleAdmin : styles.rolePlayer}>
                    {p.role}
                  </span>
                </td>
                <td style={{ ...styles.td, color: '#22c55e' }}>{p.lifetimeWins}</td>
                <td style={{ ...styles.td, color: '#ef4444' }}>{p.lifetimeLosses}</td>
                <td style={{ ...styles.td, color: '#f59e0b' }}>{p.lifetimeDraws}</td>
                <td style={styles.td}>{p.totalMatches}</td>
                <td style={{ ...styles.td, color: '#a855f7' }}>{winRate}%</td>
                <td style={styles.td}>{new Date(p.createdAt).toLocaleDateString()}</td>
                <td style={styles.tdActions}>
                  {showArchived ? (
                    <button type="button" style={styles.unarchiveBtn} onClick={() => handleUnarchive(p)}>
                      Unarchive
                    </button>
                  ) : (
                    <>
                      <button type="button" style={styles.actionBtn} onClick={() => openEdit(p)}>Edit</button>
                      <button type="button" style={styles.actionBtn} onClick={() => handleResetPassword(p)}>Reset PW</button>
                      <button
                        type="button"
                        style={styles.actionDeleteBtn}
                        onClick={() => openDelete(p)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot delete your own account' : undefined}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Create Player modal */}
      {showCreate && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Create Player</h2>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Username</label>
              <input style={styles.input} placeholder="e.g. jdoe" value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} autoFocus />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Email</label>
              <input style={styles.input} type="email" placeholder="player@example.com" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Nickname <span style={styles.optional}>(optional)</span></label>
              <input style={styles.input} placeholder="Display name on event pages" value={createNickname} onChange={(e) => setCreateNickname(e.target.value)} />
            </div>
            {createError && <p style={styles.error}>{createError}</p>}
            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="button" style={styles.confirmBtn} onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player modal */}
      {editTarget && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Edit Player</h2>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Username</label>
              <input style={styles.input} value={editUsername} onChange={(e) => setEditUsername(e.target.value)} autoFocus />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Email</label>
              <input style={styles.input} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Nickname <span style={styles.optional}>(optional)</span></label>
              <input style={styles.input} placeholder="Display name on event pages" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Role</label>
              <select
                style={styles.input}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                disabled={editTarget.id === currentUser?.userId}
              >
                <option value="player">player</option>
                <option value="admin">admin</option>
              </select>
              {editTarget.id === currentUser?.userId && (
                <span style={styles.optional}>Cannot change your own role</span>
              )}
            </div>
            {editError && <p style={styles.error}>{editError}</p>}
            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelBtn} onClick={closeEdit}>Cancel</button>
              <button type="button" style={styles.confirmBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Delete Player</h2>
            <p style={styles.modalSub}>
              Are you sure you want to delete <strong style={{ color: '#ef4444' }}>{deleteTarget.username}</strong>?
              This cannot be undone.
            </p>
            {deleteError && <p style={styles.error}>{deleteError}</p>}
            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelBtn} onClick={closeDelete}>Cancel</button>
              <button type="button" style={styles.confirmDeleteBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared invite dialog */}
      {inviteResult && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Player Invite</h2>
            <p style={styles.modalSub}>
              Share this link with <strong style={{ color: '#a855f7' }}>{inviteResult.username}</strong> to set their password:
            </p>
            <div style={styles.linkBox}>
              <span style={styles.linkText}>{resetLink}</span>
              <button type="button" style={styles.copyBtn} onClick={() => navigator.clipboard.writeText(resetLink)}>Copy</button>
            </div>
            <p style={styles.linkNote}>This link expires in 7 days.</p>
            {emailError && <p style={styles.error}>{emailError}</p>}
            {emailSent && <p style={styles.success}>Invite email sent to {inviteResult.email}.</p>}
            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelBtn} onClick={closeInviteDialog}>Done</button>
              <button
                type="button"
                style={inviteResult.emailConfigured ? styles.confirmBtn : styles.confirmBtnDisabled}
                onClick={handleSendEmail}
                disabled={!inviteResult.emailConfigured || emailSending || emailSent}
                title={!inviteResult.emailConfigured ? 'SMTP is not configured' : undefined}
              >
                {emailSending ? 'Sending…' : emailSent ? 'Sent!' : 'Email Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', textAlign: 'center', padding: '40px' },
  headingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
  heading: { color: '#a855f7', margin: 0 },
  headingActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  createBtn: { padding: '8px 16px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  toggleBtn: { padding: '8px 16px', backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  toggleBtnActive: { padding: '8px 16px', backgroundColor: '#1e293b', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  search: { width: '100%', maxWidth: '400px', padding: '10px', backgroundColor: '#16213e', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#94a3b8', padding: '10px', borderBottom: '1px solid #334155', fontSize: '13px' },
  td: { color: '#cbd5e1', padding: '10px', borderBottom: '1px solid #1e293b', fontSize: '14px' },
  selfBadge: { color: '#64748b', fontSize: '12px' },
  roleAdmin: { color: '#a855f7', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  rolePlayer: { color: '#64748b', fontSize: '12px' },
  tdActions: { color: '#cbd5e1', padding: '10px', borderBottom: '1px solid #1e293b', fontSize: '14px', display: 'flex', gap: '6px', flexWrap: 'nowrap' },
  actionBtn: { background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  actionDeleteBtn: { background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  unarchiveBtn: { background: 'transparent', border: '1px solid #f59e0b', color: '#f59e0b', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { backgroundColor: '#16213e', border: '1px solid #334155', borderRadius: '8px', padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '12px' },
  modalTitle: { color: '#e2e8f0', margin: 0 },
  modalSub: { color: '#94a3b8', fontSize: '14px', margin: 0 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldLabel: { color: '#cbd5e1', fontSize: '14px' },
  optional: { color: '#64748b', fontSize: '12px' },
  input: { padding: '10px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px' },
  linkBox: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', padding: '8px 10px' },
  linkText: { color: '#94a3b8', fontSize: '12px', wordBreak: 'break-all', flex: 1 },
  copyBtn: { padding: '4px 10px', backgroundColor: '#334155', color: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  linkNote: { color: '#64748b', fontSize: '12px', margin: 0 },
  error: { color: '#ef4444', fontSize: '13px', margin: 0 },
  success: { color: '#22c55e', fontSize: '13px', margin: 0 },
  modalActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  confirmBtn: { padding: '8px 16px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  confirmDeleteBtn: { padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  confirmBtnDisabled: { padding: '8px 16px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'not-allowed', fontSize: '14px', fontWeight: 'bold', opacity: 0.4 },
};
