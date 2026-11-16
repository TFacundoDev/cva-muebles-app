let loading: Promise<void> | null = null;

/**
 * Descarga la librería del visor 3D (pesa bastante, por eso se carga solo
 * cuando hace falta).
 *
 * Antes le indica que use el decodificador Draco que servimos nosotros en
 * /draco/, en lugar de bajarlo de un servidor de Google. La librería lee esa
 * configuración de una variable global al crear el primer visor.
 */
export function loadModelViewer(): Promise<void> {
  if (!loading) {
    const scope = self as unknown as { ModelViewerElement?: { dracoDecoderLocation?: string } };
    scope.ModelViewerElement = { ...scope.ModelViewerElement, dracoDecoderLocation: '/draco/' };
    loading = import('@google/model-viewer').then(() => undefined);
  }
  return loading;
}
