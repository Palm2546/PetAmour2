"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useSupabase } from "./supabase-provider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Menu, Plus, MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import NotificationBell from "./notification-bell"

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { supabase, user, loading } = useSupabase()
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Function to fetch profile data
  const fetchProfile = async () => {
    if (!user) return

    try {
      console.log("Fetching profile for user:", user.id)
      const { data, error } = await supabase.from("profiles").select("avatar_url, username").eq("id", user.id).single()

      if (error) {
        console.error("Error fetching profile in navbar:", error)
        return
      }

      if (data) {
        console.log("Fetched profile data in navbar:", data)
        setProfile(data)
        setIsAdmin(false)
      } else {
        console.warn("No profile data found for user:", user.id)
      }
    } catch (error) {
      console.error("Exception in fetchProfile:", error)
    }
  }

  useEffect(() => {
    // ดึงข้อมูลโปรไฟล์เมื่อมีการล็อกอิน

    fetchProfile()

    // ตั้งค่า Realtime subscription เพื่อติดตามการเปลี่ยนแปลงของโปรไฟล์
    if (user) {
      const profileSubscription = supabase
        .channel("navbar-profile-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            console.log("Profile updated:", payload)
            // อัพเดทข้อมูลโปรไฟล์เมื่อมีการเปลี่ยนแปลง
            if (payload.new) {
              setProfile({
                username: payload.new.username,
                avatar_url: payload.new.avatar_url,
              })
              setIsAdmin(false)
            }
          },
        )
        .subscribe()

      return () => {
        supabase.removeChannel(profileSubscription)
      }
    }
  }, [supabase, user])

  // เพิ่ม event listener สำหรับการอัปเดตโปรไฟล์ในคอมโพเนนต์ Navbar
  useEffect(() => {
    // ฟังก์ชันสำหรับจัดการเมื่อมีการอัปเดตโปรไฟล์
    const handleProfileUpdate = (event) => {
      console.log("Profile update event received in navbar:", event.detail)

      // ดึงข้อมูลโปรไฟล์ใหม่
      fetchProfile()
    }

    // เพิ่ม event listener
    window.addEventListener("profile-updated", handleProfileUpdate)

    // ลบ event listener เมื่อ component unmount
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate)
    }
  }, [user, supabase]) // เพิ่ม dependency เป็น user เพื่อให้ effect ทำงานเมื่อ user เปลี่ยน

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          {/* แก้ไขส่วนโลโก้และชื่อแอปพลิเคชัน */}
          <Link href="/" className="flex items-center gap-2">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#40E0D0] via-[#FFA500] to-[#FF6B6B] rounded-full opacity-0 group-hover:opacity-70 transition duration-300 blur-md"></div>
              <img
                src="/petamour-logo.png"
                alt="PetAmour Logo"
                className="h-10 w-10 md:h-11 md:w-11 relative logo-hover transition-all duration-300 hover:scale-110 rounded-full"
              />
            </div>
            <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-[#40E0D0] via-[#FFA500] to-[#FF6B6B] text-transparent bg-clip-text">
              PetAmour
            </span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-4">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors hover:text-[#40E0D0] px-3 py-2 rounded-md ${
              pathname === "/"
                ? "text-[#40E0D0] bg-[#40E0D0]/10 border border-[#40E0D0]/30"
                : "text-foreground/60 hover:bg-[#40E0D0]/5 hover:border border-transparent hover:border-[#40E0D0]/20"
            }`}
          >
            หน้าแรก
          </Link>
          <Link
            href="/discover"
            className={`text-sm font-medium transition-colors hover:text-[#40E0D0] px-3 py-2 rounded-md ${
              pathname === "/discover"
                ? "text-[#40E0D0] bg-[#40E0D0]/10 border border-[#40E0D0]/30"
                : "text-foreground/60 hover:bg-[#40E0D0]/5 hover:border border-transparent hover:border-[#40E0D0]/20"
            }`}
          >
            ค้นหา
          </Link>
          {user && (
            <>
              <Link
                href="/messages"
                className={`text-sm font-medium transition-colors hover:text-[#40E0D0] px-3 py-2 rounded-md ${
                  pathname.startsWith("/messages")
                    ? "text-[#40E0D0] bg-[#40E0D0]/10 border border-[#40E0D0]/30"
                    : "text-foreground/60 hover:bg-[#40E0D0]/5 hover:border border-transparent hover:border-[#40E0D0]/20"
                }`}
              >
                ข้อความ
              </Link>
              <Link
                href="/match"
                className={`text-sm font-medium transition-colors hover:text-[#40E0D0] px-3 py-2 rounded-md ${
                  pathname === "/match"
                    ? "text-[#40E0D0] bg-[#40E0D0]/10 border border-[#40E0D0]/30"
                    : "text-foreground/60 hover:bg-[#40E0D0]/5 hover:border border-transparent hover:border-[#40E0D0]/20"
                }`}
              >
                จับคู่
              </Link>
              <Link
                href="/my-pets"
                className={`text-sm font-medium transition-colors hover:text-[#40E0D0] px-3 py-2 rounded-md ${
                  pathname === "/my-pets"
                    ? "text-[#40E0D0] bg-[#40E0D0]/10 border border-[#40E0D0]/30"
                    : "text-foreground/60 hover:bg-[#40E0D0]/5 hover:border border-transparent hover:border-[#40E0D0]/20"
                }`}
              >
                สัตว์เลี้ยงของฉัน
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {!loading && !user ? (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="hover:text-[#40E0D0]">
                  เข้าสู่ระบบ
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-[#40E0D0] hover:bg-[#2CCAC0] text-white">
                  สมัครสมาชิก
                </Button>
              </Link>
            </div>
          ) : !loading && user ? (
            <>
              <Link href="/add-pet">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden md:flex border-[#FF6B6B] text-[#FF6B6B] hover:bg-[#FF6B6B] hover:text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  เพิ่มสัตว์เลี้ยง
                </Button>
              </Link>
              {/* เพิ่มปุ่มข้อความสำหรับมือถือ */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden relative"
                onClick={() => router.push("/messages")}
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              {/* เพิ่มคอมโพเนนต์ NotificationBell */}
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 p-0 border-2 border-[#40E0D0]">
                    <Avatar className="h-8 w-8">
                      {profile?.avatar_url ? (
                        <AvatarImage
                          src={profile.avatar_url || "/placeholder.svg"}
                          alt={profile?.username || user?.email || "User"}
                          onError={(e) => {
                            console.error("Avatar image failed to load:", profile.avatar_url)
                            e.target.onerror = null
                            e.target.src = "/placeholder.svg"
                          }}
                        />
                      ) : (
                        <AvatarImage src="/placeholder.svg" alt="Default avatar" />
                      )}
                      <AvatarFallback className="bg-[#FFA500] text-white">
                        {profile?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg rounded-md w-56 p-1"
                >
                  <DropdownMenuItem asChild>
                    <Link
                      href="/profile"
                      className={`flex items-center rounded-md w-full px-2 py-1.5 ${
                        pathname === "/profile" ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30" : ""
                      }`}
                    >
                      โปรไฟล์
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/notifications")}
                    className={`rounded-md ${
                      pathname === "/notifications" ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30" : ""
                    }`}
                  >
                    การแจ้งเตือน
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => router.push("/admin/notifications")}
                      className={`rounded-md ${
                        pathname === "/admin/notifications"
                          ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30"
                          : ""
                      }`}
                    >
                      จัดการการแจ้งเตือน
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    ออกจากระบบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg rounded-md w-56 p-1"
            >
              <DropdownMenuItem asChild>
                <Link
                  href="/"
                  className={`flex items-center rounded-md w-full px-2 py-1.5 ${
                    pathname === "/" ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30" : ""
                  }`}
                >
                  หน้าแรก
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/discover"
                  className={`flex items-center rounded-md w-full px-2 py-1.5 ${
                    pathname === "/discover" ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30" : ""
                  }`}
                >
                  ค้นหา
                </Link>
              </DropdownMenuItem>
              {user && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/messages"
                      className={`flex items-center rounded-md w-full px-2 py-1.5 ${
                        pathname.startsWith("/messages")
                          ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30"
                          : ""
                      }`}
                    >
                      ข้อความ
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/match"
                      className={`flex items-center rounded-md w-full px-2 py-1.5 ${
                        pathname === "/match" ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30" : ""
                      }`}
                    >
                      จับคู่
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/my-pets"
                      className={`flex items-center rounded-md w-full px-2 py-1.5 ${
                        pathname === "/my-pets" ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30" : ""
                      }`}
                    >
                      สัตว์เลี้ยงของฉัน
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/add-pet"
                      className={`flex items-center rounded-md w-full px-2 py-1.5 ${
                        pathname === "/add-pet" ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30" : ""
                      }`}
                    >
                      เพิ่มสัตว์เลี้ยง
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/notifications"
                      className={`flex items-center rounded-md w-full px-2 py-1.5 ${
                        pathname === "/notifications" ? "bg-[#40E0D0]/10 text-[#40E0D0] border border-[#40E0D0]/30" : ""
                      }`}
                    >
                      การแจ้งเตือน
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
