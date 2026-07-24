import Link from "next/link";

export function LoginFooter() {
  return (
    <p className="mt-8 text-center text-sm font-medium text-secondary">
      ¿No tienes una cuenta?{" "}
      <Link
        href="/postulacion"
        className="font-bold text-primary hover:underline underline-offset-4 transition-all"
      >
        Afíliate aquí
      </Link>
    </p>
  );
}