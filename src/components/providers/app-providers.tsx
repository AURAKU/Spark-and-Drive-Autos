"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { InteractionFeedback } from "@/components/layout/interaction-feedback";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
        <QueryClientProvider client={client}>
          <InteractionFeedback />
          {children}
          <Toaster richColors position="top-center" />
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
