// สร้างไฟล์ใหม่สำหรับตรวจสอบสถานะ Supabase Realtime

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  try {
    // สร้าง Supabase client
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // ตรวจสอบสถานะ Realtime
    const { data, error } = await supabase.from("_realtime").select("*").limit(1)

    if (error) {
      console.error("Error checking Realtime status:", error)
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to check Realtime status",
          error: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      status: "success",
      message: "Realtime is working",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Exception checking Realtime status:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Exception checking Realtime status",
        error: error.message,
      },
      { status: 500 },
    )
  }
}
