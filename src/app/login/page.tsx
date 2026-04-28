'use client';

import { signIn } from 'next-auth/react';
import { ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Bici Serial Tracker</h1>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>
          Please sign in with your Bici Google account to continue.
        </p>

        {error && (
          <div className="flex items-center gap-2" style={{
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            <ShieldAlert size={20} />
            <span className="text-sm">Access denied. You must use a @bici.cc email address.</span>
          </div>
        )}

        <button 
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
