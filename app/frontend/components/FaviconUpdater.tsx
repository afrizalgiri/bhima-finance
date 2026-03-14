'use client';
import { useEffect } from 'react';

export default function FaviconUpdater() {
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const serverBase = apiBase.replace('/api', '');
    fetch(`${apiBase}/company/public-logo`)
      .then(r => r.json())
      .then(data => {
        if (!data?.logoUrl) return;
        const fullUrl = `${serverBase}${data.logoUrl}`;
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.type = 'image/png';
        link.href = fullUrl;
      })
      .catch(() => {});
  }, []);

  return null;
}
