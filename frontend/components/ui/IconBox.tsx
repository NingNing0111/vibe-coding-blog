'use client'

import { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface IconBoxProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
}

export default function IconBox({ children, className, size = 'md', ...props }: IconBoxProps) {
  return (
    <div
      className={cn(
        'bg-indigo-100 dark:bg-indigo-900/30 rounded-lg w-fit',
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
