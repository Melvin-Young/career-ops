import { IBM_Plex_Sans } from "next/font/google";

// One family carries the whole interface (see web/DESIGN.md). Weight does the
// work a second face used to do: 600 for titles and row names, 500 for
// controls and small labels, 400 for everything else.
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

// Secondary surfaces (explore, cv, analytics…) still import the previous
// names. They resolve to the same face so the app stays one system until those
// surfaces are redesigned; nothing in the primary journey uses these.
export const inter = plexSans;
export const instrumentSerif = plexSans;
export const instrumentSerifItalic = plexSans;
