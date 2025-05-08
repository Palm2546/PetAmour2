"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDistanceToNow } from "date-fns"
import { th } from "date-fns/locale"
import { Bell, CheckCheck, RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { cleanupDuplicateNotifications } from "@/utils/notification-utils"

export default function NotificationsPage() {
  const router = useRouter()
  const { supabase, user, loading } = useSupabase()
  const [notifications, setNotifications] = useState([])
  const [profiles, setProfiles] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [lastCheckTime, setLastCheckTime] = useState(null)
  const realtimeChannelRef = useRef(null)

  // ฟังก์ชันสำหรับดึงข้อมูลการแจ้งเตือน
  const fetchNotifications = useCallback(
    async (showToast = false) => {
      if (loading) return
      if (!user) {
        router.push("/login")
        return
      }

      try {
        setIsRefreshing(true)

        // ทำความสะอาดการแจ้งเตือนซ้ำซ้อนก่อน
        const cleanup = await cleanupDuplicateNotifications(supabase, user.id)
        console.log("ผลการทำความสะอาดการแจ้งเตือน:", cleanup)

        // ดึงการแจ้งเตือนทั้งหมด
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error

        // แสดงการแจ้งเตือนทั้งหมด
        setNotifications(data || [])

        // ดึงข้อมูลโปรไฟล์ของผู้ส่งการแจ้งเตือน
        const senderIds = data
          .filter((notification) => notification.sender_id)
          .map((notification) => notification.sender_id)

        if (senderIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", senderIds)

          if (!profilesError && profilesData) {
            const profilesMap = {}
            profilesData.forEach((profile) => {
              profilesMap[profile.id] = profile
            })
            setProfiles(profilesMap)
          }
        }

        // บันทึกเวลาที่ตรวจสอบล่าสุด
        setLastCheckTime(new Date().toISOString())

        // แสดงการแจ้งเตือนถ้ามีการร้องขอและมีการแจ้งเตือนใหม่
        if (showToast && data && data.length > 0 && data.some((n) => !n.is_read)) {
          toast({
            title: "โหลดการแจ้งเตือนสำเร็จ",
            description: `พบการแจ้งเตือนที่ยังไม่ได้อ่าน ${data.filter((n) => !n.is_read).length} รายการ`,
            variant: "default",
          })
        }
      } catch (error) {
        console.error("Error fetching notifications:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลการแจ้งเตือนได้",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [supabase, user, loading, router],
  )

  // ฟังก์ชันสำหรับตั้งค่า Realtime Subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!user) return null

    console.log("Setting up realtime subscription for notifications page")

    // ยกเลิก subscription เดิมถ้ามี
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
    }

    // สร้าง subscription ใหม่
    const channel = supabase
      .channel(`notifications-page-${user.id}-${Date.now()}`) // เพิ่ม timestamp เพื่อให้แน่ใจว่าเป็น channel ใหม่
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
        },
      )
      .subscribe((status) => {
        console.log("Realtime subscription status for notifications page:", status)

        if (status !== "SUBSCRIBED") {
          // ถ้าไม่สามารถสมัครสมาชิกได้ ให้ลองอีกครั้งหลังจาก 3 วินาที
          setTimeout(() => {
            setupRealtimeSubscription()
          }, 3000)
        }
      })

    realtimeChannelRef.current = channel
    return channel
  }, [supabase, user, fetchNotifications])

  // ตั้งค่า Realtime Subscription เมื่อคอมโพเนนต์ถูกโหลด
  useEffect(() => {
    if (user && !loading) {
      const channel = setupRealtimeSubscription()

      return () => {
        if (channel) {
          console.log("Cleaning up realtime subscription for notifications page")
          supabase.removeChannel(channel)
        }
      }
    }
  }, [supabase, user, loading, setupRealtimeSubscription])

  // ดึงข้อมูลการแจ้งเตือนเมื่อคอมโพเนนต์ถูกโหลด
  useEffect(() => {
    if (user && !loading) {
      fetchNotifications()
    }
  }, [user, loading, fetchNotifications])

  // ตรวจสอบการแจ้งเตือนใหม่เป็นระยะ
  useEffect(() => {
    if (!user || loading) return

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
  }, [user, loading, lastCheckTime, supabase, fetchNotifications])

  // ฟังก์ชันสำหรับการอัพเดทสถานะการอ่านการแจ้งเตือน
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId)

      if (error) throw error

      // อัพเดทสถานะการอ่านในรายการการแจ้งเตือน
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, is_read: true } : notification,
        ),
      )
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  // ฟังก์ชันสำหรับการอัพเดทสถานะการอ่านการแจ้งเตือนทั้งหมด
  const markAllAsRead = async () => {
    try {
      setIsRefreshing(true)
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)

      if (error) throw error

      // อัพเดทสถานะการอ่านในรายการการแจ้งเตือน
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))

      toast({
        title: "อ่านการแจ้งเตือนแล้ว",
        description: "ทำเครื่องหมายว่าอ่านการแจ้งเตือนทั้งหมดแล้ว",
        variant: "default",
      })
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถทำเครื่องหมายว่าอ่านการแจ้งเตือนได้",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // ฟังก์ชันสำหรับรีเฟรชการแจ้งเตือน
  const handleRefreshNotifications = () => {
    fetchNotifications(true)
  }

  // ฟังก์ชันสำหรับการนำทางไปยังหน้าที่เกี่ยวข้องกับการแจ้งเตือน
  const handleNotificationClick = async (notification) => {
    try {
      // อัปเดตสถานะการอ่านการแจ้งเตือน
      if (!notification.is_read) {
        const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id)

        if (error) {
          console.error("Error marking notification as read:", error)
        } else {
          // อัปเดตสถานะการอ่านในสถานะของคอมโพเนนต์
          setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)))
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
    }
  }

  // ฟังก์ชันสำหรับการแสดงข้อความการแจ้งเตือน
  const renderNotificationContent = (notification) => {
    const senderProfile = notification.sender_id ? profiles[notification.sender_id] : null
    const senderName = senderProfile ? senderProfile.username : "ผู้ใช้"

    switch (notification.type) {
      case "match":
        return `คุณได้จับคู่กับ ${senderName} แล้ว!`
      case "message":
        return `คุณมีข้อความใหม่`
      case "interest":
        return `${senderName} สนใจสัตว์เลี้ยงของคุณ`
      default:
        return notification.content
    }
  }

  // กรองการแจ้งเตือนตาม tab ที่เลือก
  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === "all") return true
    if (activeTab === "unread") return !notification.is_read
    if (activeTab === "match") return notification.type === "match"
    if (activeTab === "message") return notification.type === "message"
    if (activeTab === "interest") return notification.type === "interest"
    return true
  })

  if (loading || isLoading) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              <Skeleton className="h-8 w-40" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-6" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>กรุณาเข้าสู่ระบบ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">คุณต้องเข้าสู่ระบบเพื่อดูการแจ้งเตือน</p>
            <Button onClick={() => router.push("/login")}>เข้าสู่ระบบ</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            การแจ้งเตือน
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshNotifications}
              disabled={isRefreshing}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              รีเฟรช
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              disabled={!notifications.some((n) => !n.is_read) || isRefreshing}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              อ่านทั้งหมด
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid grid-cols-5">
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="unread">ยังไม่ได้อ่าน</TabsTrigger>
              <TabsTrigger value="match">การจับคู่</TabsTrigger>
              <TabsTrigger value="message">ข้อความ</TabsTrigger>
              <TabsTrigger value="interest">ความสนใจ</TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">ไม่มีการแจ้งเตือน</h3>
              <p className="text-gray-500">
                {activeTab === "all"
                  ? "คุณยังไม่มีการแจ้งเตือนใดๆ"
                  : activeTab === "unread"
                    ? "คุณไม่มีการแจ้งเตือนที่ยังไม่ได้อ่าน"
                    : `คุณไม่มีการแจ้งเตือนประเภท ${activeTab}`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    !notification.is_read ? "bg-gray-50 border-gray-200" : "border-gray-100"
                  } cursor-pointer transition-all hover:shadow-sm`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      {notification.sender_id && profiles[notification.sender_id]?.avatar_url ? (
                        <AvatarImage
                          src={profiles[notification.sender_id].avatar_url || "/placeholder.svg"}
                          alt={profiles[notification.sender_id].username}
                        />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-[#40E0D0] to-[#20B2AA] text-white">
                          {notification.sender_id && profiles[notification.sender_id]
                            ? profiles[notification.sender_id].username.charAt(0).toUpperCase()
                            : "N"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{renderNotificationContent(notification)}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: th,
                        })}
                      </p>
                    </div>
                    {!notification.is_read && <div className="h-3 w-3 rounded-full bg-blue-500"></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
