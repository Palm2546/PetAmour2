export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <img src="/petamour-logo.png" alt="PetAmour Logo" className="h-24 w-24 mb-6 animate-bounce" />
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-[#40E0D0] via-[#FFA500] to-[#FF6B6B] text-transparent bg-clip-text">
          กำลังโหลด...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">โปรดรอสักครู่</p>
      </div>
    </div>
  )
}
