"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
    >
      Sign out
    </button>
  );
}
