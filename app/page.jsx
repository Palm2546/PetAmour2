"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Heart, PawPrint, Search } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function Home() {
  const { supabase, user } = useSupabase()
  const { toast } = useToast()
  const [recentPets, setRecentPets] = useState([])
  const [popularPets, setPopularPets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [loadedImages, setLoadedImages] = useState({})

  useEffect(() => {
    const fetchPets = async () => {
      try {
        // ดึงข้อมูลสัตว์เลี้ยงล่าสุด
        const { data: recentData, error: recentError } = await supabase
          .from("pets")
          .select("*, profiles(username, avatar_url)")
          .order("created_at", { ascending: false })
          .limit(6)

        if (recentError) throw recentError
        setRecentPets(recentData || [])

        // ดึงข้อมูลสัตว์เลี้ยงยอดนิยม (มีคนสนใจมากที่สุด)
        // ใช้ SQL query โดยตรงเพื่อดึงข้อมูลจำนวนความสนใจและสัตว์เลี้ยงยอดนิยม
        const { data: popularData, error: popularError } = await supabase.from("pets").select(`
            id, name, species, breed, age, description, image_url, owner_id,
            profiles!pets_owner_id_fkey (username, avatar_url)
          `)

        if (popularError) throw popularError

        // ดึงข้อมูลจำนวนความสนใจสำหรับแต่ละสัตว์เลี้ยง
        const { data: interestData, error: interestCountError } = await supabase.from("interests").select("pet_id, id")

        if (interestCountError) throw interestCountError

        // นับจำนวนความสนใจสำหรับแต่ละสัตว์เลี้ยง
        const interestCounts = {}
        interestData.forEach((interest) => {
          if (!interestCounts[interest.pet_id]) {
            interestCounts[interest.pet_id] = 0
          }
          interestCounts[interest.pet_id]++
        })

        // เพิ่มข้อมูลจำนวนความสนใจให้กับข้อมูลสัตว์เลี้ยง
        const petsWithInterests = popularData.map((pet) => ({
          ...pet,
          interest_count: interestCounts[pet.id] || 0,
        }))

        // เรียงลำดับตามจำนวนความสนใจ (มากไปน้อย)
        petsWithInterests.sort((a, b) => b.interest_count - a.interest_count)

        // เลือกเฉพาะ 3 อันดับแรก
        setPopularPets(petsWithInterests.slice(0, 3))
      } catch (error) {
        console.error("Error fetching pets:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงได้",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchPets()
  }, [supabase, toast])

  // ฟังก์ชันสำหรับจัดการการโหลดรูปภาพ
  const handleImageLoad = (petId) => {
    setLoadedImages((prev) => ({
      ...prev,
      [petId]: true,
    }))
  }

  // เพิ่ม CSS keyframes animation
  const floatAnimation = `
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    @keyframes glow {
      0% { filter: drop-shadow(0 8px 16px rgba(64, 224, 208, 0.3)); }
      50% { filter: drop-shadow(0 8px 16px rgba(255, 165, 0, 0.3)); }
      100% { filter: drop-shadow(0 8px 16px rgba(255, 107, 107, 0.3)); }
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `

  return (
    <>
      <style jsx global>
        {floatAnimation}
      </style>
      <div className="flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-[#40E0D0]/10 to-white dark:from-[#40E0D0]/5 dark:to-background">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none bg-gradient-to-r from-[#40E0D0] via-[#FFA500] to-[#FF6B6B] text-transparent bg-clip-text">
                    PetAmour - แอปจับคู่สัตว์เลี้ยงสุดน่ารัก
                  </h1>
                  <p className="max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                    แชร์ภาพสัตว์เลี้ยงสุดน่ารักของคุณ พร้อมบอกเล่าเรื่องราว และจับคู่กับสัตว์เลี้ยงตัวอื่นๆqqqqqqqqqqqqqq
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  {!user ? (
                    <Link href="/register">
                      <Button
                        size="lg"
                        className="bg-[#40E0D0] hover:bg-[#2CCAC0] text-white py-6 px-8 text-lg font-medium"
                      >
                        <Heart className="mr-2 h-5 w-5" />
                        เริ่มต้นใช้งาน
                      </Button>
                    </Link>
                  ) : null}
                  <Link href="/discover">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-[#FFA500] text-[#FFA500] hover:bg-[#FFA500] hover:text-white py-6 px-8 text-lg font-medium"
                    >
                      <Search className="mr-2 h-5 w-5" />
                      ค้นหาสัตว์เลี้ยง
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="mx-auto lg:mr-0 relative">
                {/* ลบกรอบด้านนอกทั้งหมด */}
                <div className="flex items-center justify-center">
                  <img
                    alt="PetAmour Logo"
                    className="w-full max-w-[480px] h-auto object-contain"
                    src="/logo03.png"
                    style={{
                      filter: "drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15))",
                    }}
                    onLoad={() => setImageLoaded(true)}
                  />

                  {/* โลโก้ที่มุมขวาล่าง */}
                  <div
                    className="absolute -bottom-6 -right-6 h-24 w-24 filter drop-shadow-lg"
                    style={{
                      animation: "bounce 3s ease-in-out infinite, pulse 4s infinite",
                    }}
                  >
                    <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-full blur-md opacity-70"></div>
                    <img
                      src="/petamour-logo.png"
                      alt="PetAmour Logo"
                      className="h-full w-full object-contain relative z-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Pets Section */}
        <section className="w-full py-12 md:py-16">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-[#40E0D0] to-[#FFA500] text-transparent bg-clip-text">
                  สัตว์เลี้ยงล่าสุด
                </h2>
                <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  สัตว์เลี้ยงน่ารักที่เพิ่งเข้าร่วมกับเรา
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="overflow-hidden border border-[#40E0D0]/20 shadow-lg shadow-[#40E0D0]/5">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : recentPets.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="text-xl font-semibold mb-2">ยังไม่มีสัตว์เลี้ยง</h3>
                <p className="text-gray-500">เป็นคนแรกที่เพิ่มสัตว์เลี้ยงของคุณ!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recentPets.map((pet) => (
                  <Card
                    key={pet.id}
                    className="overflow-hidden h-full transition-all duration-300 hover:shadow-xl border border-[#40E0D0]/20 hover:border-[#40E0D0]/50 group"
                  >
                    <Link href={`/pets/${pet.id}`} className="cursor-pointer">
                      <div className="aspect-square relative overflow-hidden bg-gradient-to-b from-[#f0fffe] to-[#f8fdfd] dark:from-gray-800 dark:to-gray-900">
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
                            <>
                              {/* เอฟเฟกต์ไล่สีเบื้องหลัง */}
                              <div className="absolute inset-0 bg-gradient-to-br from-[#40E0D0]/10 via-transparent to-[#FFA500]/10 z-0"></div>

                              {/* รูปภาพ */}
                              <div
                                className={`relative w-full h-full transition-all duration-700 ease-in-out ${
                                  loadedImages[pet.id] ? "opacity-100 scale-100" : "opacity-0 scale-105"
                                }`}
                              >
                                <img
                                  src={imageUrl || "/placeholder.svg"}
                                  alt={pet.name}
                                  className="w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-110 z-10"
                                  onLoad={() => handleImageLoad(pet.id)}
                                  style={{
                                    filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))",
                                  }}
                                />

                                {/* เอฟเฟกต์ overlay เมื่อ hover */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"></div>

                                {/* ชื่อสัตว์เลี้ยงที่แสดงเมื่อ hover */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-30">
                                  <h3 className="text-white text-xl font-bold drop-shadow-md">{pet.name}</h3>
                                </div>
                              </div>

                              {/* Placeholder ระหว่างโหลด */}
                              {!loadedImages[pet.id] && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-5">
                                  <div className="animate-pulse flex space-x-2">
                                    <div className="h-3 w-3 bg-[#40E0D0] rounded-full"></div>
                                    <div className="h-3 w-3 bg-[#FFA500] rounded-full"></div>
                                    <div className="h-3 w-3 bg-[#FF6B6B] rounded-full"></div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                              <div className="text-center p-4">
                                <PawPrint className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-500">ไม่มีรูปภาพ</p>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </Link>
                    <CardContent className="p-4 bg-white dark:bg-gray-900">
                      <Link href={`/pets/${pet.id}`}>
                        <h3 className="text-xl font-bold mb-1 hover:text-[#40E0D0] transition-colors">{pet.name}</h3>
                      </Link>
                      <p className="text-sm text-gray-500 mb-2">
                        {pet.species} {pet.breed ? `• ${pet.breed}` : ""} {pet.age ? `• ${pet.age} ปี` : ""}
                      </p>
                      <p className="line-clamp-2 text-sm mb-2">{pet.description || "ไม่มีคำอธิบาย"}</p>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5 border border-[#40E0D0]/30">
                          <AvatarImage
                            src={pet.profiles?.avatar_url || "/placeholder.svg"}
                            alt={pet.profiles?.username}
                          />
                          <AvatarFallback className="bg-[#FFA500] text-white">
                            {pet.profiles?.username?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-xs text-gray-500">โดย: {pet.profiles?.username || "ไม่ระบุชื่อ"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-center mt-8">
              <Link href="/discover">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-[#40E0D0] text-[#40E0D0] hover:bg-[#40E0D0] hover:text-white"
                >
                  ดูสัตว์เลี้ยงทั้งหมด
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Popular Pets Section */}
        <section className="w-full py-12 md:py-16">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-[#FFA500] to-[#FF6B6B] text-transparent bg-clip-text">
                  สัตว์เลี้ยงยอดนิยม
                </h2>
                <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  สัตว์เลี้ยงที่ได้รับความสนใจมากที่สุด
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="overflow-hidden border border-[#FF6B6B]/20 shadow-lg shadow-[#FF6B6B]/5">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : popularPets.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="text-xl font-semibold mb-2">ยังไม่มีสัตว์เลี้ยงยอดนิยม</h3>
                <p className="text-gray-500">แสดงความสนใจในสัตว์เลี้ยงเพื่อให้พวกเขาปรากฏที่นี่</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {popularPets.map((pet) => (
                  <Card
                    key={pet.id}
                    className="overflow-hidden h-full transition-all duration-300 hover:shadow-xl border border-[#FF6B6B]/20 hover:border-[#FF6B6B]/50 group"
                  >
                    <Link href={`/pets/${pet.id}`} className="cursor-pointer">
                      <div className="aspect-square relative overflow-hidden bg-gradient-to-b from-[#fff5e6] to-[#fff9f9] dark:from-gray-800 dark:to-gray-900">
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
                            <>
                              {/* เอฟเฟกต์ไล่สีเบื้องหลัง */}
                              <div className="absolute inset-0 bg-gradient-to-br from-[#FFA500]/10 via-transparent to-[#FF6B6B]/10 z-0"></div>

                              {/* รูปภาพ */}
                              <div
                                className={`relative w-full h-full transition-all duration-700 ease-in-out ${
                                  loadedImages[pet.id] ? "opacity-100 scale-100" : "opacity-0 scale-105"
                                }`}
                              >
                                <img
                                  src={imageUrl || "/placeholder.svg"}
                                  alt={pet.name}
                                  className="w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-110 z-10"
                                  onLoad={() => handleImageLoad(pet.id)}
                                  style={{
                                    filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))",
                                  }}
                                />

                                {/* เอฟเฟกต์ overlay เมื่อ hover */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"></div>

                                {/* ชื่อสัตว์เลี้ยงที่แสดงเมื่อ hover */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-30">
                                  <h3 className="text-white text-xl font-bold drop-shadow-md">{pet.name}</h3>
                                </div>
                              </div>

                              {/* Placeholder ระหว่างโหลด */}
                              {!loadedImages[pet.id] && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-5">
                                  <div className="animate-pulse flex space-x-2">
                                    <div className="h-3 w-3 bg-[#FFA500] rounded-full"></div>
                                    <div className="h-3 w-3 bg-[#FF6B6B] rounded-full"></div>
                                    <div className="h-3 w-3 bg-[#40E0D0] rounded-full"></div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                              <div className="text-center p-4">
                                <PawPrint className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-500">ไม่มีรูปภาพ</p>
                              </div>
                            </div>
                          )
                        })()}
                        <div className="absolute top-2 right-2 bg-[#FF6B6B] text-white rounded-full px-2 py-1 text-xs font-bold flex items-center shadow-md z-30">
                          <Heart className="h-3 w-3 mr-1 fill-white" />
                          {pet.interest_count || 0}
                        </div>
                      </div>
                    </Link>
                    <CardContent className="p-4 bg-white dark:bg-gray-900">
                      <Link href={`/pets/${pet.id}`}>
                        <h3 className="text-xl font-bold mb-1 hover:text-[#FF6B6B] transition-colors">{pet.name}</h3>
                      </Link>
                      <p className="text-sm text-gray-500 mb-2">
                        {pet.species} {pet.breed ? `• ${pet.breed}` : ""} {pet.age ? `• ${pet.age} ปี` : ""}
                      </p>
                      <p className="line-clamp-2 text-sm mb-2">{pet.description || "ไม่มีคำอธิบาย"}</p>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5 border border-[#FF6B6B]/30">
                          <AvatarImage
                            src={pet.profiles?.avatar_url || "/placeholder.svg"}
                            alt={pet.profiles?.username}
                          />
                          <AvatarFallback className="bg-[#FFA500] text-white">
                            {pet.profiles?.username?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-xs text-gray-500">โดย: {pet.profiles?.username || "ไม่ระบุชื่อ"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-r from-[#40E0D0]/10 via-[#FFA500]/10 to-[#FF6B6B]/10 dark:from-[#40E0D0]/5 dark:via-[#FFA500]/5 dark:to-[#FF6B6B]/5">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl bg-gradient-to-r from-[#40E0D0] via-[#FFA500] to-[#FF6B6B] text-transparent bg-clip-text">
                  พร้อมที่จะเริ่มต้นแล้วหรือยัง?
                </h2>
                <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  สมัครสมาชิกวันนี้และเริ่มต้นแชร์สัตว์เลี้ยงสุดน่ารักของคุณ
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                {!user ? (
                  <Link href="/register">
                    <Button
                      size="lg"
                      className="bg-[#40E0D0] hover:bg-[#2CCAC0] text-white py-6 px-8 text-lg font-medium"
                    >
                      สมัครสมาชิกฟรี
                    </Button>
                  </Link>
                ) : (
                  <Link href="/match">
                    <Button
                      size="lg"
                      className="bg-[#FF6B6B] hover:bg-[#FF5252] text-white py-6 px-8 text-lg font-medium"
                    >
                      <Heart className="mr-2 h-5 w-5" />
                      จับคู่สัตว์เลี้ยง
                    </Button>
                  </Link>
                )}
                <Link href="/discover">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-[#FFA500] text-[#FFA500] hover:bg-[#FFA500] hover:text-white py-6 px-8 text-lg font-medium"
                  >
                    สำรวจก่อน
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
