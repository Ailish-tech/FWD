import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Phoenix",
  description: "Workspaces, projects and tasks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NavBar />
          <div className="shell">
            <Sidebar />
            <main className="container">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
