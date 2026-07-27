import { ResetPasswordForm } from "../components/ResetPasswordForm";

export function ResetPasswordView() {
    return (
        <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface font-sans antialiased">
            <section className="hidden md:flex md:w-[55%] h-full flex-col justify-center items-center relative bg-primary">
                {/* Background igual que forgot-password... */}
                <div className="relative z-10 w-full max-w-2xl px-10">
                    <h1 className="text-4xl font-bold text-white mb-3">
                        Ya casi estás <br/><span className="text-[#f3bd7a]">de vuelta</span>
                    </h1>
                </div>
            </section>
            <section className="w-full md:w-[45%] h-full flex flex-col justify-center items-center bg-surface-container-lowest">
                <div className="w-full max-w-[420px] px-6">
                     <ResetPasswordForm />
                </div>
            </section>
        </main>
    );
}