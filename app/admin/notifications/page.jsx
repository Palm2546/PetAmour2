"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { AlertTriangle, Trash2, RefreshCw, CheckCircle, Shield, Info } from "lucide-react"
import { findInvalidNotifications, deleteInvalidNotifications } from "@/utils/notification-utils"

export default function AdminNotificationsPage() {
  const router = useRouter()
  const { supabase, user, loading } = useSupabase()
  const [isAdmin, setIsAdmin] = useState(false)
  const [invalidNotifications, setInvalidNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedNotifications, setSelectedNotifications] = useState([])
  const [activeTab, setActiveTab] = useState("invalid")
  const [scanStats, setScanStats] = useState({
    total: 0,
    invalid: 0,
    types: {},
  })

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push("/login")
      return
    }

    // ตรวจสอบว่าผู้ใช้เป็นผู้ดูแลระบบหรือไม่
    const checkAdminStatus = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).single()

        if (error) throw error

        // ตรวจสอบว่าผู้ใช้มีสิทธิ์ผู้ดูแลระบบหรือไม่
        const isUserAdmin = data?.role === "admin"
        setIsAdmin(isUserAdmin)

        if (!isUserAdmin) {
          toast({
            title: "ไม่มีสิทธิ์เข้าถึง",
            description: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
            variant: "destructive",
          })
          router.push("/")
        } else {
          // ถ้าเป็นผู้ดูแลระบบ ให้ค้นหาการแจ้งเตือนที่มีปัญหา
          scanForInvalidNotifications()
        }
      } catch (error) {
        console.error("Error checking admin status:", error)
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถตรวจสอบสิทธิ์ผู้ดูแลระบบได้",
          variant: "destructive",
        })
        router.push("/")
      }
    }

    checkAdminStatus()
  }, [supabase, user, loading, router])

  // ฟังก์ชันสำหรับค้นหาการแจ้งเตือนที่มีปัญหา
  const scanForInvalidNotifications = async () => {
    try {
      setIsScanning(true)
      setInvalidNotifications([])

      // ดึงการแจ้งเตือนทั้งหมด (จำกัดที่ 500 รายการล่าสุด)
      const { data: allNotifications, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

      if (error) throw error

      // ค้นหาการแจ้งเตือนที่มีปัญหา
      const invalidResults = await findInvalidNotifications(supabase)
      setInvalidNotifications(invalidResults)

      // คำนวณสถิติ
      const stats = {
        total: allNotifications.length,
        invalid: invalidResults.length,
        types: {},
      }

      // นับจำนวนการแจ้งเตือนแต่ละประเภท
      allNotifications.forEach((notification) => {
        if (!stats.types[notification.type]) {
          stats.types[notification.type] = 0
        }
        stats.types[notification.type]++
      })

      setScanStats(stats)

      toast({
        title: "ตรวจสอบเสร็จสิ้น",
        description: `พบการแจ้งเตือนที่มีปัญหา ${invalidResults.length} รายการ จากทั้งหมด ${allNotifications.length} รายการ`,
      })
    } catch (error) {
      console.error("Error scanning for invalid notifications:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถค้นหาการแจ้งเตือนที่มีปัญหาได้",
        variant: "destructive",
      })
    } finally {
      setIsScanning(false)
      setIsLoading(false)
    }
  }

  // ฟังก์ชันสำหรับลบการแจ้งเตือนที่เลือก
  const deleteSelectedNotifications = async () => {
    try {
      if (selectedNotifications.length === 0) {
        toast({
          title: "ไม่มีรายการที่เลือก",
          description: "กรุณาเลือกการแจ้งเตือนที่ต้องการลบ",
          variant: "destructive",
        })
        return
      }

      setIsDeleting(true)

      // ลบการแจ้งเตือนที่เลือก
      const result = await deleteInvalidNotifications(supabase, selectedNotifications)

      if (result.success) {
        toast({
          title: "ลบการแจ้งเตือนสำเร็จ",
          description: `ลบการแจ้งเตือนทั้งหมด ${result.count} รายการ`,
        })

        // อัปเดตรายการการแจ้งเตือนที่มีปัญหา
        setInvalidNotifications((prevNotifications) =>
          prevNotifications.filter((item) => !selectedNotifications.includes(item.notification.id)),
        )
        setSelectedNotifications([])
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: `ไม่สามารถลบการแจ้งเตือนได้: ${result.error}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting notifications:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบการแจ้งเตือนได้",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // ฟังก์ชันสำหรับลบการแจ้งเตือนที่มีปัญหาทั้งหมด
  const deleteAllInvalidNotifications = async () => {
    try {
      if (invalidNotifications.length === 0) {
        toast({
          title: "ไม่มีการแจ้งเตือนที่มีปัญหา",
          description: "ไม่มีการแจ้งเตือนที่มีปัญหาที่ต้องลบ",
          variant: "destructive",
        })
        return
      }

      setIsDeleting(true)

      // รวบรวม ID ของการแจ้งเตือนที่มีปัญหาทั้งหมด
      const allInvalidIds = invalidNotifications.map((item) => item.notification.id)

      // ลบการแจ้งเตือนที่มีปัญหาทั้งหมด
      const result = await deleteInvalidNotifications(supabase, allInvalidIds)

      if (result.success) {
        toast({
          title: "ลบการแจ้งเตือนสำเร็จ",
          description: `ลบการแจ้งเตือนที่มีปัญหาทั้งหมด ${result.count} รายการ`,
        })

        // อัปเดตรายการการแจ้งเตือนที่มีปัญหา
        setInvalidNotifications([])
        setSelectedNotifications([])
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: `ไม่สามารถลบการแจ้งเตือนได้: ${result.error}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting all invalid notifications:", error)
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบการแจ้งเตือนที่มีปัญหาทั้งหมดได้",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // ฟังก์ชันสำหรับเลือก/ยกเลิกการเลือกการแจ้งเตือน
  const toggleSelectNotification = (notificationId) => {
    setSelectedNotifications((prevSelected) => {
      if (prevSelected.includes(notificationId)) {
        return prevSelected.filter((id) => id !== notificationId)
      } else {
        return [...prevSelected, notificationId]
      }
    })
  }

  // ฟังก์ชันสำหรับเลือกการแจ้งเตือนทั้งหมด
  const selectAllNotifications = () => {
    if (invalidNotifications.length === 0) return

    if (selectedNotifications.length === invalidNotifications.length) {
      // ถ้าเลือกทั้งหมดแล้ว ให้ยกเลิกการเลือกทั้งหมด
      setSelectedNotifications([])
    } else {
      // ถ้ายังไม่ได้เลือกทั้งหมด ให้เลือกทั้งหมด
      setSelectedNotifications(invalidNotifications.map((item) => item.notification.id))
    }
  }

  // ฟังก์ชันสำหรับแสดงประเภทการแจ้งเตือน
  const getNotificationType = (type) => {
    switch (type) {
      case "message":
        return "ข้อความ"
      case "match":
        return "การจับคู่"
      case "interest":
        return "ความสนใจ"
      default:
        return type
    }
  }

  if (loading || isLoading) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              <Skeleton className="h-8 w-64" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-6" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>ไม่มีสิทธิ์เข้าถึง</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
            <Button onClick={() => router.push("/")}>กลับไปหน้าหลัก</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                จัดการการแจ้งเตือนที่มีปัญหา
              </CardTitle>
              <CardDescription>ใช้หน้านี้เพื่อค้นหาและลบการแจ้งเตือนที่มีข้อมูลไม่ถูกต้อง</CardDescription>
            </div>
            <Button onClick={scanForInvalidNotifications} disabled={isScanning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "กำลังตรวจสอบ..." : "ตรวจสอบใหม่"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>คำเตือน</AlertTitle>
              <AlertDescription>การลบการแจ้งเตือนจะไม่สามารถกู้คืนได้ กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ</AlertDescription>
            </Alert>
          </div>

          {scanStats.total > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">การแจ้งเตือนทั้งหมด</p>
                    <p className="text-3xl font-bold">{scanStats.total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">การแจ้งเตือนที่มีปัญหา</p>
                    <p className="text-3xl font-bold text-red-500">{scanStats.invalid}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">อัตราส่วนที่มีปัญหา</p>
                    <p className="text-3xl font-bold">
                      {scanStats.total > 0 ? ((scanStats.invalid / scanStats.total) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs defaultValue="invalid" value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="invalid">การแจ้งเตือนที่มีปัญหา</TabsTrigger>
              <TabsTrigger value="stats">สถิติการแจ้งเตือน</TabsTrigger>
            </TabsList>
            <TabsContent value="invalid">
              {invalidNotifications.length > 0 ? (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <Button variant="outline" size="sm" onClick={selectAllNotifications} className="mr-2">
                        {selectedNotifications.length === invalidNotifications.length ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
                      </Button>
                      <span className="text-sm text-gray-500">
                        เลือกแล้ว {selectedNotifications.length} จาก {invalidNotifications.length} รายการ
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteSelectedNotifications}
                        disabled={isDeleting || selectedNotifications.length === 0}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        ลบที่เลือก
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteAllInvalidNotifications}
                        disabled={isDeleting || invalidNotifications.length === 0}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        ลบทั้งหมด
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {invalidNotifications.map((item) => (
                      <Card
                        key={item.notification.id}
                        className={`overflow-hidden ${
                          selectedNotifications.includes(item.notification.id) ? "border-2 border-primary" : ""
                        }`}
                      >
                        <CardHeader className="bg-gray-50 p-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedNotifications.includes(item.notification.id)}
                                onChange={() => toggleSelectNotification(item.notification.id)}
                                className="h-4 w-4 mr-3 rounded border-gray-300"
                              />
                              <CardTitle className="text-base flex items-center">
                                <span className="mr-2">การแจ้งเตือน ID: {item.notification.id}</span>
                                <Badge variant={item.notification.is_read ? "outline" : "default"}>
                                  {item.notification.is_read ? "อ่านแล้ว" : "ยังไม่ได้อ่าน"}
                                </Badge>
                              </CardTitle>
                            </div>
                            <Badge variant="secondary">{getNotificationType(item.notification.type)}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium mb-2">ข้อมูลทั่วไป</h4>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium">สร้างเมื่อ:</span>{" "}
                                  {new Date(item.notification.created_at).toLocaleString()}
                                </div>
                                <div>
                                  <span className="font-medium">ผู้ใช้:</span> {item.notification.user_id}
                                </div>
                                <div>
                                  <span className="font-medium">ผู้ส่ง:</span> {item.notification.sender_id || "ไม่มี"}
                                </div>
                                <div>
                                  <span className="font-medium">Reference ID:</span>{" "}
                                  {item.notification.reference_id || "ไม่มี"}
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium mb-2">ข้อมูลเพิ่มเติม (data)</h4>
                              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                                {item.notification.data
                                  ? JSON.stringify(item.notification.data, null, 2)
                                  : "ไม่มีข้อมูลเพิ่มเติม"}
                              </pre>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t">
                            <h4 className="font-medium mb-2 flex items-center">
                              <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                              ปัญหาที่พบ
                            </h4>
                            <div className="space-y-2">
                              {item.validation.issues.map((issue, index) => (
                                <div key={index} className="bg-red-50 p-2 rounded border border-red-200">
                                  <p className="text-sm text-red-700">
                                    <span className="font-medium">{issue.field}:</span> {issue.issue}
                                  </p>
                                  {issue.value && (
                                    <p className="text-xs text-red-500 mt-1">ค่าที่ไม่ถูกต้อง: {issue.value}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="bg-gray-50 p-4 flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              toggleSelectNotification(item.notification.id)
                              deleteInvalidNotifications(supabase, [item.notification.id]).then((result) => {
                                if (result.success) {
                                  setInvalidNotifications((prev) =>
                                    prev.filter((n) => n.notification.id !== item.notification.id),
                                  )
                                  toast({
                                    title: "ลบการแจ้งเตือนสำเร็จ",
                                    description: "ลบการแจ้งเตือนเรียบร้อยแล้ว",
                                  })
                                }
                              })
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            ลบ
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  {isScanning ? (
                    <div className="flex flex-col items-center">
                      <RefreshCw className="h-12 w-12 text-gray-300 animate-spin mb-4" />
                      <h3 className="text-lg font-medium mb-2">กำลังตรวจสอบการแจ้งเตือน</h3>
                      <p className="text-gray-500">กรุณารอสักครู่...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium mb-2">ไม่พบการแจ้งเตือนที่มีปัญหา</h3>
                      <p className="text-gray-500">ระบบการแจ้งเตือนทำงานได้อย่างถูกต้อง</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="stats">
              {Object.keys(scanStats.types).length > 0 ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">สถิติการแจ้งเตือนตามประเภท</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(scanStats.types).map(([type, count]) => (
                          <div key={type} className="flex items-center">
                            <div className="w-32">
                              <Badge variant="outline">{getNotificationType(type)}</Badge>
                            </div>
                            <div className="flex-1 ml-4">
                              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${(count / scanStats.total) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="ml-4 w-20 text-right">
                              <span className="text-sm font-medium">{count}</span>
                              <span className="text-xs text-gray-500 ml-1">
                                ({((count / scanStats.total) * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">การดำเนินการเพิ่มเติม</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">ลบการแจ้งเตือนที่มีปัญหาทั้งหมด</h4>
                            <p className="text-sm text-gray-500">ลบการแจ้งเตือนที่มีข้อมูลไม่ถูกต้องทั้งหมด</p>
                          </div>
                          <Button
                            variant="destructive"
                            onClick={deleteAllInvalidNotifications}
                            disabled={isDeleting || invalidNotifications.length === 0}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            ลบทั้งหมด
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Info className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">ไม่มีข้อมูลสถิติ</h3>
                  <p className="text-gray-500">คลิกปุ่ม "ตรวจสอบใหม่" เพื่อดึงข้อมูลสถิติการแจ้งเตือน</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
