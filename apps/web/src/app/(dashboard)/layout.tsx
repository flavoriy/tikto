import { AppFrame } from "@/components/layout/app-frame";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppFrame>{children}</AppFrame>;
}
