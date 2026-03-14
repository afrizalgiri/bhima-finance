'use client';
import { useEffect } from 'react';

export default function FaviconUpdater() {
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/company`)
      .then(r => r.json())
      .then(data => {
        const logoUrl = data?.data?.logoUrl;
        if (!logoUrl) return;
        const fullUrl = `${apiUrl}${logoUrl}`;
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = fullUrl;
      })
      .catch(() => {});
  }, []);

  return null;
}
