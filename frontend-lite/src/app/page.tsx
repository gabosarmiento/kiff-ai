import { LoginPage } from "../components/auth/LoginPage";

export default function RootLanding() {
  // Middleware handles all authentication redirects
  // This page only renders if middleware determined user should see login
  return <LoginPage />;
}
