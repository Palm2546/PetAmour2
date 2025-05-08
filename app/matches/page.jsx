"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { MessageCircle, Heart } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

export default function MatchesPage() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const { toast } = useToast()
  const [matches, setMatches] = useState([])
  const [myPets, setMyPets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    const fetchData = async () => {
      try {
        setIsLoading(true)

        // ดึงข้อมูลสัตว์เลี้ยงของฉัน
        const { data: myPetsData, error: myPetsError } = await supabase
          .from("pets")
          .select("id, name, image_url")
          .eq("owner_id", user.id)

        if (myPetsError) throw myPetsError
        setMyPets(myPetsData || [])

        // ดึงข้อมูลการจับคู่
        const { data: matchesData, error: matchesError } = await supabase
          .from("matches")
          .select(`
            id,
            created_at,
            pet_id_1, pet_id_2,
            user_id_1, user_id_2,
            pets1:pet_id_1(id, name, species, breed, image_url, owner_id),
            pets2:pet_id_2(id, name, species, breed, image_url, owner_id),
            profiles1:user_id_1(id, username, avatar_url),
            profiles2:user_id_2(id, username, avatar_url)
          `)
          .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
          .order("created_at", { ascending: false })

        if (matchesError) throw matchesError

        // จัดรูปแบบข้อมูลการจับคู่
        const formattedMatches = matchesData.map((match) => {
          // กำหนดว่าสัตว์เลี้ยงของฉันและของคู่แมทช์คือตัวไหน
          const isUser1 = match.user_id_1 === user.id
          const myPet = isUser1 ? match.pets1 : match.pets2
          const otherPet = isUser1 ? match.pets2 : match.pets1
          const otherUser = isUser1 ? match.profiles2 : match.profiles1

          return {
            id: match.id,
            created_at: match.created_at,
            myPet,
            otherPet,
            otherUser,
          }
        })

        setMatches(formattedMatches)
      } catch (error) {
        console.error("Error fetching matches:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลการจับคู่ได้",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [supabase, user, router, toast])

  // ฟังก์ชันสำหรับการเปิดหน้าข้อความกับผู้ใช้ที่จับคู่
  const viewConversation = async (otherUserId) => {
    if (!user) return

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
      console.error("Error accessing conversation:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถเข้าถึงการสนทนาได้",
        variant: "destructive",
      })
    }
  }

  const filterMatches = () => {
    if (activeTab === "all") {
      return matches
    } else {
      const petId = activeTab
      return matches.filter((match) => match.myPet.id === petId)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return "วันนี้"
    } else if (diffDays === 1) {
      return "เมื่อวาน"
    } else if (diffDays < 7) {
      return `${diffDays} วันที่แล้ว`
    } else {
      return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    }
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-pink-500 to-orange-500 text-transparent bg-clip-text">
        การจับคู่ของฉัน
      </h1>

      {/* แท็บสำหรับกรองตามสัตว์เลี้ยง */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="w-full overflow-x-auto flex-nowrap">
          <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
          {myPets.map((pet) => (
            <TabsTrigger key={pet.id} value={pet.id}>
              {pet.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-10 w-10 rounded-full" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filterMatches().length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">ยังไม่มีการจับคู่</h2>
          <p className="text-gray-500 mb-6">เริ่มแสดงความสนใจในสัตว์เลี้ยงอื่นๆ เพื่อสร้างการจับคู่</p>
          <Button onClick={() => router.push("/match")} className="bg-pink-600 hover:bg-pink-700">
            <Heart className="mr-2 h-4 w-4" />
            เริ่มจับคู่
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filterMatches().map((match) => (
            <Card
              key={match.id}
              className="overflow-hidden cursor-pointer hover:shadow-md transition-all"
              onClick={() => viewConversation(match.otherUser.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-16 w-16">
                    {(() => {
                      let imageUrl = match.otherPet.image_url
                      try {
                        const images = JSON.parse(match.otherPet.image_url)
                        if (Array.isArray(images) && images.length > 0) {
                          imageUrl = images[0]
                        }
                      } catch (e) {
                        // ใช้ค่าเดิม
                      }
                      return <AvatarImage src={imageUrl || "/placeholder.svg"} alt={match.otherPet.name} />
                    })()}
                    <AvatarFallback>{match.otherPet.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold">
                      <Link
                        href={`/pets/${match.otherPet.id}`}
                        className="hover:text-pink-600 transition-colors"
                        onClick={(e) => e.stopPropagation()} // ป้องกันการเปิดหน้าข้อความเมื่อคลิกที่ลิงก์
                      >
                        {match.otherPet.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-gray-500">
                      {match.otherPet.species} {match.otherPet.breed ? `• ${match.otherPet.breed}` : ""}
                    </p>
                    <p className="text-xs text-gray-400">จับคู่เมื่อ {formatDate(match.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar className="h-10 w-10 border-2 border-white">
                        {(() => {
                          let imageUrl = match.myPet.image_url
                          try {
                            const images = JSON.parse(match.myPet.image_url)
                            if (Array.isArray(images) && images.length > 0) {
                              imageUrl = images[0]
                            }
                          } catch (e) {
                            // ใช้ค่าเดิม
                          }
                          return <AvatarImage src={imageUrl || "/placeholder.svg"} alt={match.myPet.name} />
                        })()}
                        <AvatarFallback>{match.myPet.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="text-pink-500">❤️</div>
                    <div className="relative">
                      <Avatar className="h-10 w-10 border-2 border-white">
                        {(() => {
                          let imageUrl = match.otherPet.image_url
                          try {
                            const images = JSON.parse(match.otherPet.image_url)
                            if (Array.isArray(images) && images.length > 0) {
                              imageUrl = images[0]
                            }
                          } catch (e) {
                            // ใช้ค่าเดิม
                          }
                          return <AvatarImage src={imageUrl || "/placeholder.svg"} alt={match.otherPet.name} />
                        })()}
                        <AvatarFallback>{match.otherPet.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <MessageCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm">แชท</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
