"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { PawPrint, Heart } from "lucide-react"

export default function UserProfile() {
  const params = useParams()
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const { toast } = useToast()
  const [profile, setProfile] = useState(null)
  const [pets, setPets] = useState([])
  const [stats, setStats] = useState({
    petCount: 0,
    interestCount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isCurrentUser, setIsCurrentUser] = useState(false)

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // 1. ดึงข้อมูลโปรไฟล์จาก username
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", params.username)
          .single()

        if (profileError) throw profileError

        setProfile(profileData)

        // ตรวจสอบว่าเป็นโปรไฟล์ของผู้ใช้ปัจจุบันหรือไม่
        if (user && profileData.id === user.id) {
          setIsCurrentUser(true)
        }

        // 2. ดึงข้อมูลสัตว์เลี้ยงของผู้ใช้
        const { data: petsData, error: petsError } = await supabase
          .from("pets")
          .select("*")
          .eq("owner_id", profileData.id)
          .order("created_at", { ascending: false })

        if (petsError) throw petsError

        setPets(petsData || [])
        setStats((prev) => ({ ...prev, petCount: petsData?.length || 0 }))

        // 3. ดึงข้อมูลความสนใจที่ได้รับ
        const { data: interestsData, error: interestsError } = await supabase
          .from("interests")
          .select("id")
          .in(
            "pet_id",
            petsData.map((p) => p.id),
          )

        if (!interestsError) {
          setStats((prev) => ({ ...prev, interestCount: interestsData?.length || 0 }))
        }
      } catch (error) {
        console.error("Error fetching profile data:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลโปรไฟล์ได้",
          variant: "destructive",
        })
        router.push("/")
      } finally {
        setIsLoading(false)
      }
    }

    if (params.username) {
      fetchProfileData()
    }
  }, [supabase, params.username, user, toast, router])

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/3">
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-24 w-24 rounded-full mb-4" />
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-6" />
                    <div className="grid grid-cols-3 w-full gap-2">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="md:w-2/3">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-48 mb-4" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-48 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold mb-2">ไม่พบผู้ใช้</h2>
              <p className="text-gray-500 mb-4">ไม่พบผู้ใช้ที่มีชื่อผู้ใช้ "{params.username}"</p>
              <Button onClick={() => router.push("/")} className="bg-pink-600 hover:bg-pink-700">
                กลับไปหน้าหลัก
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-6">
          {/* ข้อมูลโปรไฟล์ */}
          <div className="md:w-1/3">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarImage src={profile.avatar_url || "/placeholder.svg"} alt={profile.username} />
                    <AvatarFallback className="text-2xl">{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <h2 className="text-xl font-bold">{profile.username}</h2>
                  <p className="text-gray-500 mb-6">{profile.full_name || ""}</p>

                  {isCurrentUser && (
                    <Button asChild className="mb-6 bg-pink-600 hover:bg-pink-700 w-full">
                      <Link href="/profile">แก้ไขโปรไฟล์</Link>
                    </Button>
                  )}

                  <div className="grid grid-cols-2 w-full gap-2 text-center">
                    <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <PawPrint className="h-5 w-5 text-pink-600 mb-1" />
                      <span className="text-lg font-bold">{stats.petCount}</span>
                      <span className="text-xs text-gray-500">สัตว์เลี้ยง</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <Heart className="h-5 w-5 text-pink-600 mb-1" />
                      <span className="text-lg font-bold">{stats.interestCount}</span>
                      <span className="text-xs text-gray-500">ความสนใจ</span>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-gray-500">
                    <p>เข้าร่วมเมื่อ: {new Date(profile.created_at).toLocaleDateString("th-TH")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* สัตว์เลี้ยงของผู้ใช้ */}
          <div className="md:w-2/3">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">สัตว์เลี้ยงของ {profile.username}</h2>

                {pets.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <PawPrint className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold mb-2">ยังไม่มีสัตว์เลี้ยง</h3>
                    <p className="text-gray-500">ผู้ใช้นี้ยังไม่ได้เพิ่มสัตว์เลี้ยง</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pets.map((pet) => (
                      <Link key={pet.id} href={`/pets/${pet.id}`}>
                        <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
                          <div className="aspect-square relative">
                            {(() => {
                              let imageUrl = pet.image_url
                              try {
                                // พยายามแปลง JSON string เป็น array
                                const images = JSON.parse(pet.image_url)
                                if (Array.isArray(images) && images.length > 0) {
                                  imageUrl = images[0] // ใช้รูปแรก
                                }
                              } catch (e) {
                                // ถ้าไม่ใช่ JSON ให้ใช้ค่าเดิม
                              }

                              return imageUrl ? (
                                <img
                                  src={imageUrl || "/placeholder.svg"}
                                  alt={pet.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                                  <p className="text-gray-500">ไม่มีรูปภาพ</p>
                                </div>
                              )
                            })()}
                          </div>
                          <div className="p-3">
                            <h3 className="font-bold">{pet.name}</h3>
                            <p className="text-sm text-gray-500">
                              {pet.species} {pet.breed ? `• ${pet.breed}` : ""} {pet.age ? `• ${pet.age} ปี` : ""}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
