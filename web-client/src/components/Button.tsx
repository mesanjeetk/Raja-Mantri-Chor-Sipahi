import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
    isLoading?: boolean;
}

export const Button = ({
    variant = 'primary',
    size = 'md',
    children,
    isLoading = false,
    className = '',
    disabled,
    ...props
}: ButtonProps) => {
    const baseStyles = 'font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl',
        secondary: 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20',
        ghost: 'text-white hover:bg-white/10',
        danger: 'bg-red-600 hover:bg-red-500 text-white',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-5 py-2.5 text-base',
        lg: 'px-7 py-3.5 text-lg',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                </span>
            ) : children}
        </button>
    );
};
