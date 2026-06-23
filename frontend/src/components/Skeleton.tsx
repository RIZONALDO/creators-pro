/** Barra com shimmer — usa a keyframe `cpShimmer` de theme.css. */
export function SkeletonLine({ width = '100%', height = 12 }: { width?: string; height?: number }) {
  return (
    <div style={{
      height, width, borderRadius: 6,
      background: 'linear-gradient(90deg,var(--bg3) 0%,var(--bg4) 50%,var(--bg3) 100%)',
      backgroundSize: '400px 100%', animation: 'cpShimmer 1.4s linear infinite',
    }} />
  );
}

/** Repete `rows` linhas de skeleton, larguras alternadas (fiel à referência: 70%/90%/55%). */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const widths = ['70%', '90%', '55%'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '4px 0' }}>
      {Array.from({ length: rows }, (_, i) => <SkeletonLine key={i} width={widths[i % widths.length]} />)}
    </div>
  );
}
