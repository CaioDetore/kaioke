import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary'
}

/** Base control styled with the shadcn token convention. */
export function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`button button--${variant} ${className}`} {...props}>{children}</button>
}
