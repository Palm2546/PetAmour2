"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function VerifyOTP() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)

  useEffect(() => {
    if (countdown > 0 && !canResend) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && !canResend) {
      setCanResend(true)
    }
  }, [countdown, canResend])

  const handleVerify = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      })

      if (error) throw error

      toast({
        title: "ยืนยันอีเมลสำเร็จ",
        description: "บัญชีของคุณได้รับการยืนยันแล้ว",
      })

      // ส่งผู้ใช้ไปยังหน้าหลักหรือหน้า login
      router.push("/login?verified=true")
    } catch (error) {
      console.error("Error verifying OTP:", error)
      setError(error.message || "รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง")

      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setIsLoading(true)
    setError("")

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) throw error

      toast({
        title: "ส่งรหัส OTP ใหม่แล้ว",
        description: "กรุณาตรวจสอบอีเมลของคุณ",
      })

      setCountdown(60)
      setCanResend(false)
    } catch (error) {
      console.error("Error resending OTP:", error)
      setError(error.message || "ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง")

      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      })
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
              ยืนยันอีเมล
            </CardTitle>
            <CardDescription className="text-center">
              กรุณากรอกรหัส OTP 6 หลักที่ส่งไปยัง {email || "อีเมลของคุณ"}
            </CardDescription>
          </div>
        </CardHeader>

        {error && (
          <div className="px-6 pt-2">
            <Alert variant="destructive" className="border-red-500 bg-red-50 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">รหัส OTP</Label>
              <Input
                id="otp"
                name="otp"
                placeholder="กรอกรหัส 6 หลัก"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="border-[#40E0D0]/30 focus-visible:ring-[#40E0D0] text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-[#40E0D0] hover:bg-[#2CCAC0] text-white" disabled={isLoading}>
              {isLoading ? "กำลังตรวจสอบ..." : "ยืนยัน"}
            </Button>
            <div className="text-center text-sm">
              {canResend ? (
                <Button
                  variant="link"
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="text-[#FF6B6B] hover:text-[#FF5252] p-0"
                >
                  ส่งรหัส OTP ใหม่
                </Button>
              ) : (
                <span>ส่งรหัสใหม่ได้ใน {countdown} วินาที</span>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
