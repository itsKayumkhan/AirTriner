import { redirect } from "next/navigation";

export default function TrainerAvailabilityRedirect() {
    redirect("/dashboard/availability");
}
