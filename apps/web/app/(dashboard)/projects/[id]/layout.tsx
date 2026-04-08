import type { ReactNode } from 'react';

/** @description Project detail structural layout — no data fetching; data flows from [id]/page.tsx */
export default function ProjectDetailLayout({ children }: { readonly children: ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
