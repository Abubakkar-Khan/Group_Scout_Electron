export const authClient = {
  signIn: {
    email: async ({ email, password }: { email: string; password: string }) => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: { message: data.error || "Failed to sign in" } };
        }
        return { data, error: null };
      } catch (err: any) {
        return { error: { message: err.message || "Network error" } };
      }
    },
  },
  signUp: {
    email: async ({ name, email, password }: { name: string; email: string; password: string }) => {
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: { message: data.error || "Failed to create account" } };
        }
        return { data, error: null };
      } catch (err: any) {
        return { error: { message: err.message || "Network error" } };
      }
    },
  },
  signOut: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  },
};

export const { signIn, signUp, signOut } = authClient;
