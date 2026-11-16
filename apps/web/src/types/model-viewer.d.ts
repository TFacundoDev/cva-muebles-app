import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// <model-viewer> es un elemento web de Google, no un componente de React:
// acá se le avisa a TypeScript qué atributos acepta.
export interface ModelViewerElement extends HTMLElement {
  canActivateAR: boolean;
  loaded: boolean;
  activateAR(): Promise<void>;
  toBlob(options?: { mimeType?: string; qualityArgument?: number; idealAspect?: boolean }): Promise<Blob>;
}

type ModelViewerAttributes = DetailedHTMLProps<HTMLAttributes<ModelViewerElement>, ModelViewerElement> & {
  src?: string;
  poster?: string;
  alt?: string;
  ar?: boolean;
  'ar-modes'?: string;
  'ar-scale'?: 'auto' | 'fixed';
  'ar-placement'?: 'floor' | 'wall';
  'camera-controls'?: boolean;
  'auto-rotate'?: boolean;
  'touch-action'?: string;
  'shadow-intensity'?: string;
  'shadow-softness'?: string;
  'camera-orbit'?: string;
  'interaction-prompt'?: 'auto' | 'none';
  exposure?: string;
  loading?: 'auto' | 'lazy' | 'eager';
  reveal?: 'auto' | 'manual';
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}
