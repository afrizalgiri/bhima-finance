'use client';
import { AuthContext, useAuthState } from '../hooks/useAuth';
import { Toaster } from './ui/toaster';

export default function Providers({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();
  return (
    <AuthContext.Provider value={auth}>
      {children}
      <Toaster />
    </AuthContext.Provider>
  );
}
