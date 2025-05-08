// สร้าง API endpoint สำหรับซิงค์ข้อมูลโปรไฟล์

import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // ตรวจสอบว่ามีการล็อกอินหรือไม่
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user

    // ดึงข้อมูลโปรไฟล์ล่าสุด
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url, username")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // อัพเดทข้อมูลใน user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: profile.avatar_url,
        username: profile.username,
      },
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Profile synchronized successfully",
      profile,
    })
  } catch (error) {
    console.error("Error syncing profile:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
