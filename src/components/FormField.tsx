import type { InputHTMLAttributes } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  hint?: string
}

export default function FormField({ id, label, hint, className, ...inputProps }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="label-base">
        {label}
        {hint && (
          <span className="normal-case font-normal text-gray-400 ml-1">{hint}</span>
        )}
      </label>
      <input
        id={id}
        className={`input-base ${className ?? ''}`}
        {...inputProps}
      />
    </div>
  )
}
