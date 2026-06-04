export default function PageLoading({ label = 'กำลังโหลด…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <p className="text-ink-300 animate-pulse">{label}</p>
    </div>
  );
}