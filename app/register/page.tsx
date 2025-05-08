"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function Register() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
  })
  const [errors, setErrors] = useState({
    password: "",
    confirmPassword: "",
    general: "",
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })

    // เคลียร์ข้อความแจ้งเตือนเมื่อผู้ใช้เริ่มพิมพ์ใหม่
    if (name === "password" || name === "confirmPassword") {
      setErrors({
        ...errors,
        password: "",
        confirmPassword: "",
      })
    }
  }

  // ตรวจสอบความซับซ้อนของรหัสผ่าน
  const validatePassword = (password) => {
    // ตรวจสอบความยาวขั้นต่ำ
    if (password.length < 6) {
      return "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร"
    }

    return ""
  }

  // ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่
  const validatePasswordMatch = (password, confirmPassword) => {
    if (password !== confirmPassword) {
      return "รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง"
    }

    return ""
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // ตรวจสอบรหัสผ่าน
    const passwordError = validatePassword(formData.password)
    const passwordMatchError = validatePasswordMatch(formData.password, formData.confirmPassword)

    // ถ้ามีข้อผิดพลาด ให้แสดงข้อความและยกเลิกการส่งฟอร์ม
    if (passwordError || passwordMatchError) {
      setErrors({
        ...errors,
        password: passwordError,
        confirmPassword: passwordMatchError,
      })

      // แสดง toast แจ้งเตือน
      if (passwordError) {
        toast({
          title: "รหัสผ่านไม่ถูกต้อง",
          description: passwordError,
          variant: "destructive",
        })
      } else if (passwordMatchError) {
        toast({
          title: "รหัสผ่านไม่ตรงกัน",
          description: passwordMatchError,
          variant: "destructive",
        })
      }

      return
    }

    setIsLoading(true)
    setErrors({ password: "", confirmPassword: "", general: "" })

    try {
      // ตรวจสอบว่า username ซ้ำหรือไม่
      const { data: existingUsers, error: usernameCheckError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", formData.username)
        .limit(1)

      if (usernameCheckError) throw usernameCheckError

      if (existingUsers && existingUsers.length > 0) {
        setErrors({
          ...errors,
          general: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้อื่น",
        })

        toast({
          title: "ชื่อผู้ใช้ซ้ำ",
          description: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้อื่น",
          variant: "destructive",
        })

        setIsLoading(false)
        return
      }

      // สมัครสมาชิกด้วย email และ password
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
          },
        },
      })

      if (error) throw error

      // ตรวจสอบว่าโปรไฟล์ถูกสร้างขึ้นหรือไม่
      if (data.user) {
        // รอสักครู่เพื่อให้ trigger ทำงาน
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // สร้างโปรไฟล์ด้วยตัวเอง
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          username: formData.username,
          updated_at: new Date().toISOString(),
        })

        if (profileError) {
          console.error("Error creating profile:", profileError)
          // ไม่ throw error เพื่อให้การสมัครสมาชิกสำเร็จ
        }
      }

      toast({
        title: "สมัครสมาชิกสำเร็จ",
        description: "กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันการสมัครสมาชิก",
      })

      // ส่งผู้ใช้ไปยังหน้ายืนยัน OTP
      router.push(`/verify?email=${encodeURIComponent(formData.email)}`)
    } catch (error) {
      console.error("Error during registration:", error)

      if (error.message.includes("already registered")) {
        setErrors({
          ...errors,
          general: "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ",
        })

        toast({
          title: "อีเมลซ้ำ",
          description: "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ",
          variant: "destructive",
        })
      } else {
        setErrors({
          ...errors,
          general: error.message || "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง",
        })

        toast({
          title: "เกิดข้อผิดพลาด",
          description: error.message || "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] py-8">
      <Card className="w-full max-w-md border border-[#40E0D0]/20 shadow-lg shadow-[#40E0D0]/5">
        <CardHeader className="space-y-1">
          <div className="flex flex-col items-center space-y-2 mb-4">
            <img
              src="/petamour-logo.png"
              alt="PetAmour Logo"
              className="h-20 w-20 transition-transform hover:scale-105"
            />
            <CardTitle className="text-2xl text-center bg-gradient-to-r from-[#40E0D0] via-[#FFA500] to-[#FF6B6B] text-transparent bg-clip-text">
              สมัครสมาชิก
            </CardTitle>
            <CardDescription className="text-center">สร้างบัญชีใหม่เพื่อเริ่มใช้งาน PetAmour</CardDescription>
          </div>
        </CardHeader>

        {errors.general && (
          <div className="px-6 pt-2">
            <Alert variant="destructive" className="border-red-500 bg-red-50 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
              <Input
                id="username"
                name="username"
                placeholder="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="border-[#40E0D0]/30 focus-visible:ring-[#40E0D0]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                required
                value={formData.email}
                onChange={handleChange}
                className="border-[#40E0D0]/30 focus-visible:ring-[#40E0D0]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                value={formData.password}
                onChange={handleChange}
                className={`border-[#40E0D0]/30 focus-visible:ring-[#40E0D0] ${errors.password ? "border-red-500" : ""}`}
              />
              {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
              <p className="text-xs text-gray-500">รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`border-[#40E0D0]/30 focus-visible:ring-[#40E0D0] ${errors.confirmPassword ? "border-red-500" : ""}`}
              />
              {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-[#40E0D0] hover:bg-[#2CCAC0] text-white" disabled={isLoading}>
              {isLoading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
            </Button>
            <div className="text-center text-sm">
              มีบัญชีอยู่แล้ว?{" "}
              <Link href="/login" className="underline text-[#FF6B6B] hover:text-[#FF5252]">
                เข้าสู่ระบบ
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
