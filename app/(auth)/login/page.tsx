import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage(): Promise<JSX.Element> {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return <LoginForm />;
}
