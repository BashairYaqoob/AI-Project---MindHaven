import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PageLoader } from "@/components/PageLoader";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const [loaderDone, setLoaderDone] = useState(false);

  if (loading || !loaderDone) {
    return <PageLoader label="Welcome to MindHaven" minMs={4000} onFinish={() => setLoaderDone(true)} />;
  }

  return <Navigate to={session ? "/dashboard" : "/auth"} />;
}
