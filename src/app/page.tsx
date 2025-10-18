import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-pink-600">Welcome to Dance Hive</h1>
        <p className="text-gray-700 text-lg max-w-3xl mb-8">
          A buzzing home for young dancers and their families. Explore our classes,
          book a free trial, and join our growing community.
        </p>
        <div className="flex gap-4">
          <Link href="/classes" className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6 py-3 rounded-md transition">
            View Classes
          </Link>
          <Link href="/book-trial" className="border border-pink-600 text-pink-700 hover:bg-pink-50 font-semibold px-6 py-3 rounded-md transition">
            Book a Trial
          </Link>
        </div>
      </main>
    </div>
  );
}
