import { useActionQuery } from "@agent-native/core/client/hooks";
import { useState } from "react";

export default function HelloRoute() {
  const [name, setName] = useState("Alex");
  const { data, error } = useActionQuery("hello", { name });

  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 p-6">
      <h1 className="text-2xl font-semibold">Hello action</h1>
      <label htmlFor="hello-name">Name</label>
      <input id="hello-name" value={name} onChange={(event) => setName(event.target.value)} />
      <p aria-live="polite">{error ? "Greeting action failed." : data?.message ?? "Loading greeting…"}</p>
    </main>
  );
}
