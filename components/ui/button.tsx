import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-retail text-white hover:bg-retail/90 focus-visible:ring-retail/50 shadow-sm",
        primary:
          "bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-foreground/50 shadow-sm",
        retail:
          "bg-retail text-white hover:bg-retail/90 focus-visible:ring-retail/50 shadow-sm",
        erp:
          "bg-erp text-white hover:bg-erp/90 focus-visible:ring-erp/50 shadow-sm",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted hover:border-muted-foreground/30 focus-visible:ring-border",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-border",
        link: "text-foreground underline-offset-4 hover:underline focus-visible:ring-foreground/50",
      },
      size: {
        default: "h-12 px-7 py-3",
        sm: "h-9 px-4 text-sm",
        lg: "h-14 px-9 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
