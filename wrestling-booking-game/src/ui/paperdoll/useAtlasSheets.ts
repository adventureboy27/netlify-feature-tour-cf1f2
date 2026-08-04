// Sheet readiness as React state.
//
// Decoding the eight sheets is a one-time async step (the PNGs are inlined,
// so it's a decode, not a fetch — but Image decoding is still async). The
// underlying loader memoizes its promise, so a roster grid of 100 dolls
// mounting at once triggers one decode and 100 subscriptions.

import { useEffect, useState } from 'react';
import { loadAtlasSheets, getLoadedAtlasSheets, type AtlasSheets } from './atlas/sheets';

export function useAtlasSheets(): AtlasSheets | null {
  const [sheets, setSheets] = useState<AtlasSheets | null>(getLoadedAtlasSheets);

  useEffect(() => {
    if (sheets) return;
    let subscribed = true;
    loadAtlasSheets().then(
      (loaded) => {
        if (subscribed) setSheets(loaded);
      },
      (error: unknown) => {
        // Nothing to retry against — the sheets ship inside the bundle, so a
        // failure here means the bundle itself is broken. Surface it rather
        // than leaving every doll silently blank.
        console.error('Wrestler sprite atlas failed to load', error);
      },
    );
    return () => {
      subscribed = false;
    };
  }, [sheets]);

  return sheets;
}
