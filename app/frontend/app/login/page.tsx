'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes

export default function LoginPage() {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { setAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(OTP_EXPIRY_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.status === 'otp_required') {
        setTempToken(res.data.tempToken);
        setStep('otp');
        startCountdown();
        toast({ title: 'Kode OTP dikirim', description: 'Cek email Anda untuk kode verifikasi 6 digit' });
      }
    } catch (err: any) {
      toast({ title: 'Login gagal', description: err.response?.data?.message || 'Email atau password salah', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({ title: 'Kode OTP harus 6 digit', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { tempToken, code: otpCode });
      setAuth(res.data.token, res.data.user);
      const dest = res.data.user.role === 'STAFF' ? '/expense-requests' : '/dashboard';
      router.push(dest);
    } catch (err: any) {
      toast({ title: 'Verifikasi gagal', description: err.response?.data?.message || 'Kode OTP tidak valid', variant: 'destructive' });
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post('/auth/resend-otp', { tempToken });
      if (countdownRef.current) clearInterval(countdownRef.current);
      startCountdown();
      setOtpCode('');
      toast({ title: 'Kode OTP baru telah dikirim', description: 'Cek email Anda' });
    } catch (err: any) {
      toast({ title: 'Gagal mengirim ulang', description: err.response?.data?.message || 'Coba lagi', variant: 'destructive' });
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const canResend = countdown <= OTP_EXPIRY_SECONDS - 30;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-700">Bhima Finance</h1>
          <p className="text-gray-500 text-sm mt-1">Internal Finance Management System</p>
        </div>

        {step === 'credentials' && (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="off" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="off" className="mt-1" />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? 'Memeriksa...' : 'Lanjutkan'}
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-blue-700 font-semibold text-sm mb-1">Kode OTP dikirim ke</div>
              <div className="text-gray-700 font-medium">{email}</div>
              {countdown > 0 ? (
                <div className="text-xs text-gray-500 mt-1">Berlaku {formatCountdown(countdown)}</div>
              ) : (
                <div className="text-xs text-red-500 mt-1">Kode kedaluwarsa — kirim ulang</div>
              )}
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <Label htmlFor="otp">Kode Verifikasi (6 digit)</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  className="mt-1 text-center text-2xl font-bold tracking-widest"
                  placeholder="000000"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading || otpCode.length !== 6}>
                {loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
              </Button>
            </form>

            <div className="flex items-center justify-between text-sm pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setOtpCode('');
                  setTempToken('');
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  setCountdown(0);
                }}
                className="text-gray-500 hover:text-gray-700 underline"
              >
                Ganti akun
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {canResend ? 'Kirim ulang OTP' : `Kirim ulang (${formatCountdown(countdown - (OTP_EXPIRY_SECONDS - 30))})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
