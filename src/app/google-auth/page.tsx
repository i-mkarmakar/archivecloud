import { redirect } from "next/navigation";

export default function GoogleAuthRedirectPage() {
  redirect("/auth/sign-in");
}
