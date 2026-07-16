"use client";

import { useState } from "react";
import { ArrowRight, CheckCheck, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import pkg from "../../../package.json";

type LoginCardProps = {
  errorMessage: string | null;
};

export default function LoginCard({
  errorMessage,
}: LoginCardProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      setLocalError("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    setLocalError(null);
    setSuccessMessage(null);

    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 500);
  }

return (
  <LoginCard
    errorMessage={message}
  />
);
}
