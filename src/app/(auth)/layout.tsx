import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 blur-[100px] bg-gradient-to-b from-white to-transparent pointer-events-none" />
      
      <div className="w-full max-w-md p-6 relative z-10">
        <div className="flex justify-center mb-8">
          <Link href="/" className="font-semibold text-2xl tracking-tight flex items-center gap-2.5 text-foreground">
            <img src="/gs-logo.webp" alt="GroupScout" className="size-9 rounded-xl object-contain" />
            <span className="font-bold">GroupScout</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}
