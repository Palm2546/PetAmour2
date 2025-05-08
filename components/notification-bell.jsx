"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "./supabase-provider"
import { Button } from "@/components/ui/button"
import { Bell, RefreshCw } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { cleanupDuplicateNotifications } from "@/utils/notification-utils"

export default function NotificationBell() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState(null)
  const realtimeChannelRef = useRef(null)

  // ฟังก์ชันสำหรับดึงข้อมูลการแจ้งเตือน
  const fetchNotifications = useCallback(
    async (showToast = false) => {
      if (!user) return

      try {
        setIsRefreshing(true)

        // ทำความสะอาดการแจ้งเตือนซ้ำซ้อนก่อน
        const cleanup = await cleanupDuplicateNotifications(supabase, user.id)
        console.log("ผลการทำความสะอาดการแจ้งเตือน:", cleanup)

        // ดึงข้อมูลการแจ้งเตือนล่าสุด 5 รายการ
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5)

        if (error) throw error

        // แสดงการแจ้งเตือนทั้งหมด
        setNotifications(data || [])

        // นับจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
        const unreadCount = data ? data.filter((notification) => !notification.is_read).length : 0
        setUnreadCount(unreadCount)

        // บันทึกเวลาที่ตรวจสอบล่าสุด
        setLastCheckTime(new Date().toISOString())

        // แสดงการแจ้งเตือนถ้ามีการร้องขอ
        if (showToast && data && data.length > 0 && data[0].is_read === false) {
          toast({
            title: "การแจ้งเตือนใหม่",
            description: getNotificationMessage(data[0]),
            variant: "default",
          })
        }
      } catch (error) {
        console.error("Error fetching notifications:", error)
        if (showToast) {
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถโหลดข้อมูลการแจ้งเตือนได้",
            variant: "destructive",
          })
        }
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [supabase, user, toast],
  )

  // ฟังก์ชันสำหรับตั้งค่า Realtime Subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!user) return null

    console.log("Setting up realtime subscription for notifications")

    // ยกเลิก subscription เดิมถ้ามี
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
    }

    // สร้าง subscription ใหม่
    const channel = supabase
      .channel(`notifications-${user.id}-${Date.now()}`) // เพิ่ม timestamp เพื่อให้แน่ใจว่าเป็น channel ใหม่
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("New notification received via realtime:", payload)

          // รีเฟรชข้อมูลการแจ้งเตือนทันที
          await fetchNotifications(true)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("Notification updated via realtime:", payload)

          // อัปเดตการแจ้งเตือนในหน้าจอ
          setNotifications((prev) =>
            prev.map((notification) => (notification.id === payload.new.id ? payload.new : notification)),
          )

          // อัปเดตจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
          const updatedNotifications = [...notifications]
          const index = updatedNotifications.findIndex((n) => n.id === payload.new.id)
          if (index !== -1) {
            updatedNotifications[index] = payload.new
          }
          const newUnreadCount = updatedNotifications.filter((n) => !n.is_read).length
          setUnreadCount(newUnreadCount)
        },
      )
      .subscribe((status) => {
        console.log("Realtime subscription status for notifications:", status)

        if (status !== "SUBSCRIBED") {
          // ถ้าไม่สามารถสมัครสมาชิกได้ ให้ลองอีกครั้งหลังจาก 3 วินาที
          setTimeout(() => {
            setupRealtimeSubscription()
          }, 3000)
        }
      })

    realtimeChannelRef.current = channel
    return channel
  }, [supabase, user, fetchNotifications, notifications])

  // ตั้งค่า Realtime Subscription เมื่อคอมโพเนนต์ถูกโหลด
  useEffect(() => {
    if (user) {
      const channel = setupRealtimeSubscription()

      return () => {
        if (channel) {
          console.log("Cleaning up realtime subscription for notifications")
          supabase.removeChannel(channel)
        }
      }
    }
  }, [supabase, user, setupRealtimeSubscription])

  // ดึงข้อมูลการแจ้งเตือนเมื่อคอมโพเนนต์ถูกโหลด
  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user, fetchNotifications])

  // ตรวจสอบการแจ้งเตือนใหม่เป็นระยะ
  useEffect(() => {
    if (!user) return

    // ตั้งค่า interval เพื่อตรวจสอบการแจ้งเตือนใหม่ทุก 15 วินาที
    const checkNewNotificationsInterval = setInterval(async () => {
      if (!lastCheckTime) return

      try {
        // ตรวจสอบว่ามีการแจ้งเตือนใหม่หรือไม่
        const { data, error } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .gt("created_at", lastCheckTime)
          .order("created_at", { ascending: false })
          .limit(1)

        if (error) throw error

        // ถ้ามีการแจ้งเตือนใหม่ ให้โหลดข้อมูลการแจ้งเตือนทั้งหมดใหม่
        if (data && data.length > 0) {
          console.log("New notifications detected, refreshing...")
          fetchNotifications(true)
        }
      } catch (error) {
        console.error("Error checking for new notifications:", error)
      }
    }, 15000) // ตรวจสอบทุก 15 วินาที

    return () => clearInterval(checkNewNotificationsInterval)
  }, [user, lastCheckTime, supabase, fetchNotifications])

  // ฟังก์ชันสำหรับทำเครื่องหมายว่าอ่านการแจ้งเตือนแล้ว
  const markAsRead = async () => {
    if (!user || unreadCount === 0) return

    try {
      setIsRefreshing(true)

      // อัปเดตสถานะการอ่านของการแจ้งเตือนทั้งหมด
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)

      if (error) throw error

      // อัปเดตสถานะการแจ้งเตือนในหน้าจอ
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))
      setUnreadCount(0)

      toast({
        title: "อ่านการแจ้งเตือนแล้ว",
        description: "ทำเครื่องหมายว่าอ่านการแจ้งเตือนทั้งหมดแล้ว",
        variant: "default",
      })
    } catch (error) {
      console.error("Error marking notifications as read:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถทำเครื่องหมายว่าอ่านการแจ้งเตือนได้",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // ปรับปรุงฟังก์ชัน handleNotificationClick เพื่อให้นำทางไปยังหน้าข้อความของผู้ส่งโดยตรง
  const handleNotificationClick = async (notification) => {
    try {
      setIsOpen(false)

      // อัปเดตสถานะการอ่านการแจ้งเตือน
      if (!notification.is_read) {
        const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id)

        if (error) {
          console.error("Error marking notification as read:", error)
        } else {
          // อัปเดตสถานะการอ่านในสถานะของคอมโพเนนต์
          setNotifications(notifications.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)))

          // อัปเดตจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
      }

      // ตรวจสอบประเภทการแจ้งเตือนและนำทางไปยังหน้าที่เกี่ยวข้อง
      if (notification.type === "message") {
        let conversationId = null

        // ตรวจสอบ data.conversation_id ก่อน reference_id
        if (notification.data && notification.data.conversation_id) {
          conversationId = notification.data.conversation_id
        }
        // ตรวจสอบ reference_id
        else if (notification.reference_id) {
          conversationId = notification.reference_id
        }

        if (conversationId) {
          console.log("นำทางไปยังการสนทนา:", conversationId)
          router.push(`/messages/${conversationId}`)
          return
        } else {
          console.log("ไม่พบ ID การสนทนาในการแจ้งเตือน")
          router.push("/messages")
        }
      } else if (notification.type === "match") {
        // For match notifications, navigate to the sender's profile page
        if (notification.sender_id) {
          // Get the username of the sender for the URL
          try {
            const { data: senderProfile, error: profileError } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", notification.sender_id)
              .single()

            if (!profileError && senderProfile) {
              console.log("Navigating to user profile:", senderProfile.username)
              router.push(`/users/${senderProfile.username}`)
              return
            }
          } catch (profileError) {
            console.error("Error fetching sender profile:", profileError)
          }

          // Fallback to match page if username lookup fails
          router.push("/match")
        } else {
          router.push("/match")
        }
      } else if (notification.type === "interest") {
        // สำหรับการแจ้งเตือนประเภทความสนใจ
        if (notification.reference_id) {
          router.push(`/pets/${notification.reference_id}`)
        } else {
          router.push("/discover")
        }
      } else {
        // สำหรับการแจ้งเตือนประเภทอื่นๆ
        router.push("/notifications")
      }
    } catch (error) {
      console.error("Error handling notification click:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถดำเนินการได้ โปรดลองอีกครั้งในภายหลัง",
        variant: "destructive",
      })
      router.push("/notifications")
    }
  }

  // ฟังก์ชันสำหรับรีเฟรชการแจ้งเตือน
  const handleRefreshNotifications = () => {
    fetchNotifications()
  }

  // ฟังก์ชันสำหรับแสดงข้อความการแจ้งเตือน
  const getNotificationMessage = (notification) => {
    switch (notification.type) {
      case "match":
        return "คุณได้จับคู่กับสัตว์เลี้ยงใหม่!"
      case "message":
        return "คุณมีข้อความใหม่"
      case "interest":
        return "มีคนสนใจสัตว์เลี้ยงของคุณ"
      default:
        return "คุณมีการแจ้งเตือนใหม่"
    }
  }

  // ฟังก์ชันสำหรับแสดงเวลาของการแจ้งเตือน
  const getNotificationTime = (createdAt) => {
    const date = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffMinutes = Math.floor(diffTime / (1000 * 60))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffMinutes < 60) {
      return `${diffMinutes} นาทีที่แล้ว`
    } else if (diffHours < 24) {
      return `${diffHours} ชั่วโมงที่แล้ว`
    } else if (diffDays < 7) {
      return `${diffDays} วันที่แล้ว`
    } else {
      return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })
    }
  }

  if (!user) return null

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-[#FF6B6B] text-white text-xs min-w-[1.2rem] flex items-center justify-center"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-lg"
      >
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-medium">การแจ้งเตือน</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 flex items-center gap-1"
              onClick={handleRefreshNotifications}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
              รีเฟรช
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={markAsRead}
                disabled={isRefreshing}
              >
                ทำเครื่องหมายว่าอ่านแล้ว
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">กำลังโหลด...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">ไม่มีการแจ้งเตือน</div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`px-4 py-3 cursor-pointer ${notification.is_read ? "" : "bg-[#40E0D0]/20"}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2 w-full">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      notification.is_read ? "bg-gray-300" : "bg-[#FF6B6B]"
                    }`}
                  ></div>
                  <div className="flex-1">
                    <p className={`text-sm ${notification.is_read ? "text-gray-700" : "font-medium"}`}>
                      {getNotificationMessage(notification)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{getNotificationTime(notification.created_at)}</p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[#40E0D0] hover:text-[#2CCAC0] hover:bg-[#40E0D0]/20 bg-white dark:bg-gray-950"
            onClick={() => router.push("/notifications")}
          >
            ดูการแจ้งเตือนทั้งหมด
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
