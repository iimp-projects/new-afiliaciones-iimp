"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "../action";
import type { ResetPasswordState } from "../types";

export function useResetPassword() {
    const [code, setCode] = useState(""); // 6 dígitos
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [state, setState] = useState<ResetPasswordState>({ success: false });
    
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            setState({ success: false, message: "Las contraseñas no coinciden." });
            return;
        }

        setIsLoading(true);
        setState({ success: false });

        try {
            const formData = new FormData();
            formData.append("email", "correo@del-usuario.com"); // Reemplazar con lógica real de captura de email (ej. searchParams)
            formData.append("token", code); // Asumiendo que adaptas el backend a aceptar el código de 6 dígitos
            formData.append("password", newPassword);
            formData.append("confirmPassword", confirmPassword);

            const result = await resetPasswordAction(state, formData);
            setState(result);

            if (result.success) {
                setTimeout(() => router.push("/login"), 2000);
            }
        } catch (error) {
            setState({ success: false, message: "Ocurrió un error." });
        } finally {
            setIsLoading(false);
        }
    };

    return {
        code, setCode,
        newPassword, setNewPassword,
        confirmPassword, setConfirmPassword,
        showPassword, setShowPassword,
        isLoading, state, handleSubmit
    };
}