'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google: any;
    _googleMapsResolvers: Array<() => void>;
    initGoogleMaps: () => void;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    if (!window._googleMapsResolvers) {
      window._googleMapsResolvers = [];
    }
    window._googleMapsResolvers.push(resolve);

    if (document.getElementById('google-maps-script')) return;

    window.initGoogleMaps = () => {
      window._googleMapsResolvers?.forEach((fn) => fn());
      window._googleMapsResolvers = [];
    };

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

export function PlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: { address: string; city: string }) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    let cleanup: (() => void) | undefined;

    loadGoogleMapsScript(apiKey).then(() => {
      if (!inputRef.current || !window.google?.maps?.places) return;

      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'address_components'],
      });

      const listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        const city =
          place.address_components.find((c: any) =>
            c.types.includes('locality')
          )?.long_name ??
          place.address_components.find((c: any) =>
            c.types.includes('administrative_area_level_2')
          )?.long_name ??
          '';

        onSelect({ address: place.formatted_address ?? '', city });
      });

      cleanup = () => window.google.maps.event.removeListener(listener);
    });

    return () => cleanup?.();
  }, [apiKey]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={className}
      autoComplete="off"
    />
  );
}
