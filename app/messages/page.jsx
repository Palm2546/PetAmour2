"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Search, MessageCircle, Bell, Heart } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function Messages() {
  const router = useRouter()
  const { supabase, user, loading } = useSupabase()
  const { toast } = useToast()
  const [conversations, setConversations] = useState([])
  const [matches, setMatches] = useState([])
  const [newMatches, setNewMatches] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [clickedConversations, setClickedConversations] = useState({})
  const [onlineUsers, setOnlineUsers] = useState({})
  const [activeTab, setActiveTab] = useState("conversations")
  const [lastFetchTime, setLastFetchTime] = useState(null)

  const fetchConversations = async () => {
    if (loading) return

    if (!user) {
      router.push("/login")
      return
    }

    try {
      setIsLoading(true)
      const currentTime = new Date().toISOString()

      // 1. ดึงข้อมูลการสนทนาทั้งหมดที่เกี่ยวข้องกับผู้ใช้ปัจจุบัน
      const { data: conversationsData, error: conversationsError } = await supabase
        .from("direct_conversations")
        .select(`
          id,
          user1_id, user2_id,
          updated_at
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(20) // จำกัดจำนวนการสนทนาที่ดึงมา

      if (conversationsError) throw conversationsError

      // 2. ดึงข้อมูลการจับคู่ทั้งหมด (แยกการดึงข้อมูล)
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select(`
          id,
          created_at,
          pet_id_1, pet_id_2,
          user_id_1, user_id_2
        `)
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .order("created_at", { ascending: false })

      if (matchesError) throw matchesError

      // ดึงข้อมูลสัตว์เลี้ยงและผู้ใช้ที่เกี่ยวข้อง
      if (matchesData && matchesData.length > 0) {
        // รวบรวม ID ของสัตว์เลี้ยงและผู้ใช้ทั้งหมด
        const petIds = []
        const userIds = []

        matchesData.forEach((match) => {
          petIds.push(match.pet_id_1, match.pet_id_2)
          userIds.push(match.user_id_1, match.user_id_2)
        })

        // ดึงข้อมูลสัตว์เลี้ยง
        const { data: petsData, error: petsError } = await supabase
          .from("pets")
          .select("id, name, species, breed, image_url, owner_id")
          .in("id", petIds)

        if (petsError) throw petsError

        // ดึงข้อมูลผู้ใช้
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds)

        if (profilesError) throw profilesError

        // สร้าง map ของข้อมูลสัตว์เลี้ยงและผู้ใช้เพื่อการเข้าถึงที่รวดเร็ว
        const petsMap = {}
        petsData.forEach((pet) => {
          petsMap[pet.id] = pet
        })

        const profilesMap = {}
        profilesData.forEach((profile) => {
          profilesMap[profile.id] = profile
        })

        // จัดรูปแบบข้อมูลการจับคู่
        const formattedMatches = matchesData.map((match) => {
          // กำหนดว่าสัตว์เลี้ยงของฉันและของคู่แมทช์คือตัวไหน
          const isUser1 = match.user_id_1 === user.id
          const myPet = petsMap[isUser1 ? match.pet_id_1 : match.pet_id_2]
          const otherPet = petsMap[isUser1 ? match.pet_id_2 : match.pet_id_1]
          const otherUser = profilesMap[isUser1 ? match.user_id_2 : match.user_id_1]

          return {
            id: match.id,
            created_at: match.created_at,
            myPet,
            otherPet,
            otherUser,
            // เพิ่มข้อมูลว่ามีการสนทนาแล้วหรือยัง (จะเติมข้อมูลในภายหลัง)
            hasConversation: false,
            conversationId: null,
          }
        })

        // กรองเฉพาะการจับคู่ที่มีข้อมูลครบถ้วน
        const validMatches = formattedMatches.filter((match) => match.myPet && match.otherPet && match.otherUser)

        // สร้าง Set ของ user_id ที่มีการสนทนาแล้ว
        const existingConversationUsers = new Set()
        const conversationIdMap = {}

        if (conversationsData && conversationsData.length > 0) {
          conversationsData.forEach((conv) => {
            const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id
            existingConversationUsers.add(otherUserId)
            conversationIdMap[otherUserId] = conv.id
          })
        }

        // อัปเดตข้อมูลการจับคู่ว่ามีการสนทนาแล้วหรือยัง
        const updatedMatches = validMatches.map((match) => ({
          ...match,
          hasConversation: existingConversationUsers.has(match.otherUser.id),
          conversationId: conversationIdMap[match.otherUser.id] || null,
        }))

        // ตรวจสอบการจับคู่ใหม่
        if (lastFetchTime) {
          const newMatchesFound = updatedMatches.filter((match) => new Date(match.created_at) > new Date(lastFetchTime))

          if (newMatchesFound.length > 0) {
            setNewMatches(newMatchesFound)

            // แสดงการแจ้งเตือนสำหรับการจับคู่ใหม่
            newMatchesFound.forEach((match) => {
              toast({
                title: "การจับคู่ใหม่!",
                description: `คุณได้จับคู่กับ ${match.otherPet.name} (${match.otherPet.species}) ของ ${match.otherUser.username}`,
                variant: "default",
              })
            })
          }
        }

        setMatches(updatedMatches)
      } else {
        setMatches([])
      }

      // บันทึกเวลาที่ดึงข้อมูลล่าสุด
      setLastFetchTime(currentTime)

      // ถ้าไม่มีการสนทนา ให้แสดงรายการว่างเปล่า
      if (!conversationsData || conversationsData.length === 0) {
        setConversations([])
        setIsLoading(false)
        return
      }

      // 3. สร้างรายการ user_id ที่ต้องการดึงข้อมูล (ผู้ใช้อีกฝ่ายในแต่ละการสนทนา)
      const otherUserIds = conversationsData.map((conv) => (conv.user1_id === user.id ? conv.user2_id : conv.user1_id))

      // 4. ดึงข้อมูลผู้ใช้ทั้งหมดที่เกี่ยวข้องในครั้งเดียว
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", otherUserIds)

      if (profilesError) throw profilesError

      // 5. สร้าง map ของข้อมูลผู้ใช้เพื่อการเข้าถึงที่รวดเร็ว
      const profilesMap = {}
      profilesData.forEach((profile) => {
        profilesMap[profile.id] = profile

        // กำหนดสถานะออนไลน์เป็น false เนื่องจากไม่มีข้อมูล last_seen
        setOnlineUsers((prev) => ({
          ...prev,
          [profile.id]: false,
        }))
      })

      // 6. สร้างรายการ conversation_id เพื่อดึงข้อความล่าสุด
      const conversationIds = conversationsData.map((conv) => conv.id)

      // 7. ดึงข้อความล่าสุดของทุกการสนทนาในครั้งเดียว
      // ใช้วิธีดั้งเดิมแทน RPC function เพื่อความเสถียร
      const lastMessagesMap = {}

      // ดึงข้อความล่าสุดของแต่ละการสนทนาด้วยวิธีดั้งเดิม แต่ทำในครั้งเดียว
      const { data: lastMessages, error: lastMessagesError } = await supabase
        .from("direct_messages")
        .select("id, conversation_id, content, created_at, sender_id, is_read")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })

      if (lastMessagesError) throw lastMessagesError

      // สร้าง map ของข้อความล่าสุดสำหรับแต่ละการสนทนา
      conversationIds.forEach((convId) => {
        const messagesForConv = lastMessages.filter((msg) => msg.conversation_id === convId)
        if (messagesForConv.length > 0) {
          lastMessagesMap[convId] = messagesForConv[0]
        }
      })

      // 8. ดึงจำนวนข้อความที่ยังไม่ได้อ่านสำหรับทุกการสนทนาในครั้งเดียว
      const unreadCountsMap = {}

      // Fallback: ดึงจำนวนข้อความที่ยังไม่ได้อ่านด้วยวิธีดั้งเดิม
      for (const convId of conversationIds) {
        const conv = conversationsData.find((c) => c.id === convId)
        const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id

        const { count, error } = await supabase
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .eq("sender_id", otherUserId)
          .eq("is_read", false)

        if (!error) {
          unreadCountsMap[convId] = count || 0
        }
      }

      // 9. รวมข้อมูลทั้งหมดเข้าด้วยกัน
      const conversationsWithDetails = conversationsData.map((conversation) => {
        const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id
        const lastMessage = lastMessagesMap[conversation.id]
        const unreadCount = unreadCountsMap[conversation.id] || 0

        // ตรวจสอบว่าการสนทนานี้ถูกคลิกหรือไม่
        const isClicked = clickedConversations[conversation.id] === true

        return {
          ...conversation,
          other_user: profilesMap[otherUserId] || { username: "ผู้ใช้ที่ไม่พบข้อมูล" },
          last_message: lastMessage?.content || null,
          last_message_time: lastMessage?.created_at || conversation.updated_at,
          // ถ้าการสนทนานี้ถูกคลิก ให้แสดงจำนวนข้อความที่ยังไม่ได้อ่านเป็น 0
          unread_count: isClicked ? 0 : unreadCount,
        }
      })

      // 10. เรียงลำดับตามเวลาของข้อความล่าสุด
      conversationsWithDetails.sort((a, b) => {
        return new Date(b.last_message_time) - new Date(a.last_message_time)
      })

      setConversations(conversationsWithDetails)
    } catch (error) {
      console.error("Error fetching conversations:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลการสนทนาได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // ฟังก์ชันสำหรับการลบการแจ้งเตือนการจับคู่ใหม่
  const dismissNewMatchNotification = (matchId) => {
    setNewMatches((prev) => prev.filter((match) => match.id !== matchId))
  }

  useEffect(() => {
    if (user && !loading) {
      fetchConversations()
    }
  }, [supabase, user, loading, router, toast])

  useEffect(() => {
    // ตั้งค่า Realtime Subscription เพื่อติดตามข้อความใหม่
    if (user) {
      const messagesSubscription = supabase
        .channel("messages_and_read_status")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "direct_messages",
          },
          (payload) => {
            console.log("New message detected in messages list:", payload)

            // ตรวจสอบว่าข้อความนี้เกี่ยวข้องกับผู้ใช้ปัจจุบันหรือไม่
            if (
              payload.new &&
              conversations.some(
                (conv) =>
                  conv.id === payload.new.conversation_id && (conv.user1_id === user.id || conv.user2_id === user.id),
              )
            ) {
              // เมื่อมีข้อความใหม่ที่เกี่ยวข้องกับผู้ใช้ ให้โหลดข้อมูลการสนทนาใหม่
              console.log("Refreshing conversations due to new message")
              fetchConversations()
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "direct_messages",
            filter: `is_read=eq.true`,
          },
          (payload) => {
            console.log("Message read status updated:", payload)
            // เมื่อมีการอัปเดตสถานะการอ่านข้อความ ให้โหลดข้อมูลการสนทนาใหม่
            if (payload.new && payload.new.sender_id !== user.id) {
              console.log("Refreshing conversations due to read status update")
              fetchConversations()
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "direct_conversations",
          },
          (payload) => {
            console.log("Conversation updated:", payload)
            // เมื่อมีการอัปเดตข้อมูลการสนทนา ให้โหลดข้อมูลการสนทนาใหม่
            console.log("Refreshing conversations due to conversation update")
            fetchConversations()
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "matches",
            filter: `user_id_1=eq.${user.id}`,
          },
          (payload) => {
            console.log("New match detected for user1:", payload)
            fetchConversations()
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "matches",
            filter: `user_id_2=eq.${user.id}`,
          },
          (payload) => {
            console.log("New match detected for user2:", payload)
            fetchConversations()
          },
        )
        .subscribe((status) => {
          console.log("Messages list subscription status:", status)
        })

      return () => {
        console.log("Cleaning up messages list subscription")
        supabase.removeChannel(messagesSubscription)
      }
    }
  }, [supabase, user, conversations, toast, router])

  // ฟังก์ชันสำหรับค้นหาผู้ใช้
  const searchUsers = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .neq("id", user.id) // ไม่รวมตัวเอง
        .ilike("username", `%${searchTerm}%`)
        .limit(5)

      if (error) throw error

      // ตรวจสอบสถานะออนไลน์
      const resultsWithOnlineStatus = data.map((profile) => {
        // กำหนดสถานะออนไลน์เป็น false เนื่องจากไม่มีข้อมูล last_seen
        setOnlineUsers((prev) => ({
          ...prev,
          [profile.id]: false,
        }))

        return profile
      })

      setSearchResults(resultsWithOnlineStatus || [])
    } catch (error) {
      console.error("Error searching users:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถค้นหาผู้ใช้ได้",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  // เรียกใช้ฟังก์ชันค้นหาเมื่อ searchTerm เปลี่ยน
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchTerm) {
        searchUsers()
      } else {
        setSearchResults([])
      }
    }, 500)

    return () => clearTimeout(delaySearch)
  }, [searchTerm])

  // ฟังก์ชันสำหรับเริ่มการสนทนาใหม่
  const startConversation = async (otherUserId) => {
    try {
      // ตรวจสอบว่ามีการสนทนากับผู้ใช้นี้อยู่แล้วหรือไม่
      const { data: existingConversation, error: checkError } = await supabase
        .from("direct_conversations")
        .select("id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`,
        )
        .maybeSingle()

      if (checkError) throw checkError

      if (existingConversation) {
        // ถ้ามีการสนทนาอยู่แล้ว ให้นำทางไปยังการสนทนานั้น
        router.push(`/messages/${existingConversation.id}`)
        return
      }

      // ถ้ายังไม่มีการสนทนา ให้สร้างการสนทนาใหม่
      const { data: newConversation, error: createError } = await supabase
        .from("direct_conversations")
        .insert({
          user1_id: user.id,
          user2_id: otherUserId,
        })
        .select("id")
        .single()

      if (createError) throw createError

      // นำทางไปยังการสนทนาที่สร้างใหม่
      router.push(`/messages/${newConversation.id}`)
    } catch (error) {
      console.error("Error starting conversation:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถเริ่มการสนทนาได้",
        variant: "destructive",
      })
    }
  }

  // ฟังก์ชันสำหรับหาข้อมูลผู้ใช้อีกฝ่ายในการสนทนา
  const getOtherUser = (conversation) => {
    return conversation.other_user
  }

  // ฟังก์ชันสำหรับจัดการเมื่อคลิกที่การสนทนา
  const handleConversationClick = async (conversation) => {
    console.log("Conversation clicked:", conversation.id)

    // อัปเดตสถานะการคลิกทันที
    setClickedConversations((prev) => ({
      ...prev,
      [conversation.id]: true,
    }))

    // อัปเดตการแสดงผลจำนวนข้อความที่ยังไม่ได้อ่านทันทีโดยไม่ต้องรอการตอบกลับจาก API
    setConversations((prevConversations) =>
      prevConversations.map((conv) => (conv.id === conversation.id ? { ...conv, unread_count: 0 } : conv)),
    )

    // ทำเครื่องหมายว่าอ่านข้อความแล้วในพื้นหลัง
    if (conversation.unread_count > 0) {
      console.log("Marking messages as read for conversation with unread count:", conversation.id)
      const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id

      try {
        const { error: updateError } = await supabase
          .from("direct_messages")
          .update({ is_read: true })
          .eq("conversation_id", conversation.id)
          .eq("sender_id", otherUserId)
          .eq("is_read", false)

        if (updateError) {
          console.error("Error updating read status:", updateError)
        }
      } catch (error) {
        console.error("Error marking messages as read:", error)
      }
    }
  }

  // ฟังก์ชันสำหรับจัดการเมื่อคลิกที่การจับคู่
  const handleMatchClick = (match) => {
    // ลบการแจ้งเตือนการจับคู่ใหม่
    dismissNewMatchNotification(match.id)

    if (match.hasConversation) {
      // ถ้ามีการสนทนาอยู่แล้ว ให้นำทางไปยังการสนทนานั้น
      router.push(`/messages/${match.conversationId}`)
    } else {
      // ถ้ายังไม่มีการสนทนา ให้เริ่มการสนทนาใหม่
      startConversation(match.otherUser.id)
    }
  }

  if (loading) {
    return (
      <div className="container py-8 flex justify-center">
        <p>กำลังโหลด...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container py-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>กรุณาเข้าสู่ระบบ</CardTitle>
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

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          ข้อความ
        </h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 border-pink-200 hover:bg-pink-50 hover:text-pink-600 transition-all duration-300"
            onClick={fetchConversations}
          >
            <Bell className="h-4 w-4" />
            <span>รีเฟรช</span>
          </Button>
        </div>
      </div>

      {/* แสดงการแจ้งเตือนการจับคู่ใหม่ */}
      {newMatches.length > 0 && (
        <div className="mb-6 space-y-2">
          {newMatches.map((match) => (
            <Alert key={match.id} className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 shadow-sm">
              <Heart className="h-4 w-4 text-pink-500" />
              <AlertTitle className="text-pink-700 font-medium">การจับคู่ใหม่!</AlertTitle>
              <AlertDescription className="flex justify-between items-center">
                <span>
                  คุณได้จับคู่กับ <strong>{match.otherPet.name}</strong> ({match.otherPet.species}) ของ{" "}
                  {match.otherUser.username}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 bg-white hover:bg-pink-100 border-pink-200 text-pink-600 hover:text-pink-700 transition-all duration-300"
                  onClick={() => handleMatchClick(match)}
                >
                  เริ่มการสนทนา
                </Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* รายการการสนทนา */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="ค้นหาผู้ใช้..."
                  className="pl-8 border-gray-200 focus:border-pink-300 focus:ring-pink-200 transition-all duration-300"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="w-full bg-gray-100 p-1 rounded-lg">
                  <TabsTrigger
                    value="conversations"
                    className="flex-1 data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm rounded-md transition-all duration-300"
                  >
                    การสนทนา
                  </TabsTrigger>
                  <TabsTrigger
                    value="matches"
                    className="flex-1 data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm rounded-md transition-all duration-300"
                  >
                    การจับคู่
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {/* ผลการค้นหา */}
              {searchResults.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">ผลการค้นหา</h3>
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-all duration-200"
                        onClick={() => startConversation(result.id)}
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10 mr-3">
                            <AvatarImage src={result.avatar_url || "/placeholder.svg"} alt={result.username} />
                            <AvatarFallback>{result.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                        </div>
                        <div>
                          <p className="font-medium">{result.username}</p>
                          <p className="text-xs text-gray-500">คลิกเพื่อเริ่มการสนทนา</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* กำลังค้นหา */}
              {isSearching && (
                <div className="flex justify-center py-4">
                  <p className="text-sm text-gray-500">กำลังค้นหา...</p>
                </div>
              )}

              {/* แสดงตามแท็บที่เลือก */}
              {activeTab === "conversations" ? (
                // รายการการสนทนา
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">การสนทนาของคุณ</h3>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center p-2">
                          <Skeleton className="h-10 w-10 rounded-full mr-3" />
                          <div className="space-y-1 flex-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                      <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4 opacity-50" />
                      <p className="text-gray-600 dark:text-gray-300 font-medium">คุณยังไม่มีการสนทนา</p>
                      <p className="text-sm text-gray-500 mt-1">ค้นหาผู้ใช้เพื่อเริ่มการสนทนา</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((conversation) => {
                        const otherUser = getOtherUser(conversation)
                        return (
                          <Link
                            href={`/messages/${conversation.id}`}
                            key={conversation.id}
                            onClick={(e) => {
                              e.preventDefault() // ป้องกันการนำทางทันที
                              handleConversationClick(conversation).then(() => {
                                // นำทางหลังจากทำเครื่องหมายว่าอ่านข้อความแล้ว
                                router.push(`/messages/${conversation.id}`)
                              })
                            }}
                          >
                            <div
                              className={`flex items-center p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-all duration-300 ${
                                conversation.unread_count > 0
                                  ? "border-l-3 border-pink-400 bg-gradient-to-r from-pink-50 to-transparent"
                                  : "border border-transparent hover:border-gray-200"
                              }`}
                            >
                              <div className="relative">
                                <Avatar className="h-12 w-12 mr-3 border-2 border-white shadow-sm">
                                  <AvatarImage
                                    src={otherUser?.avatar_url || "/placeholder.svg"}
                                    alt={otherUser?.username}
                                  />
                                  <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                                    {otherUser?.username?.charAt(0).toUpperCase() || "U"}
                                  </AvatarFallback>
                                </Avatar>
                                {onlineUsers[otherUser?.id] && (
                                  <span className="absolute bottom-0 right-2 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                  <p
                                    className={`font-medium truncate ${
                                      conversation.unread_count > 0 ? "font-semibold text-pink-700" : ""
                                    }`}
                                  >
                                    {otherUser?.username}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    {conversation.last_message_time && (
                                      <p className="text-xs text-gray-500">
                                        {new Date(conversation.last_message_time).toLocaleDateString("th-TH", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <p
                                  className={`text-sm truncate ${
                                    conversation.unread_count > 0 ? "text-gray-800 dark:text-gray-200" : "text-gray-500"
                                  }`}
                                >
                                  {conversation.last_message || "ยังไม่มีข้อความ"}
                                </p>
                                {conversation.pet_name && (
                                  <span className="text-xs text-gray-500">
                                    {conversation.pet_name}{" "}
                                    {conversation.pet_gender && (
                                      <span
                                        className={
                                          conversation.pet_gender === "male" ? "text-blue-500" : "text-pink-500"
                                        }
                                      >
                                        {conversation.pet_gender === "male" ? "♂" : "♀"}
                                      </span>
                                    )}
                                    {conversation.pet_species ? ` • ${conversation.pet_species}` : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                // รายการการจับคู่
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">การจับคู่ของคุณ</h3>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center p-2">
                          <Skeleton className="h-10 w-10 rounded-full mr-3" />
                          <div className="space-y-1 flex-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : matches.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                      <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4 opacity-50" />
                      <p className="text-gray-600 dark:text-gray-300 font-medium">คุณยังไม่มีการจับคู่</p>
                      <p className="text-sm text-gray-500 mt-1">เริ่มจับคู่เพื่อพบเพื่อนใหม่</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {matches.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-all duration-300 border border-transparent hover:border-gray-200"
                          onClick={() => handleMatchClick(match)}
                        >
                          <div className="relative">
                            <Avatar className="h-12 w-12 mr-3 border-2 border-white shadow-sm">
                              <AvatarImage
                                src={match.otherUser?.avatar_url || "/placeholder.svg"}
                                alt={match.otherUser?.username}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                                {match.otherUser?.username?.charAt(0).toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            {newMatches.some((newMatch) => newMatch.id === match.id) && (
                              <Badge className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs px-1.5 py-0.5 shadow-sm">
                                ใหม่
                              </Badge>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                              <p className="font-medium truncate">{match.otherUser?.username}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(match.created_at).toLocaleDateString("th-TH", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </p>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <p className="truncate">
                                <span className="font-medium">{match.otherPet.name}</span> • {match.otherPet.species}
                              </p>
                            </div>
                          </div>
                          {match.hasConversation ? (
                            <MessageCircle className="h-5 w-5 text-gray-400" />
                          ) : (
                            <Heart className="h-5 w-5 text-pink-500 animate-pulse" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* พื้นที่แสดงข้อความ */}
        <div className="lg:col-span-2 hidden lg:block">
          <Card className="h-[70vh] flex items-center justify-center">
            <div className="text-center p-6">
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">เลือกการสนทนา</h2>
              <p className="text-gray-500 max-w-md">เลือกการสนทนาจากรายการด้านซ้าย หรือค้นหาผู้ใช้เพื่อเริ่มการสนทนาใหม่</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
