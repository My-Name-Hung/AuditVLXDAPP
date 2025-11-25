import "./StoreSkeleton.css";

export default function StoreSkeleton() {
  return (
    <div className="store-skeleton-card">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-code" />
      <div className="skeleton-line skeleton-address" />
      <div className="skeleton-line skeleton-contact" />
    </div>
  );
}

export function StoreSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <StoreSkeleton key={index} />
      ))}
    </>
  );
}

