"use client"

import { useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useToast } from "@/components/ui/use-toast"

export default function ProfileChecker() {
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    const checkProfile = async () => {
      try {
        // ตรวจสอบว่ามีการล็อกอินหรือไม่
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          return
        }

        // ตรวจสอบว่ามีโปรไฟล์หรือไม่
        const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

        if (error || !profile) {
          console.log("Profile not found, creating...")

          // ถ้าไม่มีโปรไฟล์ ให้สร้างใหม่โดยตรงผ่าน Supabase
          const username =
            session.user.user_metadata?.username ||
            session.user.email?.split("@")[0] ||
            "user_" + Math.random().toString(36).substring(2, 10)

          const { error: insertError } = await supabase.from("profiles").insert({
            id: session.user.id,
            username,
            updated_at: new Date().toISOString(),
          })

          if (insertError) {
            throw insertError
          }

          toast({
            title: "โปรไฟล์ถูกสร้างแล้ว",
            description: "โปรไฟล์ของคุณถูกสร้างโดยอัตโนมัติ",
          })
        }
      } catch (error) {
        console.error("Error checking profile:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถตรวจสอบหรือสร้างโปรไฟล์ได้",
          variant: "destructive",
        })
      }
    }

    checkProfile()
  }, [supabase, toast])

  // Component นี้ไม่แสดงอะไรในหน้าเว็บ
  return null
}
