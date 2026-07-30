"use client";

export function ShareButton({ title }: { title: string }) {
  async function share() {
    if (navigator.share) {
      await navigator.share({ title, url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="rounded-xl bg-black px-4 py-2 font-bold text-white"
    >
      مشاركة
    </button>
  );
}
