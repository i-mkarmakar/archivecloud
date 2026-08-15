import { redirect } from "next/navigation";

export default function SignUpRedirectPage() {
  redirect("/auth/sign-up");
}
