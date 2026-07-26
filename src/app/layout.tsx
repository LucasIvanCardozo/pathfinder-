import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { DisableContextMenu } from "./components/DisableContextMenu";

export const metadata: Metadata = {
  title: "Pathfinder — Battle Map",
  description:
    "Editor de mapas para Pathfinder. Arma escenarios con grilla, tiles y piezas personalizadas.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <DisableContextMenu />
        {children}
      </body>
    </html>
  );
}
