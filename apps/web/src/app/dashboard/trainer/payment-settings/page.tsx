import { redirect } from "next/navigation";

export default function TrainerPaymentSettingsRedirect() {
    redirect("/dashboard/payments");
}
