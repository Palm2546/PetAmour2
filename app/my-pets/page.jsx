"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Edit, Plus, Trash } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function MyPets() {
  const router = useRouter()
  const { supabase, user, loading } = useSupabase()
  const { toast } = useToast()
  const [pets, setPets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [petToDelete, setPetToDelete] = useState(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    const fetchPets = async () => {
      if (loading) return

      if (!user) {
        router.push("/login")
        return
      }

      try {
        const { data, error } = await supabase
          .from("pets")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error

        setPets(data || [])
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
  }, [supabase, user, loading, router, toast])

  const confirmDelete = (pet) => {
    setPetToDelete(pet)
    setShowDeleteDialog(true)
  }

  const handleDelete = async () => {
    if (!petToDelete) return

    setIsDeleting(true)
    try {
      // 1. ลบข้อมูลสัตว์เลี้ยงจากฐานข้อมูล
      const { error } = await supabase.from("pets").delete().eq("id", petToDelete.id)

      if (error) throw error

      // 2. ลบรูปภาพจาก Storage ถ้ามี URL รูปภาพ
      if (petToDelete.image_url) {
        try {
          let imageUrls = []

          // ตรวจสอบว่า image_url เป็น JSON string หรือไม่
          try {
            const parsed = JSON.parse(petToDelete.image_url)
            if (Array.isArray(parsed)) {
              imageUrls = parsed
            } else {
              imageUrls = [petToDelete.image_url]
            }
          } catch (e) {
            // ถ้าไม่ใช่ JSON ให้ใช้ค่าเดิม
            imageUrls = [petToDelete.image_url]
          }

          // ลบรูปภาพทั้งหมด
          for (const imageUrl of imageUrls) {
            if (!imageUrl || typeof imageUrl !== "string") continue

            // ใช้วิธีการแยก path จาก URL โดยไม่ใช้ URL constructor
            const extractStoragePath = (url) => {
              // ตรวจสอบว่า URL มี pet-images หรือไม่
              if (!url.includes("pet-images")) return null

              // แยก path หลังจาก pet-images
              const parts = url.split("pet-images/")
              if (parts.length < 2) return null

              // ตัดพารามิเตอร์ query string ออก (ถ้ามี)
              return parts[1].split("?")[0]
            }

            const storagePath = extractStoragePath(imageUrl)

            if (storagePath) {
              console.log("Attempting to delete image at path:", storagePath)
              const { error: storageError } = await supabase.storage.from("pet-images").remove([storagePath])

              if (storageError) {
                console.error("Error deleting image from storage:", storageError)
              } else {
                console.log("Successfully deleted image from storage")
              }
            }
          }
        } catch (storageError) {
          console.error("Error processing storage path:", storageError)
          // ไม่ throw error เพื่อให้ UI ยังอัปเดตได้แม้ลบรูปไม่สำเร็จ
        }
      }

      // 3. อัปเดตรายการสัตว์เลี้ยงในหน้าจอ
      setPets(pets.filter((pet) => pet.id !== petToDelete.id))

      toast({
        title: "ลบสัตว์เลี้ยงสำเร็จ",
        description: "ลบข้อมูลสัตว์เลี้ยงเรียบร้อยแล้ว",
      })
    } catch (error) {
      console.error("Error deleting pet:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบข้อมูลสัตว์เลี้ยงได้",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setPetToDelete(null)
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

  if (loading) {
    return (
      <div className="container py-8 flex justify-center">
        <p>กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">สัตว์เลี้ยงของฉัน</h1>
        <Link href="/add-pet">
          <Button className="bg-pink-600 hover:bg-pink-700">
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มสัตว์เลี้ยง
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <p>กำลังโหลดข้อมูลสัตว์เลี้ยง...</p>
        </div>
      ) : pets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">ยังไม่มีสัตว์เลี้ยง</h2>
          <p className="text-gray-500 mb-6">คุณยังไม่ได้เพิ่มสัตว์เลี้ยง เริ่มต้นเพิ่มสัตว์เลี้ยงตัวแรกของคุณเลย!</p>
          <Link href="/add-pet">
            <Button className="bg-pink-600 hover:bg-pink-700">
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มสัตว์เลี้ยงตัวแรก
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pets.map((pet) => (
            <Card key={pet.id} className="overflow-hidden">
              <Link href={`/pets/${pet.id}`} className="cursor-pointer">
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
                      <img src={imageUrl || "/placeholder.svg"} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                        <p className="text-gray-500">ไม่มีรูปภาพ</p>
                      </div>
                    )
                  })()}
                </div>
              </Link>
              <CardContent className="p-4">
                <Link href={`/pets/${pet.id}`}>
                  <h3 className="text-xl font-bold mb-1 hover:text-pink-600 transition-colors">
                    {pet.name} {renderGenderSymbol(pet.gender)}
                  </h3>
                </Link>
                <p className="text-sm text-gray-500 mb-2">
                  {pet.species} {pet.breed ? `• ${pet.breed}` : ""} {pet.age ? `• ${pet.age} ปี` : ""}
                </p>
                <p className="line-clamp-2 text-sm">{pet.description || "ไม่มีคำอธิบาย"}</p>
              </CardContent>
              <CardFooter className="flex justify-end p-4 pt-0">
                <div className="flex gap-2">
                  <Link href={`/pets/${pet.id}/edit`}>
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => confirmDelete(pet)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog ยืนยันการลบ */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบ {petToDelete?.name}? การกระทำนี้ไม่สามารถย้อนกลับได้ และรูปภาพจะถูกลบด้วย
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row justify-end gap-2">
  {/* ปุ่มลบ */}
  <AlertDialogAction
    onClick={handleDelete}
    className="bg-red-600 hover:bg-red-700 w-24"
    disabled={isDeleting}
  >
    {isDeleting ? "กำลังลบ..." : "ลบ"}
  </AlertDialogAction>

  {/* ปุ่มยกเลิก */}
      <AlertDialogCancel className="w-24">
               ยกเลิก
        </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
