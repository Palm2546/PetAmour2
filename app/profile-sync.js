"use server"

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export async function syncProfile() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    // ตรวจสอบว่ามีผู้ใช้ที่ล็อกอินอยู่หรือไม่
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.log("No active session found")
      return { success: false, message: "No active session" }
    }

    const user = session.user

    // ดึงข้อมูลโปรไฟล์จากตาราง profiles
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("Error fetching profile:", profileError.message)
      return { success: false, message: "Error fetching profile" }
    }

    if (!profileData) {
      console.error("Profile not found")
      return { success: false, message: "Profile not found" }
    }

    // สร้างข้อมูลที่จะอัพเดทเฉพาะส่วนที่จำเป็น
    const userData = {
      username: profileData.username,
      full_name: profileData.full_name,
      avatar_url: profileData.avatar_url,
    }

    // อัพเดทข้อมูลผู้ใช้ใน Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      data: userData,
    })

    if (updateError) {
      console.error("Error updating user data:", updateError.message)
      return { success: false, message: "Error updating user data" }
    }

    console.log("Profile synchronized successfully")
    return {
      success: true,
      message: "Profile synchronized successfully",
      profile: {
        id: profileData.id,
        username: profileData.username,
        full_name: profileData.full_name,
        avatar_url: profileData.avatar_url,
      },
    }
  } catch (error) {
    console.error("Error in syncProfile:", error.message || error)
    return { success: false, message: `Error in syncProfile: ${error.message || "Unknown error"}` }
  }
}
