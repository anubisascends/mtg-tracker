import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

interface FormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await loginApi(data);
      login(res.token, { userId: res.userId, username: res.username, email: res.email, role: res.role }, rememberMe);
      navigate(res.role === 'admin' ? '/admin' : '/events');
    } catch {
      setError('Invalid email or password.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>MTG Event Tracker</h1>
        <h2 style={styles.subtitle}>Sign In</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <span style={styles.fieldError}>{errors.email.message}</span>}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <span style={styles.fieldError}>{errors.password.message}</span>}
          </div>
          <div style={styles.rememberMe}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={styles.checkbox}
            />
            <label htmlFor="rememberMe" style={styles.rememberMeLabel}>Remember me</label>
          </div>
          <button type="submit" style={styles.btn}>Sign In</button>
        </form>
        <p style={styles.link}>
          No account? <Link to="/register" style={styles.linkText}>Register</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' },
  card: { backgroundColor: '#16213e', padding: '40px', borderRadius: '8px', width: '100%', maxWidth: '400px', border: '1px solid #a855f7' },
  title: { color: '#a855f7', textAlign: 'center', marginBottom: '4px', fontSize: '24px' },
  subtitle: { color: '#e2e8f0', textAlign: 'center', marginBottom: '24px', fontWeight: 'normal', fontSize: '18px' },
  error: { backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' },
  field: { marginBottom: '16px' },
  label: { display: 'block', color: '#cbd5e1', marginBottom: '6px', fontSize: '14px' },
  input: { width: '100%', padding: '10px', backgroundColor: '#0f3460', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px', boxSizing: 'border-box' },
  fieldError: { color: '#f87171', fontSize: '12px', marginTop: '4px', display: 'block' },
  rememberMe: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  checkbox: { accentColor: '#a855f7', width: '16px', height: '16px', cursor: 'pointer' },
  rememberMeLabel: { color: '#cbd5e1', fontSize: '14px', cursor: 'pointer' },
  btn: { width: '100%', padding: '12px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', marginTop: '8px' },
  link: { color: '#94a3b8', textAlign: 'center', marginTop: '16px', fontSize: '14px' },
  linkText: { color: '#a855f7' },
};
