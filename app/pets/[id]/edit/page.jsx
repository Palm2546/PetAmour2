"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Upload, ImageIcon, ArrowLeft, X, Plus, AlertCircle } from "lucide-react"

// คอมโพเนนต์สำหรับแสดงข้อความแจ้งเตือน
const ErrorMessage = ({ message }) => {
  if (!message) return null

  return (
    <div className="flex items-center text-red-500 text-sm mt-2 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
      <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export default function EditPetPage() {
  const params = useParams()
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [images, setImages] = useState([])
  const [pet, setPet] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    species: "",
    breed: "",
    age: "",
    gender: "",
    description: "",
  })
  // เพิ่ม state สำหรับเก็บข้อความแจ้งเตือน
  const [errors, setErrors] = useState({
    image: "",
    name: "",
    species: "",
    gender: "",
    age: "", // เพิ่ม error สำหรับอายุ
  })

  useEffect(() => {
    const fetchPet = async () => {
      if (!user) {
        router.push("/login")
        return
      }

      try {
        const { data, error } = await supabase.from("pets").select("*").eq("id", params.id).single()

        if (error) throw error

        // ตรวจสอบว่าผู้ใช้เป็นเจ้าของสัตว์เลี้ยงหรือไม่
        if (data.owner_id !== user.id) {
          toast({
            title: "ไม่มีสิทธิ์เข้าถึง",
            description: "คุณไม่มีสิทธิ์แก้ไขข้อมูลสัตว์เลี้ยงนี้",
            variant: "destructive",
          })
          router.push("/my-pets")
          return
        }

        setPet(data)
        setFormData({
          name: data.name || "",
          species: data.species || "",
          breed: data.breed || "",
          age: data.age ? String(data.age) : "",
          gender: data.gender || "",
          description: data.description || "",
        })

        // ตั้งค่ารูปภาพที่มีอยู่แล้ว
        let existingImages = []

        try {
          // ตรวจสอบว่า image_url เป็น JSON string หรือไม่
          const imageUrls = JSON.parse(data.image_url)
          if (Array.isArray(imageUrls)) {
            existingImages = imageUrls.map((url) => ({
              url,
              isExisting: true,
            }))
          }
        } catch (e) {
          // ถ้าไม่ใช่ JSON string ให้ใช้ค่าเดิม
          if (data.image_url) {
            existingImages = [
              {
                url: data.image_url,
                isExisting: true,
              },
            ]
          }
        }

        setImages(existingImages)
      } catch (error) {
        console.error("Error fetching pet:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงได้",
          variant: "destructive",
        })
        router.push("/my-pets")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPet()
  }, [supabase, params.id, user, router, toast])

  const handleChange = (e) => {
    const { name, value } = e.target

    // ล้างข้อความแจ้งเตือนเมื่อผู้ใช้แก้ไขข้อมูล
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)

    if (files.length === 0) return

    // ล้างข้อความแจ้งเตือนเมื่อผู้ใช้อัปโหลดรูปภาพ
    if (errors.image) {
      setErrors((prev) => ({ ...prev, image: "" }))
    }

    // ตรวจสอบว่าจำนวนรูปภาพรวมไม่เกิน 3 รูป
    if (images.length + files.length > 3) {
      setErrors((prev) => ({ ...prev, image: "คุณสามารถอัปโหลดรูปภาพได้สูงสุด 3 รูป" }))
      return
    }

    const newImages = [...images]

    files.forEach((file) => {
      // ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, image: "ไฟล์มีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 5MB" }))
        return
      }

      // ตรวจสอบประเภทไฟล์ (เฉพาะรูปภาพ)
      if (!file.type.startsWith("image/")) {
        setErrors((prev) => ({ ...prev, image: "กรุณาเลือกไฟล์รูปภาพเท่านั้น" }))
        return
      }

      // สร้าง preview และเก็บไฟล์
      const reader = new FileReader()
      reader.onloadend = () => {
        newImages.push({
          file,
          preview: reader.result,
          isExisting: false,
        })
        setImages([...newImages])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    const newImages = [...images]
    newImages.splice(index, 1)
    setImages(newImages)

    // ล้างข้อความแจ้งเตือนเมื่อผู้ใช้ลบรูปภาพ
    if (errors.image) {
      setErrors((prev) => ({ ...prev, image: "" }))
    }
  }

  // ตรวจสอบความถูกต้องของฟอร์ม
  const validateForm = () => {
    let isValid = true
    const newErrors = {
      image: "",
      name: "",
      species: "",
      gender: "",
      age: "", // เพิ่ม error สำหรับอายุ
    }

    // ตรวจสอบรูปภาพ
    if (images.length === 0) {
      newErrors.image = "กรุณาเลือกรูปภาพสัตว์เลี้ยงของคุณอย่างน้อย 1 รูป"
      isValid = false
    }

    // ตรวจสอบชื่อสัตว์เลี้ยง
    if (!formData.name || formData.name.trim() === "") {
      newErrors.name = "กรุณากรอกชื่อสัตว์เลี้ยง"
      isValid = false
    }

    // ตรวจสอบประเภทสัตว์
    if (!formData.species || formData.species.trim() === "") {
      newErrors.species = "กรุณาเลือกประเภทสัตว์"
      isValid = false
    }

    // ตรวจสอบเพศ
    if (!formData.gender || formData.gender.trim() === "") {
      newErrors.gender = "กรุณาเลือกเพศของสัตว์เลี้ยง"
      isValid = false
    }

    // ตรวจสอบอายุ (ถ้ามีการกรอก)
    if (formData.age) {
      const age = Number.parseInt(formData.age)
      if (isNaN(age)) {
        newErrors.age = "อายุต้องเป็นตัวเลขเท่านั้น"
        isValid = false
      } else if (age < 0) {
        newErrors.age = "อายุต้องไม่น้อยกว่า 0"
        isValid = false
      } else if (age > 50) {
        newErrors.age = "อายุต้องไม่เกิน 50 ปี"
        isValid = false
      }
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // ตรวจสอบความถูกต้องของฟอร์ม
    const isValid = validateForm()
    if (!isValid) {
      return
    }

    setIsSaving(true)

    try {
      // 1. รวบรวม URL ของรูปภาพทั้งหมด
      const finalImageUrls = []

      // เก็บ URL ของรูปภาพเดิมที่ไม่ได้ลบ
      const existingImages = images.filter((img) => img.isExisting).map((img) => img.url)
      finalImageUrls.push(...existingImages)

      // 2. อัปโหลดรูปภาพใหม่ไปยัง Supabase Storage
      const newImages = images.filter((img) => !img.isExisting)

      for (const image of newImages) {
        const file = image.file
        const fileExt = file.name.split(".").pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage.from("pet-images").upload(filePath, file)

        if (uploadError) {
          throw uploadError
        }

        // สร้าง URL สำหรับรูปภาพใหม่
        const {
          data: { publicUrl },
        } = supabase.storage.from("pet-images").getPublicUrl(filePath)

        finalImageUrls.push(publicUrl)
      }

      // 3. อัปเดตข้อมูลสัตว์เลี้ยงในฐานข้อมูล
      const { error: updateError } = await supabase
        .from("pets")
        .update({
          name: formData.name,
          species: formData.species,
          breed: formData.breed || null,
          age: formData.age ? Number.parseInt(formData.age) : null,
          gender: formData.gender || null,
          description: formData.description || null,
          image_url: JSON.stringify(finalImageUrls), // เก็บ URL ทั้งหมดในรูปแบบ JSON
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)

      if (updateError) {
        throw updateError
      }

      toast({
        title: "บันทึกข้อมูลสำเร็จ",
        description: "อัปเดตข้อมูลสัตว์เลี้ยงเรียบร้อยแล้ว",
      })

      // นำทางกลับไปยังหน้าสัตว์เลี้ยง
      router.push(`/pets/${params.id}`)
    } catch (error) {
      console.error("Error updating pet:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถอัปเดตข้อมูลสัตว์เลี้ยงได้",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center">
        <p>กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">แก้ไขข้อมูลสัตว์เลี้ยง</h1>
      </div>

      <Card className="max-w-md mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ส่วนอัปโหลดรูปภาพ */}
          <div className="space-y-2">
            <Label htmlFor="image" className="font-medium flex items-center">
              รูปภาพสัตว์เลี้ยง <span className="text-red-500 ml-1">*</span>{" "}
              <span className="text-sm text-gray-500 ml-2">(สูงสุด 3 รูป)</span>
            </Label>
            <div className="mt-1">
              {/* แสดงรูปภาพที่เลือกไว้ */}
              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {images.map((image, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-xl overflow-hidden group shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                    >
                      <img
                        src={image.isExisting ? image.url : image.preview}
                        alt={`ตัวอย่างรูปภาพ ${index + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {index === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-6 pb-2 px-2 text-center">
                          <span className="text-white text-xs font-medium">รูปหลัก</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* ปุ่มเพิ่มรูปภาพ (แสดงเฉพาะเมื่อมีรูปน้อยกว่า 3 รูป) */}
                  {images.length < 3 && (
                    <div
                      className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-2 cursor-pointer bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-all duration-300 shadow-sm hover:shadow-md ${
                        errors.image ? "border-red-500" : "hover:border-pink-300 dark:hover:border-pink-500"
                      }`}
                      onClick={() => document.getElementById("image").click()}
                    >
                      <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mb-2 transition-transform duration-300 hover:scale-110">
                        <Plus
                          className={`h-6 w-6 ${errors.image ? "text-red-500" : "text-pink-500 dark:text-pink-400"}`}
                        />
                      </div>
                      <p
                        className={`text-sm text-center font-medium ${errors.image ? "text-red-500" : "text-gray-600 dark:text-gray-400"}`}
                      >
                        เพิ่มรูปภาพ
                      </p>
                      <p className="text-xs text-gray-500 mt-1 text-center">{images.length}/3 รูป</p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`w-full h-56 border-2 ${
                    errors.image ? "border-red-500" : "border-dashed border-gray-300 dark:border-gray-700"
                  } rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-all duration-300 ${
                    errors.image ? "" : "hover:border-pink-300 dark:hover:border-pink-500"
                  }`}
                  onClick={() => document.getElementById("image").click()}
                >
                  <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mb-3 transition-transform duration-300 hover:scale-110">
                    <Upload
                      className={`h-8 w-8 ${errors.image ? "text-red-500" : "text-pink-500 dark:text-pink-400"}`}
                    />
                  </div>
                  <p
                    className={`text-base font-medium ${errors.image ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    คลิกเพื่ออัปโหลดรูปภาพ
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                    ลากและวางรูปภาพหรือคลิกเพื่อเลือกไฟล์
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
                    PNG, JPG หรือ GIF (สูงสุด 5MB)
                  </p>
                </div>
              )}
              <Input id="image" type="file" accept="image/*" className="hidden" onChange={handleImageChange} multiple />
              <div className="flex items-center justify-between mt-3">
                <Button
                  type="button"
                  variant="outline"
                  className={`flex-1 border-pink-200 hover:border-pink-400 hover:bg-pink-50 dark:border-pink-900 dark:hover:border-pink-700 dark:hover:bg-pink-950 transition-all duration-300 ${
                    images.length >= 3 ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => document.getElementById("image").click()}
                  disabled={images.length >= 3}
                >
                  <ImageIcon className="mr-2 h-4 w-4 text-pink-500" />
                  {images.length > 0 ? "เพิ่มรูปภาพเพิ่มเติม" : "เลือกรูปภาพ"}
                </Button>
                {images.length > 0 && (
                  <div className="ml-3 px-3 py-1 bg-pink-50 dark:bg-pink-900/20 rounded-full text-xs text-pink-600 dark:text-pink-400 font-medium">
                    {images.length}/3 รูป
                  </div>
                )}
              </div>
              <ErrorMessage message={errors.image} />
            </div>
          </div>

          {/* ชื่อสัตว์เลี้ยง */}
          <div className="space-y-2">
            <Label htmlFor="name" className="font-medium flex items-center">
              ชื่อสัตว์เลี้ยง <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="ชื่อสัตว์เลี้ยงของคุณ"
              className={errors.name ? "border-red-500" : ""}
            />
            <ErrorMessage message={errors.name} />
          </div>

          {/* ประเภทสัตว์ */}
          <div className="space-y-2">
            <Label htmlFor="species" className="font-medium flex items-center">
              ประเภทสัตว์ <span className="text-red-500 ml-1">*</span>
            </Label>
            <select
              id="species"
              name="species"
              value={formData.species}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md ${errors.species ? "border-red-500" : "border-gray-300"}`}
            >
              <option value="">เลือกประเภทสัตว์</option>
              <option value="สุนัข">สุนัข</option>
              <option value="แมว">แมว</option>
              <option value="นก">นก</option>
              <option value="กระต่าย">กระต่าย</option>
              <option value="ปลา">ปลา</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
            <ErrorMessage message={errors.species} />
          </div>

          {/* พันธุ์ */}
          <div className="space-y-2">
            <Label htmlFor="breed" className="font-medium">
              พันธุ์
            </Label>
            <Input
              id="breed"
              name="breed"
              value={formData.breed}
              onChange={handleChange}
              placeholder="พันธุ์สัตว์เลี้ยงของคุณ"
            />
          </div>

          {/* อายุ */}
          <div className="space-y-2">
            <Label htmlFor="age" className="font-medium">
              อายุ (ปี)
            </Label>
            <Input
              id="age"
              name="age"
              type="number"
              value={formData.age}
              onChange={handleChange}
              placeholder="อายุสัตว์เลี้ยงของคุณ"
              min="0"
              max="50"
              maxLength="2"
              className={errors.age ? "border-red-500" : ""}
            />
            <ErrorMessage message={errors.age} />
            <p className="text-xs text-gray-500">อายุต้องอยู่ระหว่าง 0-50 ปี</p>
          </div>

          {/* เพศ */}
          <div className="space-y-2">
            <Label className="font-medium flex items-center">
              เพศ <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="flex justify-center gap-8 mt-2">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="gender-male"
                  name="gender"
                  value="ผู้"
                  checked={formData.gender === "ผู้"}
                  onChange={handleChange}
                  className="hidden"
                />
                <Label
                  htmlFor="gender-male"
                  className={`flex items-center justify-center cursor-pointer w-16 h-16 rounded-full ${
                    formData.gender === "ผู้" ? "bg-blue-100 dark:bg-blue-900" : "bg-blue-50 dark:bg-blue-800"
                  } hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors ${
                    errors.gender ? "ring-2 ring-red-500" : ""
                  }`}
                >
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">♂</span>
                </Label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="gender-female"
                  name="gender"
                  value="เมีย"
                  checked={formData.gender === "เมีย"}
                  onChange={handleChange}
                  className="hidden"
                />
                <Label
                  htmlFor="gender-female"
                  className={`flex items-center justify-center cursor-pointer w-16 h-16 rounded-full ${
                    formData.gender === "เมีย" ? "bg-pink-100 dark:bg-pink-900" : "bg-pink-50 dark:bg-pink-800"
                  } hover:bg-pink-200 dark:hover:bg-pink-700 transition-colors ${
                    errors.gender ? "ring-2 ring-red-500" : ""
                  }`}
                >
                  <span className="text-2xl font-bold text-pink-600 dark:text-pink-300">♀</span>
                </Label>
              </div>
            </div>
            <div className="flex justify-center">
              <ErrorMessage message={errors.gender} />
            </div>
          </div>

          {/* คำอธิบายเพิ่มเติม */}
          <div className="space-y-2">
            <Label htmlFor="description" className="font-medium">
              คำอธิบายเพิ่มเติม
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="เล่าเรื่องราวเกี่ยวกับสัตว์เลี้ยงของคุณ"
              rows="4"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800/50 transition-all duration-300"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
              disabled={isSaving}
            >
              {isSaving ? (
                <div className="flex items-center">
                  <span className="mr-2 h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  กำลังบันทึก...
                </div>
              ) : (
                "บันทึกข้อมูล"
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
