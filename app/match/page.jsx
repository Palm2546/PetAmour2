"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import {
  Heart,
  X,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Dog,
  Cat,
  Bird,
  PawPrint,
  Sparkles,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  Zap,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import confetti from "canvas-confetti"
import { createMatchNotification } from "@/utils/notification-utils"

export default function MatchPage() {
  const router = useRouter()
  const { supabase, user, loading: userLoading } = useSupabase()
  const { toast } = useToast()
  const [pets, setPets] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showMatchDialog, setShowMatchDialog] = useState(false)
  const [matchedPet, setMatchedPet] = useState(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [myPets, setMyPets] = useState([])
  const [selectedPet, setSelectedPet] = useState(null)
  const [noMorePets, setNoMorePets] = useState(false)
  const [speciesFilter, setSpeciesFilter] = useState(null)
  const [genderFilter, setGenderFilter] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [likeAnimation, setLikeAnimation] = useState(false)
  const [dislikeAnimation, setDislikeAnimation] = useState(false)
  const [compatibilityError, setCompatibilityError] = useState(null)
  const [showInfo, setShowInfo] = useState(false)

  // สำหรับการปัดซ้าย-ขวา
  const dragX = useMotionValue(0)
  const rotate = useTransform(dragX, [-200, 0, 200], [-15, 0, 15])
  const cardOpacity = useTransform(dragX, [-200, -150, 0, 150, 200], [0.5, 0.8, 1, 0.8, 0.5])
  const dragConstraints = useRef(null)

  useEffect(() => {
    if (userLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    const fetchMyPets = async () => {
      try {
        const { data, error } = await supabase
          .from("pets")
          .select("id, name, image_url, gender, species")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error

        setMyPets(data || [])
        if (data && data.length > 0) {
          setSelectedPet(data[0].id)
        } else {
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error fetching my pets:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงของคุณได้",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    fetchMyPets()
  }, [supabase, user, router, toast, userLoading])

  useEffect(() => {
    if (!selectedPet) return

    fetchPetsToMatch()
  }, [selectedPet, speciesFilter, genderFilter])

  const fetchPetsToMatch = async () => {
    setIsLoading(true)
    setCompatibilityError(null)

    try {
      // ดึงข้อมูลสัตว์เลี้ยงที่เลือก
      const { data: selectedPetData, error: selectedPetError } = await supabase
        .from("pets")
        .select("*")
        .eq("id", selectedPet)
        .single()

      if (selectedPetError) throw selectedPetError

      // อัพเดทข้อมูลสัตว์เลี้ยงที่เลือกในรายการสัตว์เลี้ยงของเรา
      setMyPets((prev) => prev.map((pet) => (pet.id === selectedPet ? { ...pet, ...selectedPetData } : pet)))

      // ดึงข้อมูลสัตว์เลี้ยงที่ยังไม่ได้แสดงความสนใจ
      const { data: existingInterests, error: interestsError } = await supabase
        .from("interests")
        .select("pet_id")
        .eq("user_id", user.id)

      if (interestsError) throw interestsError

      // สร้างรายการ ID สัตว์เลี้ยงที่เคยแสดงความสนใจแล้ว
      const excludePetIds = existingInterests.map((interest) => interest.pet_id)

      // เพิ่มสัตว์เลี้ยงของตัวเองในรายการที่ต้องการยกเว้น
      const { data: myPetsData, error: myPetsError } = await supabase.from("pets").select("id").eq("owner_id", user.id)

      if (myPetsError) throw myPetsError

      const myPetIds = myPetsData.map((pet) => pet.id)
      const allExcludedIds = [...excludePetIds, ...myPetIds]

      // ดึงข้อมูลสัตว์เลี้ยงที่ยังไม่ได้แสดงความสนใจ
      let query = supabase
        .from("pets")
        .select("*, profiles(id, username, avatar_url)")
        .order("created_at", { ascending: false })

      // ถ้ามีรายการที่ต้องยกเว้น
      if (allExcludedIds.length > 0) {
        query = query.not("id", "in", `(${allExcludedIds.join(",")})`)
      }

      // ถ้ามีการกรองตามประเภทสัตว์เลี้ยง
      if (speciesFilter) {
        query = query.eq("species", speciesFilter)
      }

      // ถ้ามีการกรองตามเพศ
      if (genderFilter) {
        query = query.eq("gender", genderFilter)
      }

      // จำกัดจำนวนที่ดึง
      query = query.limit(20)

      const { data: petsData, error: petsError } = await query

      if (petsError) throw petsError

      if (!petsData || petsData.length === 0) {
        setNoMorePets(true)
        setPets([])
      } else {
        setPets(petsData)
        setCurrentIndex(0)
        setImageIndex(0)
        setNoMorePets(false)
      }
    } catch (error) {
      console.error("Error fetching pets to match:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงได้",
        variant: "destructive",
      })
      setPets([])
      setNoMorePets(true)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  const checkCompatibility = (myPet, otherPet) => {
    // ถ้าไม่มีข้อมูลสัตว์เลี้ยง
    if (!myPet || !otherPet) {
      return { compatible: false, reason: "ไม่พบข้อมูลสัตว์เลี้ยง" }
    }

    // ตรวจสอบประเภทสัตว์เลี้ยง
    if (myPet.species !== otherPet.species) {
      return {
        compatible: false,
        reason: `ไม่สามารถจับคู่ได้: ${myPet.species || "สัตว์เลี้ยงของคุณ"} ไม่สามารถจับคู่กับ ${otherPet.species || "สัตว์เลี้ยงนี้"} ได้`,
      }
    }

    // ตรวจสอบเพศ - ตรวจสอบอย่างเข้มงวด
    if (!myPet.gender || !otherPet.gender) {
      return {
        compatible: false,
        reason: "ไม่สามารถจับคู่ได้: ไม่ระบุเพศของสัตว์เลี้ยง",
      }
    }

    // แสดงข้อมูลเพศเพื่อ debug
    console.log("My pet gender:", myPet.gender, "Other pet gender:", otherPet.gender)

    if (myPet.gender === otherPet.gender) {
      return {
        compatible: false,
        reason: "ไม่สามารถจับคู่ได้: สัตว์เลี้ยงทั้งสองมีเพศเดียวกัน",
      }
    }

    // ผ่านการตรวจสอบทั้งหมด
    return { compatible: true }
  }

  const handleDragEnd = async (_, info) => {
    const threshold = 100
    const direction = info.offset.x > threshold ? "right" : info.offset.x < -threshold ? "left" : null

    if (direction === "right") {
      await handleLike()
    } else if (direction === "left") {
      handleDislike()
    }
  }

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    })
  }

  const handleLike = async () => {
    if (currentIndex >= pets.length) return

    setCompatibilityError(null)
    const currentPet = pets[currentIndex]
    const myPet = myPets.find((pet) => pet.id === selectedPet)

    // ตรวจสอบความเข้ากันได้
    const compatibility = checkCompatibility(myPet, currentPet)

    // แสดงข้อมูลเพื่อ debug
    console.log("Compatibility check:", compatibility)

    if (!compatibility.compatible) {
      // แสดงข้อความแจ้งเตือนในหน้าจอแทนที่จะใช้ toast
      setCompatibilityError(compatibility.reason)

      // ยังไม่ข้ามไปยังสัตว์เลี้ยงถัดไปทันที เพื่อให้ผู้ใช้เห็นข้อความแจ้งเตือน
      return
    }

    setLikeAnimation(true)
    setTimeout(() => setLikeAnimation(false), 700)

    try {
      // บันทึกความสนใจ
      const { error } = await supabase.from("interests").insert({
        user_id: user.id,
        pet_id: currentPet.id,
        from_pet_id: selectedPet,
      })

      if (error) {
        console.error("Error saving interest:", error)
        throw error
      }

      // ตรวจสอบว่าเกิดการจับคู่หรือไม่
      const { data: matchData, error: matchError } = await supabase
        .from("interests")
        .select("*")
        .eq("user_id", currentPet.profiles.id)
        .eq("pet_id", selectedPet)
        .maybeSingle()

      if (matchError) throw matchError

      // ถ้าเกิดการจับคู่
      if (matchData) {
        setMatchedPet(currentPet)

        // สร้างการแจ้งเตือนสำหรับทั้งสองฝ่าย
        try {
          // สร้างการแจ้งเตือนสำหรับผู้ใช้ปัจจุบัน
          await createMatchNotification(supabase, user.id, currentPet.profiles.id, currentPet.id)

          // สร้างการแจ้งเตือนสำหรับเจ้าของสัตว์เลี้ยงอีกฝ่าย
          await createMatchNotification(supabase, currentPet.profiles.id, user.id, selectedPet)
        } catch (notificationError) {
          console.error("Error creating match notifications:", notificationError)
          // ไม่ต้องทำอะไรเพิ่มเติม เพราะการจับคู่สำเร็จแล้ว
        }

        // แสดง dialog และ confetti เมื่อบันทึกการจับคู่สำเร็จ
        setTimeout(() => {
          setShowMatchDialog(true)
          triggerConfetti()
        }, 500)
      } else {
        // แสดง toast
        toast({
          title: "สนใจแล้ว",
          description: `คุณได้แสดงความสนใจใน ${currentPet.name} แล้ว`,
          icon: <Heart className="h-5 w-5 text-pink-500" />,
        })
      }

      // ไปยังสัตว์เลี้ยงถัดไป
      setCurrentIndex(currentIndex + 1)
      setImageIndex(0)
    } catch (error) {
      console.error("Error handling like:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกความสนใจได้",
        variant: "destructive",
      })
    }
  }

  const handleDislike = () => {
    if (currentIndex >= pets.length) return

    setCompatibilityError(null)
    setDislikeAnimation(true)
    setTimeout(() => setDislikeAnimation(false), 700)

    // ไปยังสัตว์เลี้ยงถัดไป
    setCurrentIndex(currentIndex + 1)
    setImageIndex(0)
  }

  const handleNextImage = (e) => {
    e.stopPropagation()
    if (!pets[currentIndex]) return

    let images = []
    try {
      images = JSON.parse(pets[currentIndex].image_url)
      if (!Array.isArray(images)) {
        images = [pets[currentIndex].image_url]
      }
    } catch (e) {
      images = [pets[currentIndex].image_url]
    }

    setImageIndex((prev) => (prev + 1) % images.length)
  }

  const handlePrevImage = (e) => {
    e.stopPropagation()
    if (!pets[currentIndex]) return

    let images = []
    try {
      images = JSON.parse(pets[currentIndex].image_url)
      if (!Array.isArray(images)) {
        images = [pets[currentIndex].image_url]
      }
    } catch (e) {
      images = [pets[currentIndex].image_url]
    }

    setImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleStartConversation = async () => {
    if (!matchedPet) return

    try {
      // ตรวจสอบว่ามีการสนทนากับผู้ใช้นี้อยู่แล้วหรือไม่
      const { data: existingConversation, error: checkError } = await supabase
        .from("direct_conversations")
        .select("id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${matchedPet.profiles.id}),and(user1_id.eq.${matchedPet.profiles.id},user2_id.eq.${user.id})`,
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
          user2_id: matchedPet.profiles.id,
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
    } finally {
      setShowMatchDialog(false)
    }
  }

  const handleChangePet = (petId) => {
    setSelectedPet(petId)
    setCompatibilityError(null)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setSpeciesFilter(null)
    setGenderFilter(null)
    setCompatibilityError(null)
    fetchPetsToMatch()
  }

  const renderCurrentPet = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-[70vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-pink-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">กำลังโหลดสัตว์เลี้ยง...</p>
          </div>
        </div>
      )
    }

    if (noMorePets || currentIndex >= pets.length) {
      return (
        <div className="flex flex-col justify-center items-center h-[70vh] text-center p-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-8 rounded-xl shadow-lg max-w-md">
            <div className="mb-6 relative">
              <Heart className="h-20 w-20 mx-auto text-pink-500 opacity-30" />
              <X className="h-10 w-10 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-pink-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4">ไม่มีสัตว์เลี้ยงให้จับคู่แล้ว</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              คุณได้ดูสัตว์เลี้ยงทั้งหมดแล้ว กลับมาใหม่ในภายหลังเพื่อดูสัตว์เลี้ยงเพิ่มเติม หรือลองเปลี่ยนตัวกรอง
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleRefresh} className="bg-pink-600 hover:bg-pink-700" disabled={refreshing}>
                {refreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังรีเฟรช...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    รีเฟรช
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => router.push("/discover")}>
                ค้นหาสัตว์เลี้ยงเพิ่มเติม
              </Button>
            </div>
          </div>
        </div>
      )
    }

    const currentPet = pets[currentIndex]
    if (!currentPet) return null

    // แปลง image_url เป็น array
    let images = []
    try {
      images = JSON.parse(currentPet.image_url)
      if (!Array.isArray(images)) {
        images = [currentPet.image_url]
      }
    } catch (e) {
      images = [pets[currentIndex].image_url]
    }

    return (
      <motion.div
        ref={dragConstraints}
        style={{ x: dragX, rotate, opacity: cardOpacity }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: "grabbing" }}
        className="absolute w-full"
      >
        <Card className="overflow-hidden w-full shadow-lg border-2 border-gray-100 dark:border-gray-800">
          <div className="relative aspect-[4/5] bg-gray-100 dark:bg-gray-800">
            <img
              src={images[imageIndex] || "/placeholder.svg?height=500&width=400&query=pet"}
              alt={currentPet.name}
              className="w-full h-full object-cover"
            />

            {/* ปุ่มเลื่อนรูปภาพ */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full h-8 w-8 shadow-md"
                  onClick={handlePrevImage}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full h-8 w-8 shadow-md"
                  onClick={handleNextImage}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>

                {/* ตัวบ่งชี้จำนวนรูปภาพ */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {images.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 w-2 rounded-full ${index === imageIndex ? "bg-white" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ข้อมูลสัตว์เลี้ยง */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">
                  {currentPet.name}{" "}
                  {currentPet.gender && <span className="text-white">{currentPet.gender === "ผู้" ? "♂" : "♀"}</span>}
                </h2>
                <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">{currentPet.species}</span>
              </div>
              <p className="text-sm opacity-90">
                {currentPet.breed ? `${currentPet.breed}` : ""} {currentPet.age ? `• ${currentPet.age} ปี` : ""}
              </p>
            </div>

            {/* ไอคอนแสดงการปัด */}
            <div
              className="absolute top-10 left-10 bg-white/90 rounded-full p-3 transform rotate-12 opacity-0 transition-opacity shadow-lg"
              style={{ opacity: dragX.get() < -50 ? 1 : 0 }}
            >
              <X className="h-10 w-10 text-red-500" />
            </div>
            <div
              className="absolute top-10 right-10 bg-white/90 rounded-full p-3 transform -rotate-12 opacity-0 transition-opacity shadow-lg"
              style={{ opacity: dragX.get() > 50 ? 1 : 0 }}
            >
              <Heart className="h-10 w-10 text-pink-500" />
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={currentPet.profiles?.avatar_url || "/placeholder.svg?height=40&width=40&query=user"}
                  alt={currentPet.profiles?.username}
                />
                <AvatarFallback>{currentPet.profiles?.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <p className="text-sm text-gray-500">โดย: {currentPet.profiles?.username || "ไม่ระบุชื่อ"}</p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
              {currentPet.description || "ไม่มีคำอธิบาย"}
            </p>

            {/* ปุ่มดูโปรไฟล์เพิ่มเติม */}
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/pets/${currentPet.id}`)}
                className="text-xs"
              >
                ดูโปรไฟล์เพิ่มเติม
              </Button>
            </div>
          </div>

          {/* แสดงความเข้ากันได้ */}
          {currentPet &&
            myPets.find((pet) => pet.id === selectedPet) &&
            (() => {
              const myPet = myPets.find((pet) => pet.id === selectedPet)
              const compatibility = checkCompatibility(myPet, currentPet)
              return (
                <div
                  className={`px-4 pb-3 text-sm ${compatibility.compatible ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {compatibility.compatible ? (
                    <div className="flex items-center">
                      <span className="mr-1">✓</span> สามารถจับคู่ได้
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="mr-1">✗</span> {compatibility.reason}
                    </div>
                  )}
                </div>
              )
            })()}
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-pink-500 to-orange-500 text-transparent bg-clip-text">
          จับคู่สัตว์เลี้ยง
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
          
        </p>
      </div>

      {/* แถบปุ่มด้านบน */}
      {/* คำแนะนำการใช้งาน */}
      {showInfo && (
        <div className="mb-4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-4 text-sm text-pink-800 dark:text-pink-200">
          <div className="flex items-start">
            <Zap className="h-5 w-5 mr-2 text-pink-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">วิธีใช้งาน:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>ปัดการ์ดไปทางขวาหรือกดปุ่มหัวใจเพื่อแสดงความสนใจ</li>
                <li>ปัดการ์ดไปทางซ้ายหรือกดปุ่ม X เพื่อข้าม</li>
                <li>เมื่อทั้งสองฝ่ายสนใจกัน จะเกิดการจับคู่และสามารถส่งข้อความหากันได้</li>
                <li>สัตว์เลี้ยงจะจับคู่ได้เฉพาะกับสัตว์เลี้ยงประเภทเดียวกันและต่างเพศเท่านั้น</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* แสดงข้อความแจ้งเตือนความเข้ากันไม่ได้ */}
      {compatibilityError && (
        <Alert variant="destructive" className="mb-4 bg-red-500 text-white border-none">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>ไม่สามารถจับคู่ได้</AlertTitle>
          <AlertDescription>{compatibilityError}</AlertDescription>
        </Alert>
      )}

      {userLoading ? (
        <div className="flex justify-center items-center h-[70vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-pink-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">กำลังโหลดข้อมูลผู้ใช้...</p>
          </div>
        </div>
      ) : myPets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md max-w-md mx-auto">
          <div className="text-center mb-6">
            <PawPrint className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">คุณยังไม่มีสัตว์เลี้ยง</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">คุณจำเป็นต้องมีสัตว์เลี้ยงอย่างน้อยหนึ่งตัวเพื่อเริ่มการจับคู่</p>
          </div>
          <Button onClick={() => router.push("/add-pet")} className="bg-pink-600 hover:bg-pink-700">
            <PawPrint className="mr-2 h-4 w-4" />
            เพิ่มสัตว์เลี้ยงของคุณ
          </Button>
        </div>
      ) : (
        <>
          {/* ตัวกรองและตัวเลือก */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 bg-white dark:bg-gray-950">
                    <Filter className="h-4 w-4" />
                    <span className="hidden sm:inline">ตัวกรอง</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-lg"
                  align="start"
                >
                  <DropdownMenuLabel>ประเภทสัตว์เลี้ยง</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setSpeciesFilter(null)}
                    className={!speciesFilter ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    <PawPrint className="h-4 w-4 mr-2" /> ทั้งหมด
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSpeciesFilter("สุนัข")}
                    className={speciesFilter === "สุนัข" ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    <Dog className="h-4 w-4 mr-2" /> สุนัข
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSpeciesFilter("แมว")}
                    className={speciesFilter === "แมว" ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    <Cat className="h-4 w-4 mr-2" /> แมว
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSpeciesFilter("นก")}
                    className={speciesFilter === "นก" ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    <Bird className="h-4 w-4 mr-2" /> นก
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSpeciesFilter("กระต่าย")}
                    className={speciesFilter === "กระต่าย" ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    <PawPrint className="h-4 w-4 mr-2" /> กระต่าย
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSpeciesFilter("ปลา")}
                    className={speciesFilter === "ปลา" ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    <PawPrint className="h-4 w-4 mr-2" /> ปลา
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuLabel>เพศ</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setGenderFilter(null)}
                    className={!genderFilter ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    ทั้งหมด
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setGenderFilter("ผู้")}
                    className={genderFilter === "ผู้" ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    <span className="mr-2 text-blue-500">♂</span> เพศผู้
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setGenderFilter("เมีย")}
                    className={genderFilter === "เมีย" ? "bg-gray-200 dark:bg-gray-700" : ""}
                  >
                    <span className="mr-2 text-pink-500">♀</span> เพศเมีย
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-1 bg-white dark:bg-gray-950"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                <span className="hidden sm:inline">รีเฟรช</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInfo(!showInfo)}
                className="gap-1 bg-white dark:bg-gray-950"
              >
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline">วิธีใช้</span>
              </Button>
            </div>

            {/* แสดงตัวกรองที่เลือก */}
            <div className="flex gap-1 flex-wrap justify-end">
              {speciesFilter && (
                <Badge variant="outline" className="gap-1">
                  {speciesFilter === "สุนัข" ? (
                    <Dog className="h-3 w-3" />
                  ) : speciesFilter === "แมว" ? (
                    <Cat className="h-3 w-3" />
                  ) : speciesFilter === "นก" ? (
                    <Bird className="h-3 w-3" />
                  ) : (
                    <PawPrint className="h-3 w-3" />
                  )}
                  {speciesFilter}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setSpeciesFilter(null)} />
                </Badge>
              )}
              {genderFilter && (
                <Badge variant="outline" className="gap-1">
                  {genderFilter === "ผู้" ? (
                    <span className="text-blue-500">♂</span>
                  ) : (
                    <span className="text-pink-500">♀</span>
                  )}
                  {genderFilter}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setGenderFilter(null)} />
                </Badge>
              )}
            </div>
          </div>

          {/* เลือกสัตว์เลี้ยงของฉัน */}
          {myPets.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-medium mb-2">เลือกสัตว์เลี้ยงของคุณ</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 px-1">
                {myPets.map((pet) => {
                  // แปลง image_url เป็น URL รูปแรก
                  let imageUrl = pet.image_url
                  try {
                    const images = JSON.parse(pet.image_url)
                    if (Array.isArray(images) && images.length > 0) {
                      imageUrl = images[0]
                    }
                  } catch (e) {
                    // ใช้ค่าเดิม
                  }

                  return (
                    <div
                      key={pet.id}
                      className={`relative cursor-pointer transition-all ${
                        selectedPet === pet.id
                          ? "ring-2 ring-pink-500 scale-105"
                          : "opacity-70 hover:opacity-100 hover:scale-105"
                      }`}
                      onClick={() => handleChangePet(pet.id)}
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden shadow-md">
                        <img
                          src={imageUrl || "/placeholder.svg?height=100&width=100&query=pet"}
                          alt={pet.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-center mt-1 truncate max-w-[64px]">
                        {pet.name} {pet.gender && <span>{pet.gender === "ผู้" ? "♂" : "♀"}</span>}
                      </p>
                      {selectedPet === pet.id && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-pink-500 text-white rounded-full p-0.5">
                          <Sparkles className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* การ์ดสัตว์เลี้ยง */}
          <div className="relative h-[70vh] max-w-md mx-auto">
            <AnimatePresence>{renderCurrentPet()}</AnimatePresence>

            {/* แอนิเมชันการกดไลค์ */}
            <AnimatePresence>
              {likeAnimation && (
                <motion.div
                  className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 1 }}
                  exit={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  <Heart className="h-24 w-24 text-pink-500 drop-shadow-lg" fill="#ec4899" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* แอนิเมชันการกดไม่สนใจ */}
            <AnimatePresence>
              {dislikeAnimation && (
                <motion.div
                  className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
                  initial={{ scale: 0.5, opacity: 0, rotate: 0 }}
                  animate={{ scale: 1.5, opacity: 1, rotate: 45 }}
                  exit={{ scale: 2, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.7 }}
                >
                  <X className="h-24 w-24 text-red-500 drop-shadow-lg" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ปุ่มควบคุม */}
          {!isLoading && !noMorePets && currentIndex < pets.length && (
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={handleDislike}
                className="h-14 w-14 rounded-full border border-gray-200 flex items-center justify-center shadow-sm hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                <X className="h-6 w-6 text-gray-500" />
              </button>
              <button
                onClick={handleLike}
                className="h-14 w-14 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center shadow-md hover:from-pink-600 hover:to-orange-600 transition-all"
              >
                <Heart className="h-6 w-6 text-white" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Dialog แสดงการจับคู่ */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="bg-gradient-to-br from-pink-500 to-orange-500 border-none text-white max-w-sm sm:max-w-md p-6">
          <div className="absolute -top-12 left-0 right-0 flex justify-center">
            <div className="bg-white rounded-full p-3 shadow-lg">
              <Heart className="h-10 w-10 text-pink-500" />
            </div>
          </div>

          <DialogHeader className="pt-6">
            <DialogTitle className="text-2xl font-bold text-center text-white">เกิดการจับคู่แล้ว! 🎉</DialogTitle>
            <DialogDescription className="text-center text-white/90">
              คุณและ {matchedPet?.profiles?.username || "เจ้าของสัตว์เลี้ยง"} ได้แสดงความสนใจซึ่งกันและกัน
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center items-center gap-4 my-6">
            <div className="relative">
              {myPets.find((p) => p.id === selectedPet) && (
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg">
                  {(() => {
                    const myPet = myPets.find((p) => p.id === selectedPet)
                    let imageUrl = myPet?.image_url
                    try {
                      const images = JSON.parse(myPet?.image_url)
                      if (Array.isArray(images) && images.length > 0) {
                        imageUrl = images[0]
                      }
                    } catch (e) {
                      // ใช้ค่าเดิม
                    }
                    return (
                      <img
                        src={imageUrl || "/placeholder.svg?height=200&width=200&query=pet"}
                        alt="Your pet"
                        className="w-full h-full object-cover"
                      />
                    )
                  })()}
                </div>
              )}
            </div>

            <div className="text-5xl animate-pulse">❤️</div>

            <div className="relative">
              {matchedPet && (
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg">
                  {(() => {
                    let imageUrl = matchedPet?.image_url
                    try {
                      const images = JSON.parse(matchedPet?.image_url)
                      if (Array.isArray(images) && images.length > 0) {
                        imageUrl = images[0]
                      }
                    } catch (e) {
                      // ใช้ค่าเดิม
                    }
                    return (
                      <img
                        src={imageUrl || "/placeholder.svg?height=200&width=200&query=pet"}
                        alt={matchedPet?.name}
                        className="w-full h-full object-cover"
                      />
                    )
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="text-center mb-4">
            <p>
              <span className="font-semibold">
                {myPets.find((p) => p.id === selectedPet)?.name || "สัตว์เลี้ยงของคุณ"}{" "}
                {myPets.find((p) => p.id === selectedPet)?.gender && (
                  <span className="text-white">
                    {myPets.find((p) => p.id === selectedPet)?.gender === "ผู้" ? "♂" : "♀"}
                  </span>
                )}
              </span>{" "}
              ได้จับคู่กับ{" "}
              <span className="font-semibold">
                {matchedPet?.name || "สัตว์เลี้ยง"}{" "}
                {matchedPet?.gender && <span className="text-white">{matchedPet.gender === "ผู้" ? "♂" : "♀"}</span>}
              </span>
              {matchedPet?.species ? ` (${matchedPet.species})` : ""}!
            </p>
            <p className="text-white/90 mt-2">ตอนนี้คุณสามารถส่งข้อความหาเจ้าของสัตว์เลี้ยงได้แล้ว!</p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex flex-col items-center w-full gap-2">
              <Button
                onClick={handleStartConversation}
                className="w-full max-w-xs bg-white text-pink-600 hover:bg-white/90 hover:text-pink-700 font-medium"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                ส่งข้อความ
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowMatchDialog(false)}
                className="w-full max-w-xs border-white text-white bg-white/10 hover:bg-white/30"
              >
                ดูสัตว์เลี้ยงต่อไป
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
