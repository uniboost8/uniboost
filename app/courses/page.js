import { Suspense } from 'react';
import CoursesView from './view';

export const metadata = { title: 'Courses – Uni Boost' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoursesView />
    </Suspense>
  );
}
