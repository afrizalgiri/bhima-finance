import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateInput(date: string | Date): string {
  return new Date(date).toISOString().split('T')[0];
}

export const EXPENSE_CATEGORIES = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'MEALS', label: 'Makan & Minum' },
  { value: 'TRAVEL', label: 'Perjalanan Dinas' },
  { value: 'OFFICE', label: 'Operasional Kantor' },
  { value: 'UTILITIES', label: 'Utilitas' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'OTHER', label: 'Lainnya' },
];

export const INVOICE_STATUS = [
  { value: 'UNPAID', label: 'Belum Dibayar', color: 'bg-red-100 text-red-700' },
  { value: 'PARTIAL', label: 'Sebagian', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'PAID', label: 'Lunas', color: 'bg-green-100 text-green-700' },
  { value: 'OVERDUE', label: 'Jatuh Tempo', color: 'bg-red-200 text-red-800' },
];

export const SPH_STATUS = [
  { value: 'DRAFT', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'SENT', label: 'Terkirim', color: 'bg-blue-100 text-blue-700' },
  { value: 'ACCEPTED', label: 'Diterima', color: 'bg-green-100 text-green-700' },
  { value: 'REJECTED', label: 'Ditolak', color: 'bg-red-100 text-red-700' },
];

export const PAYMENT_METHODS = [
  { value: 'TRANSFER', label: 'Transfer Bank' },
  { value: 'CASH', label: 'Tunai' },
  { value: 'CHECK', label: 'Cek' },
  { value: 'OTHER', label: 'Lainnya' },
];
