"use client";

import React from 'react';
import { Toaster } from 'react-hot-toast';

// Some Next.js + TS setups report an incompatible JSX element type for Toaster.
// Casting to a generic component avoids the false-positive while keeping runtime behavior.
const AnyToaster = Toaster as unknown as React.ComponentType<any>;

export default function ToasterClient() {
  return (
    <AnyToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#363636',
          color: '#fff',
        },
      }}
    />
  );
}
