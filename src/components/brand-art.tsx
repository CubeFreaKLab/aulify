/* eslint-disable @next/next/no-img-element */
type BrandArtProps = {
  name: string;
  alt?: string;
  className?: string;
  eager?: boolean;
  width?: number;
  height?: number;
};

export function BrandArt({
  name,
  alt = '',
  className = '',
  eager = false,
  width = 640,
  height = 640,
}: BrandArtProps) {
  return (
    <span className={`brand-art ${className}`}>
      <img
        src={`/illustrations/aulify/${name}.svg`}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </span>
  );
}
