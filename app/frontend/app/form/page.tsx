'use client';

export default function FormRoot() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Link Tidak Valid</h2>
        <p className="text-gray-500 text-sm">
          Halaman ini memerlukan link khusus yang diberikan oleh tim finance.
          Hubungi admin untuk mendapatkan link pengajuan.
        </p>
      </div>
    </div>
  );
}
