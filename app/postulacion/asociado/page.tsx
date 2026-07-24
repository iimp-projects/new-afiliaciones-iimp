import ApplicationView from "@/modules/afiliaciones/postulacion/Views/ApplicationView";
import { MembershipType } from "@/modules/afiliaciones/postulacion/Types/MembershipType";

export default function Page() {
    return (
        <ApplicationView
            membershipType={MembershipType.ASSOCIATE}
        />
    );
}