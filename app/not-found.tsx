import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <h1 className="text-6xl md:text-8xl font-extrabold text-foreground tracking-tight">
        404
      </h1>
      <p className="mt-4 text-xl text-muted-foreground text-center max-w-md">
        This page does not exist. Let us get you back to where you need to be.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
      </Button>
    </div>
  )
}
