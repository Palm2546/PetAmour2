"use client"

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  // ตรวจสอบว่า toasts มีค่าและเป็น array
  const validToasts = Array.isArray(toasts) ? toasts : []

  // แสดง console.log เพื่อตรวจสอบ toasts
  console.log("Current toasts:", validToasts)

  return (
    <ToastProvider>
      {validToasts.map(({ id, title, description, action, ...props }) => {
        console.log("Rendering toast:", id, title, description)
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
