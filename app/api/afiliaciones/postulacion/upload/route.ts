import { NextRequest, NextResponse } from "next/server";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder =
      (formData.get("folder") as string) || "afiliaciones/temporal";

    if (!file)
      return NextResponse.json({ message: "No hay archivo." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const s3Service = new S3StorageService();
    const fileUrl = await s3Service.uploadFile(
      buffer,
      file.name,
      file.type,
      folder,
    );

    return NextResponse.json({
      success: true,
      data: { url: fileUrl, name: file.name, type: file.type },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
