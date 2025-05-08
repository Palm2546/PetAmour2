"use client"

import { DialogFooter } from "@/components/ui/dialog"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Edit, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"

export default function PetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const { toast } = useToast()
  const [pet, setPet] = useState(null)
  const [owner, setOwner] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imageUrls, setImageUrls] = useState([])
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fetchPetData = async () => {
      try {
        // ดึงข้อมูลสัตว์เลี้ยง
        const { data: petData, error: petError } = await supabase.from("pets").select("*").eq("id", params.id).single()

        if (petError) throw petError

        setPet(petData)

        // จัดการกับรูปภาพ
        let urls = []
        try {
          // ตรวจสอบว่า image_url เป็น JSON string หรือไม่
          const parsedUrls = JSON.parse(petData.image_url)
          if (Array.isArray(parsedUrls)) {
            urls = parsedUrls
          }
        } catch (e) {
          // ถ้าไม่ใช่ JSON string ให้ใช้ค่าเดิม
          if (petData.image_url) {
            urls = [petData.image_url]
          }
        }
        setImageUrls(urls)

        // ดึงข้อมูลเจ้าของสัตว์เลี้ยง
        const { data: ownerData, error: ownerError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", petData.owner_id)
          .single()

        if (!ownerError) {
          setOwner(ownerData)
        }
      } catch (error) {
        console.error("Error fetching pet data:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงได้",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchPetData()
  }, [supabase, params.id, user, toast])

  const handleDelete = async () => {
    if (!user || pet.owner_id !== user.id) {
      toast({
        title: "ไม่มีสิทธิ์เข้าถึง",
        description: "คุณไม่มีสิทธิ์ลบสัตว์เลี้ยงนี้",
        variant: "destructive",
      })
      return
    }

    setIsDeleting(true)

    try {
      // 1. ลบรูปภาพจาก Storage (ถ้ามี)
      let imagesToDelete = []
      try {
        // ตรวจสอบว่า image_url เป็น JSON string หรือไม่
        const parsedUrls = JSON.parse(pet.image_url)
        if (Array.isArray(parsedUrls)) {
          imagesToDelete = parsedUrls
        }
      } catch (e) {
        // ถ้าไม่ใช่ JSON string ให้ใช้ค่าเดิม
        if (pet.image_url) {
          imagesToDelete = [pet.image_url]
        }
      }

      // ลบรูปภาพทั้งหมด
      for (const imageUrl of imagesToDelete) {
        try {
          // แปลง URL เป็น path ใน storage
          const storageUrl = new URL(imageUrl)
          const pathParts = storageUrl.pathname.split("/")
          // หาตำแหน่งของ pet-images ในพาธ
          const petImagesIndex = pathParts.findIndex((part) => part === "pet-images")

          if (petImagesIndex !== -1) {
            // เอาส่วนที่อยู่หลัง pet-images
            const storagePath = pathParts.slice(petImagesIndex + 1).join("/")

            if (storagePath) {
              await supabase.storage.from("pet-images").remove([storagePath])
            }
          }
        } catch (storageError) {
          console.error("Error deleting image:", storageError)
          // ไม่ throw error เพื่อให้โค้ดทำงานต่อไปได้
        }
      }

      // 2. ลบข้อมูลสัตว์เลี้ยงจากฐานข้อมูล
      const { error } = await supabase.from("pets").delete().eq("id", params.id)

      if (error) throw error

      toast({
        title: "ลบสัตว์เลี้ยงสำเร็จ",
        description: "ลบข้อมูลสัตว์เลี้ยงเรียบร้อยแล้ว",
      })

      // นำทางกลับไปยังหน้าสัตว์เลี้ยงของฉัน
      router.push("/my-pets")
    } catch (error) {
      console.error("Error deleting pet:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถลบสัตว์เลี้ยงได้",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % imageUrls.length)
  }

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length)
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

  // ฟังก์ชันสำหรับแสดงสัญลักษณ์เพศที่ถูกต้อง
  const renderGenderSymbol = (gender) => {
    if (!gender) return null

    // ตรวจสอบค่าเพศและแสดงสัญลักษณ์ที่ถูกต้อง
    if (gender === "ผู้") {
      return <span className="ml-1 text-blue-500 dark:text-blue-400">♂</span>
    } else if (gender === "เมีย") {
      return <span className="ml-1 text-pink-500 dark:text-pink-400">♀</span>
    }

    return null
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center">
        <p>กำลังโหลด...</p>
      </div>
    )
  }

  if (!pet) {
    return (
      <div className="container py-8">
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">ไม่พบสัตว์เลี้ยง</h2>
          <p className="text-gray-500">ไม่พบข้อมูลสัตว์เลี้ยงที่คุณกำลังค้นหา</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {pet.name} {renderGenderSymbol(pet.gender)}
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* รูปภาพสัตว์เลี้ยง */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-lg overflow-hidden">
            {imageUrls.length > 0 ? (
              <>
                <img
                  src={imageUrls[selectedImageIndex] || "/placeholder.svg"}
                  alt={pet.name}
                  className="w-full h-full object-cover"
                />

                {/* ปุ่มเลื่อนรูปภาพ (แสดงเฉพาะเมื่อมีรูปมากกว่า 1 รูป) */}
                {imageUrls.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full h-8 w-8"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full h-8 w-8"
                      onClick={nextImage}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>

                    {/* ตัวบ่งชี้จำนวนรูปภาพ */}
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                      {imageUrls.map((_, index) => (
                        <div
                          key={index}
                          className={`h-2 w-2 rounded-full ${
                            index === selectedImageIndex ? "bg-white" : "bg-white/50"
                          }`}
                          onClick={() => setSelectedImageIndex(index)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                <p className="text-gray-500">ไม่มีรูปภาพ</p>
              </div>
            )}
          </div>

          {/* แสดงรูปภาพย่อเมื่อมีหลายรูป */}
          {imageUrls.length > 1 && (
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((url, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 ${
                    selectedImageIndex === index ? "border-pink-500" : "border-transparent"
                  }`}
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <img
                    src={url || "/placeholder.svg"}
                    alt={`${pet.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ข้อมูลสัตว์เลี้ยง */}
        <div>
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">
                  {pet.name} {renderGenderSymbol(pet.gender)}
                </h2>
                <p className="text-gray-500">
                  {pet.species}
                  {pet.breed && ` • ${pet.breed}`}
                  {pet.age && ` • ${pet.age} ปี`}
                </p>
              </div>

              {pet.description && (
                <div>
                  <h3 className="font-medium mb-1">เกี่ยวกับ {pet.name}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{pet.description}</p>
                </div>
              )}

              {owner && (
                <div>
                  <h3 className="font-medium mb-1">เจ้าของ</h3>
                  <div
                    className="flex items-center cursor-pointer"
                    onClick={() => router.push(`/users/${owner.username}`)}
                  >
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarImage src={owner.avatar_url || "/placeholder.svg?height=40&width=40&query=user"} />
                      <AvatarFallback>{owner.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{owner.full_name || owner.username}</p>
                      <p className="text-sm text-gray-500">@{owner.username}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* แสดงปุ่มแก้ไขและลบเฉพาะเจ้าของสัตว์เลี้ยง */}
              {user && user.id === pet.owner_id && (
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => router.push(`/pets/${pet.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    แก้ไข
                  </Button>
                  <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="flex-1">
                        <Trash2 className="mr-2 h-4 w-4" />
                        ลบ
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>ยืนยันการลบสัตว์เลี้ยง</DialogTitle>
                        <DialogDescription>
                          คุณแน่ใจหรือไม่ว่าต้องการลบ {pet.name}? การกระทำนี้ไม่สามารถย้อนกลับได้
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                          ยกเลิก
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                          {isDeleting ? "กำลังลบ..." : "ลบ"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
