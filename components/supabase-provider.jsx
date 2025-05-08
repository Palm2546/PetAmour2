"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

const SupabaseContext = createContext(null)

export const SupabaseProvider = ({ children }) => {
  const [supabase] = useState(() => {
    const client = createClientComponentClient()
    return client
  })
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      try {
        // ดึงข้อมูล session ปัจจุบัน
        const {
          data: { session },
        } = await supabase.auth.getSession()

        // ตั้งค่า user state
        setUser(session?.user || null)

        // ตั้งค่า Realtime auth
        if (session) {
          supabase.realtime.setAuth(session)
        }

        setLoading(false)

        // ตั้งค่า listener สำหรับการเปลี่ยนแปลงสถานะการล็อกอิน
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          console.log("Auth state changed:", event)
          const newUser = session?.user || null

          if (newUser) {
            console.log("User logged in:", newUser.id)
            setUser(newUser)
            supabase.realtime.setAuth(session)
          } else {
            console.log("User logged out")
            setUser(null)
          }
        })

        return () => {
          authListener.subscription.unsubscribe()
        }
      } catch (error) {
        console.error("Error in getUser:", error)
        setLoading(false)
      }
    }

    getUser()

    // ตั้งค่า Realtime ให้ติดตามการเปลี่ยนแปลงของตาราง profiles
    const profilesChannel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          console.log("Profile change detected in provider:", payload)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(profilesChannel)
    }
  }, [supabase])

  useEffect(() => {
    if (!user) return

    console.log("Setting up profile subscription for user:", user.id)

    const profileSubscription = supabase
      .channel(`profile-changes-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Profile updated in provider:", payload)
          // ทำให้แน่ใจว่าการอัปเดตนี้เป็นของผู้ใช้ปัจจุบัน
          if (payload.new && payload.new.id === user.id) {
            // ส่ง event เพื่อบอกให้ components อื่นๆ รู้ว่ามีการอัปเดตโปรไฟล์
            const event = new CustomEvent("profile-updated", {
              detail: { profile: payload.new },
            })
            window.dispatchEvent(event)
          }
        },
      )
      .subscribe()

    return () => {
      console.log("Cleaning up profile subscription")
      supabase.removeChannel(profileSubscription)
    }
  }, [supabase, user])

  return <SupabaseContext.Provider value={{ supabase, user, loading }}>{children}</SupabaseContext.Provider>
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === null) {
    throw new Error("useSupabase must be used within a SupabaseProvider")
  }
  return context
}
