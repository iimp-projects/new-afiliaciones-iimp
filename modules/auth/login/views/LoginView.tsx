import { LoginHero } from "../components/LoginHero";
import { LoginHeader } from "../components/LoginHeader";
import { LoginForm } from "../components/LoginForm";
import { LoginSocialButtons } from "../components/LoginSocialButtons";
import { LoginFooter } from "../components/LoginFooter";

export function LoginView() {
  return (
    <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface font-sans antialiased">
      <LoginHero />

      <section className="w-full md:w-[45%] h-full flex flex-col justify-center items-center relative overflow-hidden bg-surface-container-lowest">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>

        <div className="w-full max-w-[420px] px-6 relative z-10">
          <LoginHeader />
          <LoginForm />
          <LoginSocialButtons />
          <LoginFooter />
        </div>
      </section>
    </main>
  );
}