"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Send, ArrowLeft, MessageCircle, ImageIcon, X, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"
import { v4 as uuidv4 } from "uuid"

export default function Conversation() {
  const params = useParams()
  const router = useRouter()
  const { supabase, user, loading } = useSupabase()
  const { toast } = useToast()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [otherUser, setOtherUser] = useState(null)
  const messagesEndRef = useRef(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [conversationNotFound, setConversationNotFound] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastMessageTime, setLastMessageTime] = useState(null)
  const realtimeChannelRef = useRef(null)

  // ฟังก์ชันสำหรับดึงข้อมูลข้อความ - แยกออกมาเพื่อให้สามารถเรียกใช้ซ้ำได้
  const fetchMessages = useCallback(async () => {
    if (!params.id || !user) return

    try {
      setIsRefreshing(true)

      // ดึงข้อมูลข้อความ
      const { data: messagesData, error: messagesError } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", params.id)
        .order("created_at", { ascending: true })

      if (messagesError) throw messagesError

      if (!messagesData || messagesData.length === 0) {
        // ไม่มีข้อความในการสนทนานี้ แต่การสนทนายังคงมีอยู่
        setMessages([])
        setIsRefreshing(false)
        return
      }

      // ดึงข้อมูลผู้ส่งทั้งหมด
      const senderIds = [...new Set(messagesData.map((msg) => msg.sender_id))]
      const { data: sendersData, error: sendersError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", senderIds)

      if (sendersError) throw sendersError

      // สร้าง map ของข้อมูลผู้ส่ง
      const sendersMap = {}
      sendersData.forEach((sender) => {
        sendersMap[sender.id] = sender
      })

      // รวมข้อมูลข้อความและผู้ส่งเข้าด้วยกัน
      const messagesWithSenders = messagesData.map((message) => ({
        ...message,
        sender: sendersMap[message.sender_id] || null,
      }))

      setMessages(messagesWithSenders || [])

      // บันทึกเวลาของข้อความล่าสุด
      if (messagesWithSenders.length > 0) {
        const latestMessage = messagesWithSenders[messagesWithSenders.length - 1]
        setLastMessageTime(latestMessage.created_at)
      }

      // ทำเครื่องหมายว่าอ่านข้อความแล้ว
      try {
        const { error: updateError } = await supabase
          .from("direct_messages")
          .update({ is_read: true })
          .eq("conversation_id", params.id)
          .neq("sender_id", user.id)
          .eq("is_read", false)

        if (updateError) {
          console.error("Error updating read status:", updateError)
        }
      } catch (error) {
        console.error("Error marking messages as read:", error)
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อความได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)

      // เลื่อนไปที่ข้อความล่าสุด
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }
  }, [supabase, params.id, user, toast])

  // ฟังก์ชันสำหรับดึงข้อมูลการสนทนา
  const fetchConversation = useCallback(async () => {
    if (loading) return

    if (!user) {
      router.push("/login")
      return
    }

    try {
      setIsLoading(true)

      // 1. ดึงข้อมูลการสนทนา
      const { data: conversationData, error: conversationError } = await supabase
        .from("direct_conversations")
        .select(`
          id,
          user1_id, user2_id,
          updated_at
        `)
        .eq("id", params.id)

      // ตรวจสอบว่ามีข้อผิดพลาดหรือไม่
      if (conversationError) throw conversationError

      // ตรวจสอบว่ามีข้อมูลหรือไม่
      if (!conversationData || conversationData.length === 0) {
        console.log("Conversation not found:", params.id)
        setConversationNotFound(true)
        setIsLoading(false)
        return
      }

      // ใช้ข้อมูลแถวแรก
      const conversation = conversationData[0]

      // 2. ตรวจสอบว่าผู้ใช้เป็นส่วนหนึ่งของการสนทนานี้หรือไม่
      if (conversation.user1_id !== user.id && conversation.user2_id !== user.id) {
        toast({
          title: "ไม่มีสิทธิ์เข้าถึง",
          description: "คุณไม่มีสิทธิ์เข้าถึงการสนทนานี้",
          variant: "destructive",
        })
        router.push("/messages")
        return
      }

      // 3. ดึงข้อมูลผู้ใช้อีกฝ่าย
      const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id
      const { data: otherUserData, error: otherUserError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", otherUserId)
        .single()

      if (otherUserError) {
        console.error("Error fetching other user:", otherUserError)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
          variant: "destructive",
        })
        router.push("/messages")
        return
      }

      // 4. รวมข้อมูลเข้าด้วยกัน
      const conversationWithProfiles = {
        ...conversation,
        other_user: otherUserData,
      }

      setConversation(conversationWithProfiles)
      setOtherUser(otherUserData)

      // 5. ดึงข้อมูลข้อความ
      await fetchMessages()
    } catch (error) {
      console.error("Error fetching conversation:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลการสนทนาได้",
        variant: "destructive",
      })
      router.push("/messages")
    } finally {
      setIsLoading(false)
    }
  }, [supabase, params.id, user, loading, router, toast, fetchMessages])

  // ตั้งค่า Realtime Subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!user || !params.id) return null

    console.log("Setting up realtime subscription for conversation:", params.id)

    // ยกเลิก subscription เดิมถ้ามี
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
    }

    // สร้าง subscription ใหม่
    const channel = supabase
      .channel(`messages-${params.id}-${Date.now()}`) // เพิ่ม timestamp เพื่อให้แน่ใจว่าเป็น channel ใหม่
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${params.id}`,
        },
        async (payload) => {
          console.log("New message received via realtime:", payload)

          try {
            // ตรวจสอบว่าข้อความนี้มีอยู่ในรายการข้อความแล้วหรือไม่
            const messageExists = messages.some((msg) => msg.id === payload.new.id)

            if (messageExists) {
              console.log("Message already exists in state, skipping update")
              return
            }

            // ดึงข้อมูลผู้ส่ง
            const { data: sender, error: senderError } = await supabase
              .from("profiles")
              .select("id, username, avatar_url")
              .eq("id", payload.new.sender_id)
              .single()

            if (senderError) throw senderError

            // สร้างข้อความใหม่พร้อมข้อมูลผู้ส่ง
            const newMessage = {
              ...payload.new,
              sender: sender || {
                id: payload.new.sender_id,
                username: "User",
                avatar_url: null,
              },
            }

            // อัปเดต state
            setMessages((prev) => [...prev, newMessage])
            setLastMessageTime(payload.new.created_at)

            // ทำเครื่องหมายว่าอ่านแล้วถ้าผู้ใช้ปัจจุบันไม่ใช่ผู้ส่ง
            if (payload.new.sender_id !== user.id) {
              await supabase.from("direct_messages").update({ is_read: true }).eq("id", payload.new.id)
            }

            // เลื่อนไปที่ข้อความล่าสุด
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
            }, 100)
          } catch (error) {
            console.error("Error processing new message from realtime:", error)
          }
        },
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status)

        if (status !== "SUBSCRIBED") {
          // ถ้าไม่สามารถสมัครสมาชิกได้ ให้ลองอีกครั้งหลังจาก 3 วินาที
          setTimeout(() => {
            setupRealtimeSubscription()
          }, 3000)
        }
      })

    realtimeChannelRef.current = channel
    return channel
  }, [supabase, params.id, user, messages])

  // ตั้งค่า Realtime Subscription เมื่อคอมโพเนนต์ถูกโหลด
  useEffect(() => {
    if (user && params.id && !isLoading) {
      const channel = setupRealtimeSubscription()

      return () => {
        if (channel) {
          console.log("Cleaning up realtime subscription")
          supabase.removeChannel(channel)
        }
      }
    }
  }, [supabase, params.id, user, isLoading, setupRealtimeSubscription])

  // โหลดข้อมูลการสนทนาเมื่อคอมโพเนนต์ถูกโหลด
  useEffect(() => {
    fetchConversation()
  }, [fetchConversation])

  // ตรวจสอบข้อความใหม่เป็นระยะ
  useEffect(() => {
    // ตั้งค่า interval เพื่อตรวจสอบข้อความใหม่ทุก 10 วินาที
    const checkNewMessagesInterval = setInterval(async () => {
      if (!user || !params.id || !lastMessageTime) return

      try {
        // ตรวจสอบว่ามีข้อความใหม่หรือไม่
        const { data, error } = await supabase
          .from("direct_messages")
          .select("id")
          .eq("conversation_id", params.id)
          .gt("created_at", lastMessageTime)
          .order("created_at", { ascending: false })
          .limit(1)

        if (error) throw error

        // ถ้ามีข้อความใหม่ ให้โหลดข้อความทั้งหมดใหม่
        if (data && data.length > 0) {
          console.log("New messages detected, refreshing...")
          fetchMessages()
        }
      } catch (error) {
        console.error("Error checking for new messages:", error)
      }
    }, 10000) // ตรวจสอบทุก 10 วินาที

    return () => clearInterval(checkNewMessagesInterval)
  }, [user, params.id, lastMessageTime, supabase, fetchMessages])

  // เลื่อนไปที่ข้อความล่าสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }
  }, [messages])

  // ฟังก์ชันสำหรับการพิมพ์ข้อความ
  const handleInputChange = (e) => {
    setMessageText(e.target.value)
  }

  // ฟังก์ชันสำหรับการเลือกรูปภาพ
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // ตรวจสอบประเภทไฟล์
    if (!file.type.startsWith("image/")) {
      toast({
        title: "ไฟล์ไม่ถูกต้อง",
        description: "กรุณาเลือกไฟล์รูปภาพเท่านั้น",
        variant: "destructive",
      })
      return
    }

    // ตรวจสอบขนาดไฟล์ (จำกัดที่ 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "ไฟล์ใหญ่เกินไป",
        description: "กรุณาเลือกไฟล์ขนาดไม่เกิน 5MB",
        variant: "destructive",
      })
      return
    }

    setSelectedImage(file)

    // สร้าง preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // ฟังก์ชันสำหรับการยกเลิกการเลือกรูปภาพ
  const handleCancelImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // ฟังก์ชันสำหรับการอัปโหลดรูปภาพไปยัง Supabase Storage
  const uploadImage = async (file) => {
    const fileExt = file.name.split(".").pop()
    const fileName = `${uuidv4()}.${fileExt}`
    const filePath = `message_images/${params.id}/${fileName}`

    const { data, error } = await supabase.storage.from("chat_images").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) throw error

    // สร้าง public URL
    const { data: publicUrlData } = supabase.storage.from("chat_images").getPublicUrl(filePath)

    return publicUrlData.publicUrl
  }

  // ปรับปรุงฟังก์ชัน handleSendMessage
  const handleSendMessage = async (e) => {
    e.preventDefault()

    if (!messageText.trim() && !selectedImage) return

    setIsSending(true)
    let imageUrl = null
    let messageContent = ""
    const tempId = `temp-${Date.now()}`

    try {
      // อัปโหลดรูปภาพก่อน (ถ้ามี)
      if (selectedImage) {
        setIsUploading(true)
        imageUrl = await uploadImage(selectedImage)
      }

      // 1. สร้างข้อมูลข้อความใหม่สำหรับ Optimistic UI Update
      const optimisticMessage = {
        id: tempId,
        conversation_id: params.id,
        sender_id: user.id,
        content: messageText.trim(),
        image_url: imageUrl,
        is_read: false,
        created_at: new Date().toISOString(),
        sender: {
          id: user.id,
          username: user.user_metadata?.username || user.email?.split("@")[0],
          avatar_url: user.user_metadata?.avatar_url || null,
        },
        _status: "sending", // เพิ่มสถานะสำหรับ UI
      }

      // 2. อัปเดต UI ทันที (Optimistic Update)
      setMessages((prev) => [...prev, optimisticMessage])

      // 3. เก็บข้อความไว้และล้างฟอร์ม
      messageContent = messageText.trim()
      setMessageText("")
      setSelectedImage(null)
      setImagePreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      // 4. เลื่อนไปที่ข้อความล่าสุด
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)

      // 5. บันทึกข้อความลงในฐานข้อมูล
      const { data: messageData, error: messageError } = await supabase
        .from("direct_messages")
        .insert({
          conversation_id: params.id,
          sender_id: user.id,
          content: messageContent,
          image_url: imageUrl,
          is_read: false,
        })
        .select("*")
        .single()

      if (messageError) throw messageError

      // 6. อัปเดตเวลาล่าสุดของการสนทนา
      const { error: conversationError } = await supabase
        .from("direct_conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)

      if (conversationError) throw conversationError

      // 7. สร้างการแจ้งเตือนสำหรับผู้รับข้อความ
      try {
        // ดึงข้อมูลการสนทนาเพื่อหา user_id ของผู้รับ
        const { data: conversationsData, error: fetchConversationError } = await supabase
          .from("direct_conversations")
          .select("user1_id, user2_id")
          .eq("id", params.id)

        if (fetchConversationError) {
          console.error("Error fetching conversation:", fetchConversationError)
        } else if (!conversationsData || conversationsData.length === 0) {
          console.error("Conversation not found:", params.id)
        } else {
          // ใช้ข้อมูลการสนทนาแรกที่พบ
          const conversationData = conversationsData[0]

          // หา user_id ของผู้รับ
          const recipientId =
            conversationData.user1_id === user.id ? conversationData.user2_id : conversationData.user1_id

          // นำเข้าฟังก์ชัน createMessageNotification
          const { createMessageNotification } = await import("@/utils/notification-utils")

          // สร้างการแจ้งเตือนข้อความใหม่
          await createMessageNotification(supabase, recipientId, user.id, params.id, messageContent)
        }
      } catch (notificationError) {
        console.error("Error creating notification:", notificationError)
      }

      // 8. อัปเดต UI ด้วยข้อมูลจริงจากฐานข้อมูล
      setMessages((prev) => {
        // ลบข้อความชั่วคราว
        const filtered = prev.filter((msg) => msg.id !== tempId)

        // เพิ่มข้อความจริง
        return [
          ...filtered,
          {
            ...messageData,
            sender: {
              id: user.id,
              username: user.user_metadata?.username || user.email?.split("@")[0],
              avatar_url: user.user_metadata?.avatar_url || null,
            },
            _status: "sent",
          },
        ]
      })

      // อัปเดตเวลาของข้อความล่าสุด
      setLastMessageTime(messageData.created_at)

      console.log("Message sent successfully:", messageData)

      // แสดงการแจ้งเตือนว่าส่งข้อความสำเร็จ
      toast({
        title: "ส่งข้อความสำเร็จ",
        description: "ข้อความของคุณถูกส่งเรียบร้อยแล้ว",
        variant: "default",
      })
    } catch (error) {
      console.error("Error sending message:", error)

      // อัปเดตสถานะข้อความที่ส่งไม่สำเร็จ
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? { ...msg, _status: "error" } : msg)))

      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถส่งข้อความได้ โปรดลองอีกครั้ง",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
      setIsUploading(false)
    }
  }

  // ฟังก์ชันสำหรับรีเฟรชข้อความ
  const handleRefreshMessages = () => {
    fetchMessages()
  }

  if (loading || isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.push("/messages")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-8 w-60 bg-gray-200" />
        </div>
        <Card className="shadow-md border-gray-200">
          <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center">
              <Skeleton className="h-12 w-12 rounded-full mr-3 bg-gray-200" />
              <Skeleton className="h-6 w-40 bg-gray-200" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col h-[65vh]">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <div className={`flex gap-2 max-w-[80%] ${i % 2 === 0 ? "flex-row" : "flex-row-reverse"}`}>
                      {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 bg-gray-200" />}
                      <div>
                        <Skeleton className={`h-16 w-48 rounded-2xl bg-gray-200`} />
                        <div className="flex justify-end mt-1">
                          <Skeleton className="h-3 w-16 bg-gray-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-4 flex gap-2 bg-white">
                <Skeleton className="h-10 flex-1 bg-gray-200" />
                <Skeleton className="h-10 w-10 bg-gray-200" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container py-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <h2 className="text-xl font-semibold">กรุณาเข้าสู่ระบบ</h2>
          </CardHeader>
          <CardContent>
            <p className="mb-4">คุณต้องเข้าสู่ระบบเพื่อดูข้อความ</p>
            <Button onClick={() => router.push("/login")} className="w-full bg-pink-600 hover:bg-pink-700">
              เข้าสู่ระบบ
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (conversationNotFound) {
    return (
      <div className="container py-8">
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">ไม่พบการสนทนา</h2>
          <p className="text-gray-500 mb-6">ไม่พบข้อมูลการสนทนาที่คุณกำลังค้นหา</p>
          <Button className="bg-pink-600 hover:bg-pink-700" onClick={() => router.push("/messages")}>
            กลับไปหน้าข้อความ
          </Button>
        </div>
      </div>
    )
  }

  if (!conversation || !otherUser) {
    return (
      <div className="container py-8">
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">ไม่พบการสนทนา</h2>
          <p className="text-gray-500 mb-6">ไม่พบข้อมูลการสนทนาที่คุณกำลังค้นหา</p>
          <Button className="bg-pink-600 hover:bg-pink-700" onClick={() => router.push("/messages")}>
            กลับไปหน้าข้อความ
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden hover:bg-pink-50 hover:text-pink-600 transition-all duration-300"
          onClick={() => router.push("/messages")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          การสนทนากับ {otherUser.username}
        </h1>
      </div>

      <Card className="shadow-md border-gray-200 overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-4 p-4 border-b bg-gradient-to-r from-gray-50 to-white">
          <div className="relative">
            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
              {otherUser.avatar_url ? (
                <AvatarImage
                  src={otherUser.avatar_url || "/placeholder.svg"}
                  alt={otherUser.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                  {otherUser.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
          </div>
          <div>
            <h2 className="font-semibold text-lg">{otherUser.username}</h2>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-pink-200 hover:bg-pink-50 hover:text-pink-600 transition-all duration-300"
              onClick={handleRefreshMessages}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              รีเฟรช
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-pink-200 hover:bg-pink-50 hover:text-pink-600 transition-all duration-300"
              onClick={() => router.push("/messages")}
            >
              กลับไปหน้าข้อความ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col h-[65vh]">
            <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-dashed border-gray-200 dark:border-gray-700">
                    <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-600 dark:text-gray-300">ยังไม่มีข้อความ เริ่มต้นสนทนากันเลย!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === user.id ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex gap-2 max-w-[80%] ${message.sender_id === user.id ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {message.sender_id !== user.id && (
                          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                            {message.sender?.avatar_url ? (
                              <AvatarImage
                                src={message.sender.avatar_url || "/placeholder.svg"}
                                alt={message.sender?.username || "User"}
                              />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                                {message.sender?.username?.charAt(0).toUpperCase() || "U"}
                              </AvatarFallback>
                            )}
                          </Avatar>
                        )}
                        <div>
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              message.sender_id === user.id
                                ? message._status === "error"
                                  ? "bg-red-100 text-red-800 border border-red-300"
                                  : message._status === "sending"
                                    ? "bg-gradient-to-r from-gray-300 to-gray-400 text-white opacity-70"
                                    : "bg-gradient-to-r from-pink-500 to-pink-600 text-white"
                                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                            } shadow-sm transition-all duration-200 hover:shadow-md`}
                          >
                            {message.image_url && (
                              <div className="mb-2">
                                <div className="relative rounded-lg overflow-hidden">
                                  <Image
                                    src={message.image_url || "/placeholder.svg"}
                                    alt="Shared image"
                                    width={300}
                                    height={200}
                                    className="object-contain max-h-[300px] w-auto rounded-lg"
                                    style={{ maxWidth: "100%" }}
                                  />
                                </div>
                              </div>
                            )}
                            {message.content && <p>{message.content}</p>}
                            {message._status === "sending" && (
                              <div className="text-xs text-gray-100 mt-1 italic">กำลังส่ง...</div>
                            )}
                            {message._status === "error" && (
                              <div className="text-xs text-red-600 mt-1 italic">ส่งไม่สำเร็จ - ลองอีกครั้ง</div>
                            )}
                          </div>
                          <div
                            className={`flex items-center mt-1 gap-1 ${message.sender_id === user.id ? "justify-end" : "justify-start"}`}
                          >
                            <p className="text-xs text-gray-500">
                              {new Date(message.created_at).toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            {message.sender_id === user.id &&
                              message._status !== "error" &&
                              message._status !== "sending" && (
                                <span className="text-xs text-gray-500">{message.is_read ? "• อ่านแล้ว" : ""}</span>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="border-t p-4 bg-white dark:bg-gray-900">
              {imagePreview && (
                <div className="mb-3 relative">
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 inline-block">
                    <img
                      src={imagePreview || "/placeholder.svg"}
                      alt="Selected image"
                      className="max-h-[150px] w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleCancelImage}
                      className="absolute top-1 right-1 bg-gray-800 bg-opacity-70 rounded-full p-1 text-white hover:bg-opacity-100 transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                    id="image-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-gray-200 hover:bg-pink-50 hover:text-pink-600 transition-all duration-300"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || isUploading}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  placeholder="พิมพ์ข้อความ..."
                  value={messageText}
                  onChange={handleInputChange}
                  disabled={isSending || isUploading}
                  className="transition-all duration-300 focus-visible:ring-pink-300 border-gray-200 focus:border-pink-300"
                />
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 transition-all duration-300 shadow-sm"
                  disabled={isSending || isUploading || (!messageText.trim() && !selectedImage)}
                >
                  {isUploading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className={`h-4 w-4 ${isSending ? "animate-pulse" : ""}`} />
                  )}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
