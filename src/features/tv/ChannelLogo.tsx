// =========================
// 🖼️ CHANNEL LOGO (with timeout)
// =========================
import React, { useState, useEffect } from 'react';
import { getImageUrl } from '@/hooks/useImageCache';

interface ChannelLogoProps {
  logo: string;
  name: string;
}

export const ChannelLogo: React.FC<ChannelLogoProps> = ({ logo, name }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout - longer than image cache timeout

    getImageUrl(logo, '', controller.signal)
      .then(url => {
        if (!controller.signal.aborted && url) {
          setSrc(url);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [logo]);

  if (error || !src) return null;

  return (
    <img 
      src={src} 
      alt={name}
      className="w-full h-16 object-contain mt-2"
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
    />
  );
};
