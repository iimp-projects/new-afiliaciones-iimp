import { ApplicationDraft } from "../Models/ApplicationDraft";

export interface UpdateDraftDTO {

    currentStep: number;

    draftData: ApplicationDraft;

}