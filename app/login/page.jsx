"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function Login() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [message, setMessage] = useState("")
  const [
    /*email, setEmail*/
  ] = useState("") // ลบบรรทัดนี้
  const [
    /*error, setError*/
  ] = useState("") // ลบบรรทัดนี้

  useEffect(() => {
    // ตรวจสอบ query parameter สำหรับข้อความแจ้งเตือน
    const messageParam = searchParams.get("message")
    if (messageParam === "please-confirm-email") {
      setMessage("กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันการสมัครสมาชิก ก่อนเข้าสู่ระบบ")
    }
  }, [searchParams])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        console.error("Login error:", error.message)
        throw error
      }

      // แสดง toast เมื่อเข้าสู่ระบบสำเร็จ
      toast({
        title: "เข้าสู่ระบบสำเร็จ",
        description: "ยินดีต้อนรับกลับมา!",
      })

      router.push("/")
    } catch (error) {
      console.error("Error during login:", error)

      // แสดงข้อความที่เฉพาะเจาะจงสำหรับกรณีอีเมลยังไม่ได้ยืนยัน
      if (error.message && error.message.includes("Email not confirmed")) {
        toast({
          title: "อีเมลยังไม่ได้ยืนยัน",
          description: "กรุณาตรวจสอบอีเมลของคุณและคลิกลิงก์ยืนยันก่อนเข้าสู่ระบบ",
          variant: "destructive",
        })
      } else {
        // ใช้ setTimeout เพื่อให้แน่ใจว่า toast ถูกเรียกหลังจาก render
        setTimeout(() => {
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
            variant: "destructive",
          })
        }, 100)

        // เพิ่มการแสดงข้อความผิดพลาดในหน้าเว็บด้วย
        setMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
      }
    } finally {
      setIsLoading(false)
    }
  }

  // เพิ่มฟังก์ชันสำหรับการเข้าสู่ระบบด้วย OTP
  // เพิ่มฟังก์ชันนี้ต่อจากฟังก์ชัน handleSignIn

  /*const handleSignInWithOTP = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) throw error

      toast({
        title: "ส่งรหัส OTP แล้ว",
        description: "กรุณาตรวจสอบอีเมลของคุณเพื่อรับรหัส OTP",
      })

      // ส่งผู้ใช้ไปยังหน้ายืนยัน OTP
      router.push(`/verify?email=${encodeURIComponent(email)}`)
    } catch (error) {
      console.error("Error sending OTP:", error)
      setError(error.message || "ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง")

      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }*/

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
              เข้าสู่ระบบ
            </CardTitle>
            <CardDescription className="text-center">เข้าสู่ระบบเพื่อจัดการสัตว์เลี้ยงของคุณ</CardDescription>
          </div>
        </CardHeader>

        {message && (
          <div className="px-6 pt-2">
            <Alert variant="destructive" className="border-red-500 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-600 font-medium">{message}</AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
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
                className="border-[#40E0D0]/30 focus-visible:ring-[#40E0D0]"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-[#40E0D0] hover:bg-[#2CCAC0] text-white" disabled={isLoading}>
              {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
            {/*<div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">หรือ</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignInWithOTP}
              className="w-full border-[#40E0D0]/30 hover:bg-[#40E0D0]/10"
              disabled={isLoading}
            >
              {isLoading ? "กำลังดำเนินการ..." : "เข้าสู่ระบบด้วย OTP"}
            </Button>*/}
            <div className="text-center text-sm">
              ยังไม่มีบัญชี?{" "}
              <Link href="/register" className="underline text-[#FF6B6B] hover:text-[#FF5252]">
                สมัครสมาชิก
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
