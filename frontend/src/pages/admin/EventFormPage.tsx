import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { createEvent, getEvent, updateEvent } from '../../api/events';

interface FormData {
  name: string;
  description: string;
  format: string;
  date: string;
  maxPlayers: number;
  eliminationType: number;
  requiresDeckRegistration: boolean;
  proxiesAllowed: boolean;
}

const FORMATS = ['Standard', 'Modern', 'Legacy', 'Vintage', 'Commander', 'Draft', 'Sealed', 'Pioneer', 'Pauper'];
const ELIMINATION_TYPES = [
  { value: 0, label: 'Swiss' },
  { value: 1, label: 'Single Elimination' },
  { value: 2, label: 'Double Elimination' },
];

export default function EventFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ defaultValues: { maxPlayers: 8, eliminationType: 0, requiresDeckRegistration: false, proxiesAllowed: false } });
  const [eventStatus, setEventStatus] = useState<string>('Planning');
  const [error, setError] = useState<string>('');

  // Fields are locked once the event has advanced past Planning
  const fieldsLocked = isEdit && eventStatus !== 'Planning';

  useEffect(() => {
    if (isEdit) {
      getEvent(parseInt(id!)).then((ev) => {
        setEventStatus(ev.status);
        const elimMap: Record<string, number> = { Swiss: 0, SingleElimination: 1, DoubleElimination: 2 };
        reset({
          name: ev.name,
          description: ev.description,
          format: ev.format,
          date: ev.date.split('T')[0],
          maxPlayers: ev.maxPlayers,
          eliminationType: elimMap[ev.eliminationType] ?? 0,
          requiresDeckRegistration: ev.requiresDeckRegistration,
          proxiesAllowed: ev.proxiesAllowed,
        });
      });
    }
  }, [id, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      if (isEdit) {
        await updateEvent(parseInt(id!), data);
      } else {
        await createEvent(data);
      }
      navigate('/admin/events');
    } catch (e) {
      const err = e as { response?: { data?: { title?: string } }; message?: string };
      setError(err?.response?.data?.title ?? err?.message ?? 'An unexpected error occurred.');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>{isEdit ? 'Edit Event' : 'Create Event'}</h1>
      {fieldsLocked && (
        <div style={styles.lockedNotice}>
          This event has progressed past Planning. Name, description, format, and date are now locked.
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Event Name</label>
          <input
            style={{ ...styles.input, ...(fieldsLocked ? styles.inputLocked : {}) }}
            disabled={fieldsLocked}
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && <span style={styles.err}>{errors.name.message}</span>}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Description</label>
          <textarea
            style={{ ...styles.input, height: '80px', resize: 'vertical', ...(fieldsLocked ? styles.inputLocked : {}) }}
            disabled={fieldsLocked}
            {...register('description')}
          />
        </div>

        <div style={styles.row}>
          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.label}>Format</label>
            <select
              style={{ ...styles.input, ...(fieldsLocked ? styles.inputLocked : {}) }}
              disabled={fieldsLocked}
              {...register('format', { required: 'Format is required' })}
            >
              <option value="">Select format...</option>
              {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            {errors.format && <span style={styles.err}>{errors.format.message}</span>}
          </div>

          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.label}>Date</label>
            <input
              style={{ ...styles.input, ...(fieldsLocked ? styles.inputLocked : {}) }}
              type="date"
              disabled={fieldsLocked}
              {...register('date', { required: 'Date is required' })}
            />
            {errors.date && <span style={styles.err}>{errors.date.message}</span>}
          </div>

          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.label}>Max Players</label>
            <input
              style={styles.input}
              type="number"
              min={2}
              max={512}
              {...register('maxPlayers', { required: true, min: 2, valueAsNumber: true })}
            />
          </div>

          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.label}>Elimination Type</label>
            <select
              style={{ ...styles.input, ...(fieldsLocked ? styles.inputLocked : {}) }}
              disabled={fieldsLocked}
              {...register('eliminationType', { valueAsNumber: true })}
            >
              {ELIMINATION_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.checkboxLabel}>
              <input type="checkbox" {...register('requiresDeckRegistration')} style={styles.checkbox} />
              Requires Deck Registration
            </label>
          </div>
          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.checkboxLabel}>
              <input type="checkbox" {...register('proxiesAllowed')} style={styles.checkbox} />
              Proxies Allowed
            </label>
          </div>
        </div>

        {error && <div style={styles.errorMsg}>{error}</div>}
        <div style={styles.btnRow}>
          <button type="button" onClick={() => navigate('/admin/events')} style={styles.btnCancel}>Cancel</button>
          {!fieldsLocked && (
            <button type="submit" style={styles.btnSubmit}>{isEdit ? 'Save Changes' : 'Create Event'}</button>
          )}
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '700px' },
  heading: { color: '#a855f7', marginBottom: '24px' },
  lockedNotice: { backgroundColor: '#1e293b', border: '1px solid #475569', color: '#94a3b8', padding: '10px 14px', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' },
  form: { backgroundColor: '#16213e', padding: '24px', borderRadius: '8px', border: '1px solid #334155' },
  field: { marginBottom: '16px' },
  row: { display: 'flex', gap: '16px' },
  label: { display: 'block', color: '#cbd5e1', marginBottom: '6px', fontSize: '14px' },
  input: { width: '100%', padding: '10px', backgroundColor: '#0f3460', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px', boxSizing: 'border-box' },
  inputLocked: { opacity: 0.5, cursor: 'not-allowed' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '14px', cursor: 'pointer', userSelect: 'none' },
  checkbox: { width: '16px', height: '16px', accentColor: '#a855f7', cursor: 'pointer' },
  err: { color: '#f87171', fontSize: '12px', marginTop: '4px', display: 'block' },
  btnRow: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' },
  btnCancel: { padding: '10px 20px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' },
  btnSubmit: { padding: '10px 20px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  errorMsg: { backgroundColor: '#3b1c1c', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: '4px', fontSize: '13px', marginBottom: '12px' },
};
