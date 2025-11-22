import "./UserSkeleton.css";

function UserSkeletonRow() {
  return (
    <tr className="user-skeleton-row">
      <td>
        <div className="skeleton skeleton-code"></div>
      </td>
      <td>
        <div className="skeleton skeleton-name"></div>
      </td>
      <td>
        <div className="skeleton skeleton-email"></div>
      </td>
      <td>
        <div className="skeleton skeleton-phone"></div>
      </td>
      <td>
        <div className="skeleton skeleton-position"></div>
      </td>
      <td>
        <div className="skeleton skeleton-actions"></div>
      </td>
    </tr>
  );
}

export function UserSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <UserSkeletonRow key={index} />
      ))}
    </>
  );
}


