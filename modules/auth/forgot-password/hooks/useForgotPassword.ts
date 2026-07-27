"use client";

import { useState } from "react";
import { forgotPasswordAction } from "../action";
import type { ForgotPasswordState } from "../types";

export function useForgotPassword() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [state, setState] = useState<ForgotPasswordState>({ success: false });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setState({ success: false }); // Reset state

        try {
            const formData = new FormData();
            formData.append("email", email);

            // Llamamos al Server Action
            const result = await forgotPasswordAction(state, formData);
            setState(result);
        } catch (error) {
            setState({ success: false, message: "Ocurrió un error inesperado." });
        } finally {
            setIsLoading(false);
        }
    };

    return {
        email,
        setEmail,
        isLoading,
        state,
        handleSubmit,
    };
}