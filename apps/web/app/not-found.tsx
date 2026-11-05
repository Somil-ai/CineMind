import Link from 'next/link';
export default function NotFound() { return <div className="py-16"><h1 className="font-display text-3xl font-bold">We couldn’t find that page</h1><Link href="/search" className="mt-4 inline-block underline">Search for a movie</Link></div>; }
