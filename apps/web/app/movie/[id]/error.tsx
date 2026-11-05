'use client';
export default function MovieError({ error, reset }: { error: Error; reset: () => void }) {
  return <div role="alert" className="py-10"><p>{error.message}</p><button onClick={reset} className="mt-4 rounded-md bg-marquee px-4 py-2 font-medium text-onmarquee">Try again</button></div>;
}
