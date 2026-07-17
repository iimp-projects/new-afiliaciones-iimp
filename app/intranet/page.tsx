// app/intranet/page.tsx
import { auth } from "@/auth"; // Importamos el helper para usarlo DENTRO de la función

export default async function IntranetPage() {
  // Aquí usamos el helper correctamente
  const session = await auth(); 

  // Si quieres proteger la página también aquí:
  if (!session) {
     return <div>No autorizado</div>;
  }

  return (
    <main>
      <h1>Bienvenido a la Intranet, {session.user?.name}</h1>
      {/* Aquí va el contenido de tu página */}
    </main>
  );
}