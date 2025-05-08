import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, Search, Plus } from "lucide-react"

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] py-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <img src="/petamour-logo.png" alt="PetAmour Logo" className="h-24 w-24 mb-4" />
        </div>

        <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-[#40E0D0] via-[#FFA500] to-[#FF6B6B] text-transparent bg-clip-text">
          ไม่พบหน้าที่คุณกำลังค้นหา
        </h1>

        <p className="text-gray-500">หน้าที่คุณพยายามเข้าถึงอาจถูกย้าย ลบ หรือไม่มีอยู่ในระบบ</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button className="bg-[#40E0D0] hover:bg-[#2CCAC0] text-white" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              กลับหน้าหลัก
            </Link>
          </Button>

          <Button
            variant="outline"
            className="border-[#FFA500] text-[#FFA500] hover:bg-[#FFA500] hover:text-white"
            asChild
          >
            <Link href="/discover">
              <Search className="mr-2 h-4 w-4" />
              ค้นหาสัตว์เลี้ยง
            </Link>
          </Button>

          <Button
            variant="outline"
            className="border-[#FF6B6B] text-[#FF6B6B] hover:bg-[#FF6B6B] hover:text-white"
            asChild
          >
            <Link href="/pets/new">
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มสัตว์เลี้ยง
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
