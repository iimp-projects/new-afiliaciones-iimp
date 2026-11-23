import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { AssociateProfileService } from "@/modules/afiliaciones/portal/Services/AssociateProfileService";
import { findMissingProfileData, toProfileCompletenessSource } from "@/modules/afiliaciones/portal/Rules/ProfileCompletenessRules";

export async function GET() {
  try {
    const user = await contextService.requireAffiliate();
    const profile = await new AssociateProfileService().getForUser(user.id);
    const missing = profile ? findMissingProfileData(toProfileCompletenessSource(profile)) : [];
    return NextResponse.json({ success: true, data: { complete: missing.length === 0, missing } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "No autorizado." }, { status: 403 });
  }
}
