import Image from "next/image";
import Link from "next/link";
import "@/components/todo/presentation.css";
export default function NotFound() {
  return (
    <main className="todo-not-found">
      <article>
        <Image
          src="/favicon.svg"
          width={80}
          height={80}
          alt="Todo in a blue winter hat"
        />
        <h1>A little detour.</h1>
        <p>
          We couldn&#39;t find this corner. Your cozy room is still waiting for
          you.
        </p>
        <Link href="/?enter=room">Back to the room</Link>
      </article>
    </main>
  );
}
