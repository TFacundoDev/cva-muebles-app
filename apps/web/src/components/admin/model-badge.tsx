import { MODEL_STATUS_LABELS, type ModelStatus } from '@cva/shared';

/** Etiqueta con el estado del modelo 3D de un producto. El texto dice el estado; el color solo acompaña. */
export function ModelBadge({ status }: { status: ModelStatus | null }) {
  if (!status) return <span className="text-[13px] text-muted">Sin modelo</span>;
  const style =
    status === 'error'
      ? 'bg-[#f8dad5] text-[#9b2c1f]'
      : status === 'ready'
        ? 'bg-[#dcefe2] text-[#1f6b3f]'
        : 'bg-[#f6e7bf] text-[#7a5200]';
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${style}`}>
      {MODEL_STATUS_LABELS[status]}
    </span>
  );
}
