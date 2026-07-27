import { NextRequest, NextResponse } from "next/server";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    if (!url) return NextResponse.json({ message: "URL no proporcionada" }, { status: 400 });

    const s3Service = new S3StorageService();
    const secureUrl = await s3Service.getPresignedUrl(url);

    return NextResponse.json({ success: true, data: { url: secureUrl } });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}