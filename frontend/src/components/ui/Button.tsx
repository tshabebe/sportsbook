import { Button as RACButton, type ButtonProps as RACButtonProps, composeRenderProps } from "react-aria-components";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-solid/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg",
    {
        variants: {
            variant: {
                solid: "bg-accent-solid hover:bg-accent-solid-hover text-accent-text-contrast shadow-sm",
                outline: "border border-border-subtle hover:bg-element-hover-bg text-text-contrast",
                ghost: "hover:bg-element-hover-bg text-text-muted hover:text-text-contrast",
                danger: "bg-status-negative hover:bg-status-negative/90 text-accent-text-contrast shadow-sm",
                success: "bg-success-solid hover:bg-success-solid/90 text-accent-text-contrast shadow-sm",
            },
            size: {
                sm: "h-8 px-3 text-xs",
                md: "h-10 px-4 text-sm",
                lg: "h-12 px-6 text-base",
                icon: "size-10 p-2",
            },
        },
        defaultVariants: {
            variant: "solid",
            size: "md",
        },
    }
);

export interface ButtonProps extends RACButtonProps, VariantProps<typeof buttonVariants> { }

export function Button({ className, variant, size, ...props }: ButtonProps) {
    return (
        <RACButton
            {...props}
            className={composeRenderProps(className, (className) =>
                cn(buttonVariants({ variant, size, className }))
            )}
        />
    );
}
