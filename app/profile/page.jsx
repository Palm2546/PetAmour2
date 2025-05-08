"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Edit, Heart, PawPrint, Save, Upload, Camera, X, Search, Trash } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export default function Profile() {
  const router = useRouter()
  const { supabase, user, loading } = useSupabase()
  const { toast } = useToast()
  const [profile, setProfile] = useState(null)
  const [pets, setPets] = useState([])
  const [stats, setStats] = useState({
    petCount: 0,
    interestCount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    bio: "",
  })
  const [isSaving, setIsSaving] = useState(false)

  // สำหรับการอัปโหลดรูปโปรไฟล์
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const fileInputRef = useRef(null)

  const [interestedPets, setInterestedPets] = useState([])
  const [isLoadingInterests, setIsLoadingInterests] = useState(true)
  const [petToRemove, setPetToRemove] = useState(null)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

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

  useEffect(() => {
    const fetchProfileData = async () => {
      if (loading) return

      if (!user) {
        router.push("/login")
        return
      }

      try {
        // 1. ดึงข้อมูลโปรไฟล์
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError) throw profileError

        setProfile(profileData)
        setFormData({
          username: profileData.username || "",
          fullName: profileData.full_name || "",
          // ลบบรรทัดนี้ออก: bio: profileData.bio || "",
        })

        // 2. ดึงข้อมูลสัตว์เลี้ยงของผู้ใช้
        const { data: petsData, error: petsError } = await supabase
          .from("pets")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })

        if (petsError) throw petsError

        setPets(petsData || [])
        setStats((prev) => ({ ...prev, petCount: petsData?.length || 0 }))

        // 3. ดึงข้อมูลการจับคู่
        // const { data: matchesData, error: matchesError } = await supabase
        //   .from("matches")
        //   .select("id")
        //   .or(
        //     `pet_id_1.in.(${petsData.map((p) => p.id).join(",")}),pet_id_2.in.(${petsData.map((p) => p.id).join(",")})`,
        //   )

        // if (!matchesError) {
        //   setStats((prev) => ({ ...prev, matchCount: matchesData?.length || 0 }))
        // }

        // 4. ดึงข้อมูลความสนใจที่ได้รับ
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

        // 5. ดึงข้อมูลสัตว์เลี้ยงที่ผู้ใช้สนใจ
        if (user) {
          try {
            setIsLoadingInterests(true)
            const { data: interestsData, error: interestsError } = await supabase
              .from("interests")
              .select("pet_id")
              .eq("user_id", user.id)

            if (interestsError) throw interestsError

            if (interestsData && interestsData.length > 0) {
              const petIds = interestsData.map((item) => item.pet_id)

              const { data: interestedPetsData, error: interestedPetsError } = await supabase
                .from("pets")
                .select("*, profiles(username, avatar_url)")
                .in("id", petIds)

              if (interestedPetsError) throw interestedPetsError

              setInterestedPets(interestedPetsData || [])
            } else {
              setInterestedPets([])
            }
          } catch (error) {
            console.error("Error fetching interested pets:", error)
            toast({
              title: "เกิดข้อผิดพลาด",
              description: "ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงที่สนใจได้",
              variant: "destructive",
            })
          } finally {
            setIsLoadingInterests(false)
          }
        }
      } catch (error) {
        console.error("Error fetching profile data:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลโปรไฟล์ได้",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfileData()
  }, [supabase, user, loading, router, toast])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setIsSaving(true)

    // เก็บข้อมูลเดิมไว้เผื่อต้องย้อนกลับ
    const previousProfile = { ...profile }

    // อัปเดต UI ทันที (Optimistic Update)
    setProfile({
      ...profile,
      username: formData.username,
      full_name: formData.fullName,
    })

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: formData.username,
          full_name: formData.fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) throw error

      setIsEditing(false)
      toast({
        title: "บันทึกสำเร็จ",
        description: "อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว",
      })
    } catch (error) {
      console.error("Error updating profile:", error)

      // กรณีเกิดข้อผิดพลาด ให้ย้อนกลับไปข้อมูลเดิม
      setProfile(previousProfile)

      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถอัปเดตข้อมูลโปรไฟล์ได้",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // ฟังก์ชันสำหรับการเลือกรูปภาพโปรไฟล์
  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "ไฟล์มีขนาดใหญ่เกินไป",
          description: "กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 5MB",
          variant: "destructive",
        })
        return
      }

      // ตรวจสอบประเภทไฟล์ (เฉพาะรูปภาพ)
      if (!file.type.startsWith("image/")) {
        toast({
          title: "ประเภทไฟล์ไม่ถูกต้อง",
          description: "กรุณาเลือกไฟล์รูปภาพเท่านั้น",
          variant: "destructive",
        })
        return
      }

      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // ฟังก์ชันสำหรับการอัปโหลดรูปภาพโปรไฟล์
  const handleUploadAvatar = async () => {
    if (!user || !avatarFile) return

    setIsUploadingAvatar(true)

    // เก็บข้อมูลเดิมไว้เผื่อต้องย้อนกลับ
    const previousAvatarUrl = profile?.avatar_url

    // สร้าง URL ชั่วคราวสำหรับ Optimistic UI Update
    const tempAvatarUrl = URL.createObjectURL(avatarFile)

    // อัปเดต UI ทันที (Optimistic Update)
    setProfile({
      ...profile,
      avatar_url: tempAvatarUrl,
    })

    try {
      // 1. อัปโหลดรูปภาพไปยัง Supabase Storage
      const fileExt = avatarFile.name.split(".").pop()
      const fileName = `avatar-${user.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      const filePath = `avatars/${fileName}`

      console.log("Uploading avatar to:", filePath)

      const { error: uploadError, data } = await supabase.storage.from("profile-images").upload(filePath, avatarFile)

      if (uploadError) {
        console.error("Upload error:", uploadError)
        throw uploadError
      }

      console.log("Upload successful:", data)

      // 2. สร้าง URL สำหรับรูปภาพ
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(filePath)

      console.log("Public URL:", publicUrl)

      // 3. อัปเดตข้อมูล avatar_url ในตาราง profiles
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (updateError) {
        console.error("Update profile error:", updateError)
        throw updateError
      }

      console.log("Profile updated successfully with new avatar:", publicUrl)

      // 4. อัปเดตข้อมูลโปรไฟล์ในสถานะด้วย URL จริง
      setProfile({
        ...profile,
        avatar_url: publicUrl,
      })

      // 5. อัพเดทข้อมูลผู้ใช้ใน Supabase Auth
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: publicUrl,
        },
      })

      if (authUpdateError) {
        console.error("Auth update error:", authUpdateError)
        // ไม่ throw error เพื่อให้การอัพเดทโปรไฟล์ยังสำเร็จ
      }

      // 6. ส่ง event เพื่อบอกให้ components อื่นๆ รู้ว่ามีการอัปเดตโปรไฟล์
      const event = new CustomEvent("profile-updated", {
        detail: { avatar_url: publicUrl },
      })
      window.dispatchEvent(event)

      toast({
        title: "อัปโหลดสำเร็จ",
        description: "อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว",
      })

      // 7. รีเซ็ตค่าต่างๆ
      setAvatarFile(null)
      setAvatarPreview(null)
      setShowAvatarDialog(false)

      // ล้าง URL ชั่วคราว
      URL.revokeObjectURL(tempAvatarUrl)
    } catch (error) {
      console.error("Error uploading avatar:", error)

      // กรณีเกิดข้อผิดพลาด ให้ย้อนกลับไป URL เดิม
      setProfile({
        ...profile,
        avatar_url: previousAvatarUrl,
      })

      // ล้าง URL ชั่วคราว
      URL.revokeObjectURL(tempAvatarUrl)

      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถอัปโหลดรูปโปรไฟล์ได้",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // ฟังก์ชันสำหรับการเปิด file dialog
  const handleOpenFileDialog = () => {
    fileInputRef.current?.click()
  }

  // ฟังก์ชันสำหรับการยกเลิกการเลือกรูปภาพ
  const handleCancelAvatarSelection = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  // ฟังก์ชันสำหรับการลบความสนใจในสัตว์เลี้ยง
  const handleRemoveInterest = async () => {
    if (!petToRemove) return

    setIsRemoving(true)
    try {
      // ลบข้อมูลความสนใจจากฐานข้อมูล
      const { error } = await supabase.from("interests").delete().eq("user_id", user.id).eq("pet_id", petToRemove.id)

      if (error) throw error

      // อัปเดตรายการสัตว์เลี้ยงที่สนใจในหน้าจอ
      setInterestedPets(interestedPets.filter((pet) => pet.id !== petToRemove.id))

      toast({
        title: "ลบความสนใจสำเร็จ",
        description: "ลบความสนใจในสัตว์เลี้ยงเรียบร้อยแล้ว",
      })
    } catch (error) {
      console.error("Error removing interest:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบความสนใจในสัตว์เลี้ยงได้",
        variant: "destructive",
      })
    } finally {
      setIsRemoving(false)
      setShowRemoveDialog(false)
      setPetToRemove(null)
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
            <CardDescription>คุณต้องเข้าสู่ระบบเพื่อดูโปรไฟล์</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/login")} className="w-full bg-[#40E0D0] hover:bg-[#2CCAC0]">
              เข้าสู่ระบบ
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">โปรไฟล์</TabsTrigger>
          <TabsTrigger value="interested">สัตว์เลี้ยงที่สนใจ</TabsTrigger>
          <TabsTrigger value="stats">สถิติ</TabsTrigger>
        </TabsList>

        {/* แท็บโปรไฟล์ */}
        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ข้อมูลโปรไฟล์ */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>ข้อมูลส่วนตัว</CardTitle>
                  <CardDescription>จัดการข้อมูลส่วนตัวของคุณ</CardDescription>
                </div>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    แก้ไข
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    ยกเลิก
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">ชื่อผู้ใช้</Label>
                      <Input
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="ชื่อผู้ใช้"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">ชื่อ-นามสกุล</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="ชื่อ นามสกุล"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">อีเมล</Label>
                      <Input id="email" value={user.email} disabled className="bg-gray-100" />
                      <p className="text-xs text-gray-500">ไม่สามารถเปลี่ยนอีเมลได้</p>
                    </div>
                    {/* ลบส่วนนี้ออก
                    <div className="space-y-2">
                      <Label htmlFor="bio">เกี่ยวกับฉัน</Label>
                      <Textarea
                        id="bio"
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        placeholder="เล่าเกี่ยวกับตัวคุณและสัตว์เลี้ยงของคุณ"
                        rows={4}
                      />
                    </div>
                    */}
                    <Button onClick={handleSaveProfile} className="bg-[#40E0D0] hover:bg-[#2CCAC0]" disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">ชื่อผู้ใช้</h3>
                        <p className="mt-1">{profile?.username || "-"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">ชื่อ-นามสกุล</h3>
                        <p className="mt-1">{profile?.full_name || "-"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">อีเมล</h3>
                        <p className="mt-1">{user.email}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">วันที่สมัคร</h3>
                        <p className="mt-1">
                          {profile?.created_at
                            ? new Date(profile.created_at).toLocaleDateString("th-TH", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "-"}
                        </p>
                      </div>
                    </div>
                    {/* ลบส่วนนี้ออก
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">เกี่ยวกับฉัน</h3>
                      <p className="mt-1">{profile?.bio || "ยังไม่ได้เพิ่มข้อมูล"}</p>
                    </div>
                    */}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* รูปโปรไฟล์และข้อมูลสรุป */}
            <Card>
              <CardHeader>
                <CardTitle>โปรไฟล์</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="relative group">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarImage src={profile?.avatar_url || "/placeholder.svg"} alt={profile?.username} />
                    <AvatarFallback className="text-2xl">
                      {profile?.username?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* ปุ่มเปลี่ยนรูปโปรไฟล์ */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute bottom-2 right-0 rounded-full bg-white dark:bg-gray-800 shadow-md hover:bg-gray-100"
                    onClick={() => setShowAvatarDialog(true)}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>

                  {/* Dialog สำหรับเปลี่ยนรูปโปรไฟล์ */}
                  <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>เปลี่ยนรูปโปรไฟล์</DialogTitle>
                        <DialogDescription>อัปโหลดรูปภาพเพื่อเปลี่ยนรูปโปรไฟล์ของคุณ</DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        {avatarPreview ? (
                          <div className="relative mx-auto w-40 h-40 rounded-full overflow-hidden">
                            <img
                              src={avatarPreview || "/placeholder.svg"}
                              alt="ตัวอย่างรูปโปรไฟล์"
                              className="w-full h-full object-cover"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 rounded-full"
                              onClick={handleCancelAvatarSelection}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="mx-auto w-40 h-40 border-2 border-dashed rounded-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
                            onClick={handleOpenFileDialog}
                          >
                            <Upload className="h-10 w-10 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">คลิกเพื่ออัปโหลดรูปภาพ</p>
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />

                        {!avatarPreview && (
                          <Button variant="outline" className="w-full" onClick={handleOpenFileDialog}>
                            <Upload className="mr-2 h-4 w-4" />
                            เลือกรูปภาพ
                          </Button>
                        )}
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAvatarDialog(false)
                            setAvatarFile(null)
                            setAvatarPreview(null)
                          }}
                        >
                          ยกเลิก
                        </Button>
                        <Button
                          className="bg-[#40E0D0] hover:bg-[#2CCAC0]"
                          onClick={handleUploadAvatar}
                          disabled={!avatarFile || isUploadingAvatar}
                        >
                          {isUploadingAvatar ? "กำลังอัปโหลด..." : "บันทึกรูปโปรไฟล์"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <h2 className="text-xl font-bold">{profile?.username || "ผู้ใช้"}</h2>
                <p className="text-gray-500 mb-6">{profile?.full_name || ""}</p>

                <div className="grid grid-cols-3 w-full gap-2 text-center">
                  <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <PawPrint className="h-5 w-5 text-[#40E0D0] mb-1" />
                    <span className="text-lg font-bold">{stats.petCount}</span>
                    <span className="text-xs text-gray-500">สัตว์เลี้ยง</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Heart className="h-5 w-5 text-[#FF6B6B] mb-1" />
                    <span className="text-lg font-bold">{stats.interestCount}</span>
                    <span className="text-xs text-gray-500">ความสนใจ</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/my-pets">
                    <PawPrint className="mr-2 h-4 w-4" />
                    ดูสัตว์เลี้ยงของฉัน
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* แท็บสัตว์เลี้ยงที่สนใจ */}
        <TabsContent value="interested">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>สัตว์เลี้ยงที่สนใจ</CardTitle>
                <CardDescription>สัตว์เลี้ยงที่คุณได้แสดงความสนใจ</CardDescription>
              </div>
              <Button className="bg-[#40E0D0] hover:bg-[#2CCAC0]" asChild>
                <Link href="/discover">
                  <Search className="mr-2 h-4 w-4" />
                  ค้นหาเพิ่มเติม
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingInterests ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
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
              ) : interestedPets.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <Heart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-xl font-semibold mb-2">ยังไม่มีสัตว์เลี้ยงที่สนใจ</h3>
                  <p className="text-gray-500 mb-6">คุณยังไม่ได้แสดงความสนใจในสัตว์เลี้ยงใดๆ</p>
                  <Button className="bg-[#40E0D0] hover:bg-[#2CCAC0]" asChild>
                    <Link href="/discover">
                      <Search className="mr-2 h-4 w-4" />
                      ค้นพบสัตว์เลี้ยง
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {interestedPets.map((pet) => (
                    <Card key={pet.id} className="overflow-hidden h-full transition-all duration-200 hover:shadow-md">
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
                          <div className="absolute top-2 right-2 bg-[#FF6B6B] text-white rounded-full p-1">
                            <Heart className="h-4 w-4 fill-white" />
                          </div>
                        </div>
                      </Link>
                      <CardContent className="p-4">
                        <Link href={`/pets/${pet.id}`}>
                          <h3 className="text-xl font-bold mb-1 hover:text-[#40E0D0] transition-colors">
                            {pet.name} {renderGenderSymbol(pet.gender)}
                          </h3>
                        </Link>
                        <p className="text-sm text-gray-500 mb-2">
                          {pet.species} {pet.breed ? `• ${pet.breed}` : ""} {pet.age ? `• ${pet.age} ปี` : ""}
                        </p>
                        <p className="line-clamp-2 text-sm">{pet.description || "ไม่มีคำอธิบาย"}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={pet.profiles?.avatar_url || "/placeholder.svg"}
                                alt={pet.profiles?.username}
                              />
                              <AvatarFallback>{pet.profiles?.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                            </Avatar>
                            <p className="text-xs text-gray-500">โดย: {pet.profiles?.username || "ไม่ระบุชื่อ"}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                            onClick={() => {
                              setPetToRemove(pet)
                              setShowRemoveDialog(true)
                            }}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* แท็บสถิติ */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>สถิติของฉัน</CardTitle>
              <CardDescription>ข้อมูลสถิติเกี่ยวกับกิจกรรมของคุณบน PetAmour</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center">
                        <PawPrint className="h-8 w-8 text-[#40E0D0] mb-2" />
                        <h3 className="text-2xl font-bold">{stats.petCount}</h3>
                        <p className="text-gray-500">สัตว์เลี้ยงทั้งหมด</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center">
                        <Heart className="h-8 w-8 text-[#FF6B6B] mb-2" />
                        <h3 className="text-2xl font-bold">{stats.interestCount}</h3>
                        <p className="text-gray-500">ความสนใจที่ได้รับ</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Dialog ยืนยันการลบความสนใจ */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบความสนใจ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบความสนใจใน {petToRemove?.name}? การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center justify-end gap-2 sm:gap-4">
            <AlertDialogCancel onClick={() => setShowRemoveDialog(false)} className="m-0">
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveInterest}
              className="bg-red-600 hover:bg-red-700 m-0"
              disabled={isRemoving}
            >
              {isRemoving ? "กำลังลบ..." : "ลบความสนใจ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
