export function Footer() {
  return (
    <footer className="border-t py-4 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <img src="/petamour-logo.png" alt="PetAmour Logo" className="h-10 w-10" />
            <span className="text-lg font-bold bg-gradient-to-r from-[#40E0D0] via-[#FFA500] to-[#FF6B6B] text-transparent bg-clip-text">
              PetAmour
            </span>
          </div>
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">© 2025 PetAmour - By TPDEV</div>
        </div>
      </div>
    </footer>
  )
}
