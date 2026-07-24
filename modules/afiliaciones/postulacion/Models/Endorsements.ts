import { Endorsement } from "./Endorsement";

export interface Endorsements {

    firstEndorsement?: Endorsement;

    secondEndorsement?: Endorsement;

    declarationAccepted: boolean;

    declarationDocumentId?: string;

}