// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"; // Importamos desde el auth.ts de la raíz
export const { GET, POST } = handlers;