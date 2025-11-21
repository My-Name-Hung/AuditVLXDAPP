import React from "react";
import "./StoreSkeleton.css";

export default function StoreSkeleton() {
  return (
    <tr className="store-skeleton-row">
      <td>
        <div className="skeleton skeleton-code"></div>
      </td>
      <td>
        <div className="skeleton skeleton-name"></div>
      </td>
      <td>
        <div className="skeleton skeleton-rank"></div>
      </td>
      <td>
        <div className="skeleton skeleton-address"></div>
      </td>
      <td>
        <div className="skeleton skeleton-partner"></div>
      </td>
      <td>
        <div className="skeleton skeleton-phone"></div>
      </td>
      <td>
        <div className="skeleton skeleton-status"></div>
      </td>
      <td>
        <div className="skeleton skeleton-actions"></div>
      </td>
    </tr>
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

