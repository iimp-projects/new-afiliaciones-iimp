"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordAction } from "../action";
import type { ResetPasswordState } from "../types";

export function useResetPassword() {
    const [code, setCode] = useState(""); 
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [state, setState] = useState<ResetPasswordState>({ success: false });
    
    const router = useRouter();
    // Capturamos los parámetros de la URL
    const searchParams = useSearchParams();
    const emailFromUrl = searchParams.get("email");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validamos que exista el correo en la URL
        if (!emailFromUrl) {
            setState({ success: false, message: "No se detectó el correo. Por favor, solicita el código nuevamente." });
            return;
        }
        
        if (newPassword !== confirmPassword) {
            setState({ success: false, message: "Las contraseñas no coinciden." });
            return;
        }

        setIsLoading(true);
        setState({ success: false });

        try {
            const formData = new FormData();
            formData.append("email", emailFromUrl); // Insertamos el correo real de la URL
            formData.append("token", code);
            formData.append("password", newPassword);
            formData.append("confirmPassword", confirmPassword);

            const result = await resetPasswordAction(state, formData);
            setState(result);

            if (result.success) {
                setTimeout(() => router.push("/login"), 2000);
            }
        } catch (error) {
            setState({ success: false, message: "Ocurrió un error al restablecer la contraseña." });
        } finally {
            setIsLoading(false);
        }
    };

    return {
        code, setCode,
        newPassword, setNewPassword,
        confirmPassword, setConfirmPassword,
        showPassword, setShowPassword,
        isLoading, state, handleSubmit,
        emailFromUrl
    };
}