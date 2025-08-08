import { redirect } from "next/navigation";

export default function LegacyAuthSignupRedirect() {
  redirect("/signup");
}
