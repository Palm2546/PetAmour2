"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Filter, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { createInterestNotification } from "@/utils/notification-utils"

export default function DiscoverPage() {
  const router = useRouter()
  const { supabase, user, loading } = useSupabase()
  const { toast } = useToast()
  const [pets, setPets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    species: "",
    gender: "",
  })
  const [appliedFilters, setAppliedFilters] = useState({
    species: "",
    gender: "",
  })

  useEffect(() => {
    const fetchPets = async () => {
      if (loading) return

      if (!user) {
        router.push("/login")
        return
      }

      try {
        // 1. ดึงข้อมูลสัตว์เลี้ยงทั้งหมด (ยกเว้นของผู้ใช้ปัจจุบัน)
        let query = supabase
          .from("pets")
          .select("*, profiles(username, avatar_url)")
          .neq("owner_id", user.id)
          .order("created_at", { ascending: false })

        // เพิ่มการกรองตามประเภทสัตว์
        if (appliedFilters.species) {
          query = query.eq("species", appliedFilters.species)
        }

        // เพิ่มการกรองตามเพศ
        if (appliedFilters.gender) {
          query = query.eq("gender", appliedFilters.gender)
        }

        const { data, error } = await query

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
  }, [supabase, user, loading, router, toast, appliedFilters])

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
  }

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters })
    setShowFilters(false)
  }

  const handleResetFilters = () => {
    setFilters({
      species: "",
      gender: "",
    })
    setAppliedFilters({
      species: "",
      gender: "",
    })
    setShowFilters(false)
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

  // กรองสัตว์เลี้ยงตามคำค้นหา
  const filteredPets = pets.filter((pet) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      pet.name.toLowerCase().includes(searchLower) ||
      (pet.species && pet.species.toLowerCase().includes(searchLower)) ||
      (pet.breed && pet.breed.toLowerCase().includes(searchLower)) ||
      (pet.description && pet.description.toLowerCase().includes(searchLower))
    )
  })

  // Function to navigate to pet detail page
  const navigateToPetDetail = (petId, e) => {
    // Prevent event bubbling if clicking on buttons inside the card
    if (e.target.closest("button")) return
    router.push(`/pets/${petId}`)
  }

  // Function to handle showing interest in a pet
  const handleShowInterest = async (pet) => {
    try {
      // Simulate saving interest in the pet (replace with actual logic)
      console.log(`Showing interest in pet: ${pet.name} (ID: ${pet.id})`)

      // Create notification for the pet owner
      await createInterestNotification(
        supabase,
        pet.owner_id, // ID ของเจ้าของสัตว์เลี้ยง
        user.id, // ID ของผู้ใช้ที่แสดงความสนใจ
        pet.id, // ID ของสัตว์เลี้ยง
      )

      toast({
        title: "แสดงความสนใจสำเร็จ",
        description: `คุณได้แสดงความสนใจใน ${pet.name} แล้ว`,
      })
    } catch (notificationError) {
      console.error("Error creating interest notification:", notificationError)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถส่งการแจ้งเตือนได้",
        variant: "destructive",
      })
    }
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">ค้นพบสัตว์เลี้ยง</h1>

        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input placeholder="ค้นหาสัตว์เลี้ยง..." value={searchTerm} onChange={handleSearch} className="pl-10" />
          </div>
          <Button
            variant={Object.values(appliedFilters).some((v) => v) ? "default" : "outline"}
            onClick={() => setShowFilters(true)}
            className={Object.values(appliedFilters).some((v) => v) ? "bg-pink-600 hover:bg-pink-700" : ""}
          >
            <Filter className="mr-2 h-4 w-4" />
            ตัวกรอง
            {Object.values(appliedFilters).filter(Boolean).length > 0 && (
              <Badge className="ml-2 bg-white text-pink-600">
                {Object.values(appliedFilters).filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* แสดงตัวกรองที่ใช้ */}
      {Object.values(appliedFilters).some((v) => v) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {appliedFilters.species && (
            <Badge className="bg-pink-100 text-pink-800 hover:bg-pink-200">
              ประเภท: {appliedFilters.species}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => {
                  setAppliedFilters((prev) => ({ ...prev, species: "" }))
                  setFilters((prev) => ({ ...prev, species: "" }))
                }}
              />
            </Badge>
          )}
          {appliedFilters.gender && (
            <Badge className="bg-pink-100 text-pink-800 hover:bg-pink-200">
              เพศ: {appliedFilters.gender}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => {
                  setAppliedFilters((prev) => ({ ...prev, gender: "" }))
                  setFilters((prev) => ({ ...prev, gender: "" }))
                }}
              />
            </Badge>
          )}
          {Object.values(appliedFilters).some((v) => v) && (
            <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200 cursor-pointer" onClick={handleResetFilters}>
              ล้างตัวกรองทั้งหมด
              <X className="ml-1 h-3 w-3" />
            </Badge>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <p>กำลังโหลดข้อมูลสัตว์เลี้ยง...</p>
        </div>
      ) : filteredPets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">ไม่พบสัตว์เลี้ยง</h2>
          <p className="text-gray-500">
            {searchTerm
              ? "ไม่พบสัตว์เลี้ยงที่ตรงกับคำค้นหา"
              : Object.values(appliedFilters).some((v) => v)
                ? "ไม่พบสัตว์เลี้ยงที่ตรงกับตัวกรอง"
                : "ไม่มีสัตว์เลี้ยงที่จะแสดง"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPets.map((pet) => (
            <Card
              key={pet.id}
              className="overflow-hidden h-full transition-all duration-200 hover:shadow-md cursor-pointer"
              onClick={(e) => navigateToPetDetail(pet.id, e)}
            >
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
              <CardContent className="p-4">
                <h3 className="text-xl font-bold mb-1">
                  {pet.name} {renderGenderSymbol(pet.gender)}
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  {pet.species} {pet.breed ? `• ${pet.breed}` : ""} {pet.age ? `• ${pet.age} ปี` : ""}
                </p>
                <p className="line-clamp-2 text-sm">{pet.description || "ไม่มีคำอธิบาย"}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={pet.profiles?.avatar_url || "/placeholder.svg"} alt={pet.profiles?.username} />
                    <AvatarFallback>{pet.profiles?.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-gray-500">โดย: {pet.profiles?.username || "ไม่ระบุชื่อ"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog ตัวกรอง */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ตัวกรอง</DialogTitle>
            <DialogDescription>กรองสัตว์เลี้ยงตามเงื่อนไขที่คุณต้องการ</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">ประเภทสัตว์</label>
              <Select value={filters.species} onValueChange={(value) => setFilters({ ...filters, species: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภทสัตว์" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="สุนัข">สุนัข</SelectItem>
                  <SelectItem value="แมว">แมว</SelectItem>
                  <SelectItem value="นก">นก</SelectItem>
                  <SelectItem value="กระต่าย">กระต่าย</SelectItem>
                  <SelectItem value="ปลา">ปลา</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">เพศ</label>
              <Select value={filters.gender} onValueChange={(value) => setFilters({ ...filters, gender: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเพศ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="ผู้">ผู้</SelectItem>
                  <SelectItem value="เมีย">เมีย</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleResetFilters}>
              รีเซ็ต
            </Button>
            <Button className="bg-pink-600 hover:bg-pink-700" onClick={handleApplyFilters}>
              ใช้ตัวกรอง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
