import { redirect } from "next/navigation";

// The old pipeline table is gone; its links land on the desk.
export default function PipelinePage() {
  redirect("/");
}
